import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/core/theme.dart';
import 'package:nse_academy/data/models/course.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:nse_academy/features/billing/billing_controller.dart';
import 'package:nse_academy/features/billing/billing_gateway.dart';
import 'package:nse_academy/features/billing/plans_screen.dart';
import 'package:nse_academy/state/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

http.Response _json(Object body, [int code = 200]) => http.Response(jsonEncode(body), code, headers: {'content-type': 'application/json; charset=utf-8'});

class FakeGateway implements BillingGateway {
  FakeGateway({this.isAvailable = true, this.catalog = const []});
  final bool isAvailable;
  final List<PlanOffer> catalog;
  final stream = StreamController<List<StorePurchase>>.broadcast();
  final bought = <(PlanOffer, String)>[];
  final completed = <String>[];
  int restores = 0;

  @override
  Future<bool> get available async => isAvailable;
  @override
  Future<List<PlanOffer>> offers() async => catalog;
  @override
  Stream<List<StorePurchase>> get purchases => stream.stream;
  @override
  Future<bool> buy(PlanOffer offer, {required String accountId}) async {
    bought.add((offer, accountId));
    return true;
  }

  @override
  Future<void> complete(StorePurchase purchase) async => completed.add(purchase.token);
  @override
  Future<void> restore() async => restores++;
  void emit(StorePurchase p) => stream.add([p]);
}

const _offers = [
  PlanOffer(productId: 'nse_intermediary', tier: Tier.intermediary, months: 1, price: 'KES 300.00', basePlanId: 'monthly'),
  PlanOffer(productId: 'nse_intermediary', tier: Tier.intermediary, months: 12, price: 'KES 3,060.00', basePlanId: 'annual'),
  PlanOffer(productId: 'nse_premium', tier: Tier.premium, months: 1, price: 'KES 500.00', basePlanId: 'monthly'),
  PlanOffer(productId: 'nse_premium', tier: Tier.premium, months: 3, price: 'KES 1,425.00', basePlanId: 'quarterly'),
];

/// A member whose plan is [tier] from [source]; verifying a purchase moves them to premium on Play.
class FakeApi {
  FakeApi({this.tier = 'free', this.source = 'paystack', this.verifyCode = 200});
  String tier;
  String source;
  int verifyCode;
  final calls = <String>[];
  Map<String, dynamic>? lastVerify;

  Future<http.Response> handle(http.Request r) async {
    calls.add('${r.method} ${r.url.path}');
    if (r.headers['Authorization'] != 'Bearer tok') return _json({'message': 'Unauthorized'}, 401);
    switch (r.url.path) {
      case '/users/me':
        return _json({'id': 'u1', 'email': 'jane@example.com', 'name': 'Jane Doe'});
      case '/payments/status':
        return _json({'tier': tier, 'effectiveTier': tier, 'status': tier == 'free' ? 'none' : 'active', 'source': source, 'currentPeriodEnd': DateTime.now().add(const Duration(days: 20)).toIso8601String()});
      case '/payments/google/config':
        return _json({'enabled': true, 'accountId': 'acct-hash', 'products': ['nse_intermediary', 'nse_premium']});
      case '/payments/google/verify':
        lastVerify = jsonDecode(r.body) as Map<String, dynamic>;
        if (verifyCode == 200) {
          tier = 'premium';
          source = 'play';
          return _json({'tier': 'premium'});
        }
        return _json({'message': 'Google Play does not recognise this purchase'}, verifyCode);
    }
    return _json({'message': 'not found'}, 404);
  }
}

Future<ProviderContainer> _show(WidgetTester tester, FakeApi api, FakeGateway gw) async {
  SharedPreferences.setMockInitialValues({});
  final sp = await SharedPreferences.getInstance();
  final tokens = MemoryTokenStore()..write('tok');
  tester.view.physicalSize = const Size(390 * 3, 3000 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(retry: (_, _) => null, overrides: [
    sharedPrefsProvider.overrideWithValue(sp),
    apiClientProvider.overrideWithValue(ApiClient(client: MockClient(api.handle))),
    tokenStoreProvider.overrideWithValue(tokens),
    billingGatewayProvider.overrideWithValue(gw),
  ]);
  addTearDown(container.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: buildTheme(Brightness.light), home: Consumer(builder: (context, ref, _) {
      ref.watch(billingProvider); // the app root does this in the real app
      return const PlansScreen();
    })),
  ));
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('a free member sees both plans with Google Play prices and the renewal terms', (tester) async {
    await _show(tester, FakeApi(), FakeGateway(catalog: _offers));
    expect(find.text('Free plan'), findsOneWidget);
    expect(find.textContaining('KES 300.00'), findsOneWidget);
    expect(find.textContaining('KES 500.00'), findsOneWidget);
    expect(find.text('Subscribe to Intermediary'), findsOneWidget);
    expect(find.textContaining('renew automatically'), findsOneWidget);
    expect(find.textContaining('cancel at any time'), findsOneWidget);
    expect(find.text('Restore purchases'), findsOneWidget);
  });

  testWidgets('choosing a longer length shows its price, and Subscribe starts the purchase with the account id', (tester) async {
    final gw = FakeGateway(catalog: _offers);
    await _show(tester, FakeApi(), gw);
    await tester.tap(find.text('1 year'));
    await tester.pumpAndSettle();
    expect(find.textContaining('KES 3,060.00'), findsOneWidget);
    await tester.tap(find.text('Subscribe to Intermediary'));
    await tester.pumpAndSettle();
    expect(gw.bought.single.$1.months, 12);
    expect(gw.bought.single.$1.productId, 'nse_intermediary');
    expect(gw.bought.single.$2, 'acct-hash');
  });

  testWidgets('a purchase is checked by the server, then completed with Play, and the plan updates', (tester) async {
    final api = FakeApi();
    final gw = FakeGateway(catalog: _offers);
    final container = await _show(tester, api, gw);
    gw.emit(const StorePurchase(productId: 'nse_premium', token: 'play-token-1', outcome: PurchaseOutcome.purchased));
    await tester.pumpAndSettle();
    expect(api.lastVerify, {'purchaseToken': 'play-token-1'});
    expect(gw.completed, ['play-token-1']);
    expect(container.read(tierProvider), Tier.premium);
    expect(find.text('Premium plan'), findsOneWidget);
    expect(find.textContaining('Premium is active'), findsOneWidget); // the snack bar
    expect(find.text('Your plan'), findsOneWidget);
  });

  testWidgets('a purchase the server cannot confirm is not completed, so Play offers it again', (tester) async {
    final api = FakeApi(verifyCode: 400);
    final gw = FakeGateway(catalog: _offers);
    final container = await _show(tester, api, gw);
    gw.emit(const StorePurchase(productId: 'nse_premium', token: 'bad', outcome: PurchaseOutcome.purchased));
    await tester.pumpAndSettle();
    expect(gw.completed, isEmpty);
    expect(container.read(tierProvider), Tier.free);
  });

  testWidgets('a purchase made for another account is reported, not granted', (tester) async {
    final api = FakeApi(verifyCode: 403);
    final gw = FakeGateway(catalog: _offers);
    await _show(tester, api, gw);
    gw.emit(const StorePurchase(productId: 'nse_premium', token: 'theirs', outcome: PurchaseOutcome.restored));
    await tester.pumpAndSettle();
    expect(gw.completed, isEmpty);
    expect(find.textContaining('different NSE Academy account'), findsOneWidget);
  });

  testWidgets('cancelling the Play sheet says nothing was charged', (tester) async {
    final gw = FakeGateway(catalog: _offers);
    await _show(tester, FakeApi(), gw);
    gw.emit(const StorePurchase(productId: 'nse_premium', token: '', outcome: PurchaseOutcome.cancelled));
    await tester.pumpAndSettle();
    expect(find.textContaining('You have not been charged'), findsOneWidget);
  });

  testWidgets('a plan bought on the website is not sold again in the app', (tester) async {
    await _show(tester, FakeApi(tier: 'intermediary', source: 'paystack'), FakeGateway(catalog: _offers));
    expect(find.textContaining('bought outside the app'), findsOneWidget);
    expect(find.textContaining('Subscribe to'), findsNothing);
    expect(find.text('Restore purchases'), findsNothing);
  });

  testWidgets('a Play Intermediary member can upgrade but is not offered Intermediary again', (tester) async {
    await _show(tester, FakeApi(tier: 'intermediary', source: 'play'), FakeGateway(catalog: _offers));
    expect(find.text('Upgrade to Premium'), findsOneWidget);
    expect(find.textContaining('Subscribe to Intermediary'), findsNothing);
    expect(find.text('Your plan'), findsOneWidget);
    expect(find.text('Manage in Google Play'), findsOneWidget);
  });

  testWidgets('where there is no Google Play the screen says so instead of showing broken buttons', (tester) async {
    await _show(tester, FakeApi(), FakeGateway(isAvailable: false));
    expect(find.textContaining('not available on this device'), findsOneWidget);
    expect(find.textContaining('Subscribe to'), findsNothing);
  });

  testWidgets('Restore purchases asks the store, and says so when there is nothing to restore', (tester) async {
    final gw = FakeGateway(catalog: _offers);
    await _show(tester, FakeApi(), gw);
    final before = gw.restores; // signing in already asked once, quietly
    await tester.tap(find.text('Restore purchases'));
    await tester.pump();
    expect(gw.restores, before + 1);
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(find.textContaining('No purchases to restore'), findsOneWidget);
  });

  test('billing periods read as months', () {
    expect(monthsOf('P1M'), 1);
    expect(monthsOf('P3M'), 3);
    expect(monthsOf('P6M'), 6);
    expect(monthsOf('P1Y'), 12);
    expect(monthsOf('P1W'), 0);
    expect(monthsOf('garbage'), 0);
  });
}
