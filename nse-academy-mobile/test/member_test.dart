import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/app.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/data/models/member.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:nse_academy/features/profile/account_screen.dart';
import 'package:nse_academy/features/tools/profiler_screen.dart';
import 'package:nse_academy/features/tools/tools_screen.dart';
import 'package:nse_academy/state/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';

http.Response _json(Object body, [int code = 200]) => http.Response(body is String ? body : jsonEncode(body), code, headers: {'content-type': 'application/json; charset=utf-8'});

const _onboarded = {'flutter.settings': '{"onboarded":true,"level":"basics","interests":["analysis"],"theme":"light"}'};

final _quiz = [
  for (var i = 1; i <= 10; i++)
    {
      'id': i,
      'question': 'Question number $i?',
      'options': [
        for (var o = 0; o < 4; o++) {'label': 'Q$i option ${o + 1}', 'score': o},
      ],
    },
];

final _portfolio = {
  'positions': [
    {'id': 'h1', 'ticker': 'SCOM', 'companyName': 'Safaricom', 'broker': {'id': 'b1', 'name': 'Faida'}, 'quantity': 100, 'avgCost': 20.0, 'costSource': 'TRADES', 'costBasisKes': 2000.0, 'currentPrice': 28.5, 'marketValueKes': 2850.0, 'unrealizedGainKes': 850.0},
  ],
  'consolidated': [
    {'ticker': 'SCOM', 'companyName': 'Safaricom', 'quantity': 100, 'avgCost': 20.0, 'costEstimated': false, 'costBasisKes': 2000.0, 'currentPrice': 28.5, 'marketValueKes': 2850.0, 'unrealizedGainKes': 850.0},
  ],
  'totalCostBasisKes': 2000.0,
  'totalMarketValueKes': 2850.0,
  'totalUnrealizedGainKes': 850.0,
};

/// A fake of the API and CMS for a member on [tier], with the calls the member screens make.
Future<http.Response> Function(http.Request) _server({String tier = 'premium', List<http.Request>? seen, bool hasProfile = false}) {
  return (r) async {
    seen?.add(r);
    final p = r.url.path;
    final q = r.url.queryParameters;
    final ok = r.headers['Authorization'] == 'Bearer tok';
    int rank(String t) => switch (t) { 'premium' => 2, 'intermediary' => 1, _ => 0 };
    bool allowed(String need) => rank(tier) >= rank(need);
    http.Response gate(String need, Object body) => !ok ? _json({'message': 'Unauthorized'}, 401) : (allowed(need) ? _json(body) : _json({'message': 'Upgrade required'}, 403));

    if (p == '/api/articles') return _json(q.containsKey(r'filters[slug][$eq]') ? articleBodyJson : articlesJson);
    if (p == '/api/glossary-terms') return _json(glossaryJson);
    if (p == '/api/stock-profiles') return _json(profilesJson);
    if (p == '/api/courses') return _json(coursesJson);
    if (p == '/public/market-data') return _json(quotesJson);
    if (p.startsWith('/public/market-data/') && p.endsWith('/history')) return _json(historyJson(p.split('/')[3]));
    if (p == '/public/market-reports/latest') return _json(reportJson);

    if (p == '/users/me') {
      if (!ok) return _json({'message': 'Unauthorized'}, 401);
      return _json({
        'id': 'u1',
        'email': 'jane@example.com',
        'name': 'Jane Doe',
        'effectiveTier': tier,
        'subscription': {'tier': tier, 'currentPeriodEnd': '2026-12-12T00:00:00.000Z'},
        if (hasProfile) 'investorProfile': {'type': 'dividend', 'riskScore': 40, 'horizonYears': 5, 'capitalRange': '100k-500k', 'isPublic': false},
      });
    }
    if (p == '/payments/status') return _json({'effectiveTier': tier, 'tier': tier});
    if (p == '/auth/register') return _json({'access_token': 'tok', 'user': {'id': 'u1', 'email': 'jane@example.com'}}, 201);
    if (p == '/profiler/questions') return _json(_quiz);
    if (p == '/profiler/submit') return gate('free', {'type': 'moderate', 'riskScore': 55, 'horizonYears': 5, 'capitalRange': '100k-500k', 'isPublic': false});
    if (p == '/advisor/recommendations') return gate('free', {'investorType': 'dividend', 'riskScore': 40, 'stocks': [{'ticker': 'SCOM', 'company_name': 'Safaricom PLC', 'sector': 'Telecom', 'dividend_yield': 6.2, 'risk_level': 'low'}]});
    if (p == '/advisor/research') return gate('free', {'userFit': {'score': 90, 'verdict': 'Strong Match', 'reason': 'As a Dividend Seeker: pays well.'}, 'investorTypeAnalysis': [{'type': 'dividend', 'rating': 'excellent', 'reasons': ['High yield']}]});
    if (p == '/journal/portfolio') return gate('intermediary', _portfolio);
    if (p == '/journal/trades') return gate('intermediary', {'data': [], 'total': 0, 'page': 1, 'limit': 50, 'totalPages': 0});
    if (p == '/journal/realized-gains') return gate('intermediary', {'totalRealizedGainKes': 0, 'byTicker': [], 'trades': []});
    if (p == '/journal/dividends') return gate('intermediary', <Object>[]);
    if (p == '/journal/dividends/yield-on-cost') return gate('intermediary', <Object>[]);
    if (p == '/portfolio-watch') return gate('premium', {'enabled': false, 'result': {'valueKes': 2850, 'dayChangeKes': 50, 'dayChangePct': 1.8}, 'fresh': [{'kind': 'TAKE_PROFIT', 'ticker': 'SCOM', 'key': 'k', 'text': 'SCOM is up 42% on your cost.'}]});
    if (p == '/allocation') return gate('intermediary', {'valueKes': 2850, 'rows': [{'ticker': 'SCOM', 'sector': 'Telecom', 'quantity': 100, 'price': 28.5, 'valueKes': 2850, 'weightPct': 100}], 'sectors': [{'sector': 'Telecom', 'valueKes': 2850, 'weightPct': 100, 'tickers': ['SCOM']}], 'unpriced': [], 'notes': [], 'targets': []});
    if (p == '/alerts' && r.method == 'GET') return gate('intermediary', [{'id': 'a1', 'ticker': 'SCOM', 'targetPrice': 30.0, 'direction': 'ABOVE', 'status': 'pending'}]);
    if (p == '/notifications') return gate('intermediary', <Object>[]);
    if (p == '/notifications/unread-count') return gate('intermediary', {'count': 2});
    if (p == '/brokers') return _json([{'id': 'b1', 'name': 'Faida Investment Bank', 'feePercent': 1.8, 'cdsRequired': true}]);
    if (p == '/public/research') return _json([]);
    if (p == '/public/model-portfolios') return _json({'note': 'Examples only.', 'data': []});
    if (p == '/digest') return _json({'enabled': false});
    if (p == '/referrals/stats') return _json({'referralCode': 'JANE123', 'totalReferrals': 3, 'completedReferrals': 1, 'pendingReferrals': 2, 'freeMonthsEarned': 1});
    return http.Response('{"message":"not found"}', 404);
  };
}

Future<void> _launch(WidgetTester tester, {Future<http.Response> Function(http.Request)? server, bool signedIn = false}) async {
  SharedPreferences.setMockInitialValues(_onboarded);
  final sp = await SharedPreferences.getInstance();
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final tokens = MemoryTokenStore();
  if (signedIn) await tokens.write('tok');
  await tester.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: [
      sharedPrefsProvider.overrideWithValue(sp),
      apiClientProvider.overrideWithValue(ApiClient(client: MockClient(server ?? _server()))),
      tokenStoreProvider.overrideWithValue(tokens),
    ],
    child: const NseAcademyApp(),
  ));
  await tester.pumpAndSettle();
}

Future<void> _openTool(WidgetTester tester, String title) async {
  await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Tools')).last);
  await tester.pumpAndSettle();
  final list = find.descendant(of: find.byType(ToolsScreen), matching: find.byType(Scrollable)).first;
  await tester.drag(list, const Offset(0, 3000)); // back to the top, in case the hub was left scrolled
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(find.text(title), 200, scrollable: list);
  await tester.tap(find.text(title));
  await tester.pumpAndSettle();
}

void main() {
  group('Tools hub and plan gates', () {
    testWidgets('signed out: every tool is listed with its plan, and a locked one explains itself', (tester) async {
      await _launch(tester);
      await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Tools')).last);
      await tester.pumpAndSettle();
      expect(find.text('Investor profile'), findsOneWidget);
      expect(find.text('Sign in'), findsWidgets); // the banner and the free-with-account tag
      expect(find.text('Intermediary'), findsWidgets);
      expect(find.text('Premium'), findsNothing); // nothing on this plan is Premium-only at the top of the list
      await tester.tap(find.text('Portfolio journal'));
      await tester.pumpAndSettle();
      expect(find.text('Sign in to use this'), findsOneWidget);
      expect(find.textContaining('Log your buys and sells'), findsOneWidget);
    });

    testWidgets('a Free member can take the profile quiz but the portfolio journal says it is on Intermediary', (tester) async {
      await _launch(tester, server: _server(tier: 'free'), signedIn: true);
      await _openTool(tester, 'Portfolio journal');
      expect(find.text('Included in Intermediary'), findsOneWidget);
      expect(find.text('This part is included in the Intermediary plan.'), findsOneWidget);
      expect(find.text('See plans'), findsNothing); // the Play build never links out to buy
      await tester.pageBack();
      await tester.pumpAndSettle();
      await _openTool(tester, 'Investor profile');
      expect(find.text('Question 1 of 10'), findsOneWidget);
    });

    testWidgets('an Intermediary member sees holdings but Portfolio Watch and targets stay Premium', (tester) async {
      await _launch(tester, server: _server(tier: 'intermediary'), signedIn: true);
      await _openTool(tester, 'Portfolio journal');
      expect(find.text('KES 2,850.00'), findsWidgets);
      expect(find.text('SCOM'), findsOneWidget);
      expect(find.textContaining('Included in the Premium plan'), findsOneWidget); // Portfolio Watch
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Allocation'));
      await tester.pumpAndSettle();
      expect(find.text('Telecom'), findsWidgets);
      await tester.tap(find.text('Targets'));
      await tester.pumpAndSettle();
      expect(find.text('Included in Premium'), findsOneWidget);
    });

    testWidgets('a Premium member gets Portfolio Watch with real findings', (tester) async {
      await _launch(tester, server: _server(), signedIn: true);
      await _openTool(tester, 'Portfolio journal');
      expect(find.text('SCOM is up 42% on your cost.'), findsOneWidget);
      expect(find.text('Email me this every day'), findsOneWidget);
    });
  });

  group('Investor profile', () {
    testWidgets('ten answers are sent to the server and the type is shown', (tester) async {
      final seen = <http.Request>[];
      await _launch(tester, server: _server(tier: 'free', seen: seen), signedIn: true);
      await _openTool(tester, 'Investor profile');
      for (var i = 1; i <= 10; i++) {
        expect(find.text('Question $i of 10'), findsOneWidget);
        await tester.tap(find.text('Q$i option 2'));
        await tester.pumpAndSettle();
      }
      expect(find.text('Moderate Investor'), findsOneWidget);
      expect(find.text('55/100'), findsOneWidget);
      final submit = seen.firstWhere((r) => r.url.path == '/profiler/submit');
      final answers = (jsonDecode(submit.body)['answers'] as List);
      expect(answers.length, 10);
      expect(answers.first, {'questionId': 1, 'optionIndex': 1});
    });

    testWidgets('a member who already has a profile sees it instead of the quiz', (tester) async {
      await _launch(tester, server: _server(tier: 'free', hasProfile: true), signedIn: true);
      await _openTool(tester, 'Investor profile');
      expect(find.text('Dividend Seeker'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Retake the quiz'), 200, scrollable: find.descendant(of: find.byType(ProfilerScreen), matching: find.byType(Scrollable)).first);
      expect(find.text('Retake the quiz'), findsOneWidget);
    });

    testWidgets('picks show the stocks that match the type', (tester) async {
      await _launch(tester, server: _server(tier: 'free', hasProfile: true), signedIn: true);
      await _openTool(tester, 'Picks for you');
      expect(find.text('For a Dividend Seeker'), findsOneWidget);
      expect(find.text('SCOM'), findsOneWidget);
      expect(find.text('6.2% yield'), findsOneWidget);
    });
  });

  group('Sign-up and account', () {
    testWidgets('a new member can create a free account in the app', (tester) async {
      final seen = <http.Request>[];
      await _launch(tester, server: _server(tier: 'free', seen: seen));
      await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Profile')).last);
      await tester.pumpAndSettle();
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -900));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('New here? Create a free account'));
      await tester.pumpAndSettle();
      expect(find.text('Create your free account'), findsOneWidget);
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Jane Doe');
      await tester.enterText(fields.at(1), 'Jane@Example.com');
      await tester.enterText(fields.at(2), 'short');
      await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
      await tester.pumpAndSettle();
      expect(find.text('Use at least 8 characters'), findsOneWidget);
      await tester.enterText(fields.at(2), 'longenough1');
      await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
      await tester.pumpAndSettle();
      final reg = seen.firstWhere((r) => r.url.path == '/auth/register');
      expect(jsonDecode(reg.body), {'name': 'Jane Doe', 'email': 'jane@example.com', 'password': 'longenough1'});
      expect(find.text('My account'), findsOneWidget); // signed in: Profile now offers the account page
    });

    testWidgets('My account shows the plan and the renewal date, and saves a changed name', (tester) async {
      final seen = <http.Request>[];
      await _launch(tester, server: _server(tier: 'intermediary', seen: seen), signedIn: true);
      await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Profile')).last);
      await tester.pumpAndSettle();
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -700));
      await tester.pumpAndSettle();
      await tester.tap(find.text('My account'));
      await tester.pumpAndSettle();
      expect(find.text('Intermediary plan'), findsOneWidget);
      expect(find.textContaining('Paid until Dec 12, 2026'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('JANE123'), 200, scrollable: find.descendant(of: find.byType(AccountScreen), matching: find.byType(Scrollable)).first);
      expect(find.text('JANE123'), findsOneWidget);
      expect(find.textContaining('See plans'), findsNothing);
    });
  });

  group('Calculators and public tools', () {
    testWidgets('broker fees add up the brokerage and the three levies', (tester) async {
      await _launch(tester);
      await _openTool(tester, 'Calculators');
      await tester.enterText(find.byType(TextField).first, '100000');
      await tester.pumpAndSettle();
      expect(find.text('KES 1,800.00'), findsOneWidget); // brokerage at 1.8%
      expect(find.text('KES 2,100.00'), findsOneWidget); // plus 0.12 + 0.12 + 0.06 of the value
      expect(find.text('KES 102,100.00'), findsOneWidget); // what a buyer pays
    });

    testWidgets('brokers are listed cheapest first with the CDS note', (tester) async {
      await _launch(tester);
      await _openTool(tester, 'Stockbrokers');
      expect(find.text('Faida Investment Bank'), findsOneWidget);
      expect(find.text('1.80%'), findsOneWidget);
      expect(find.text('Needs a CDS account'), findsOneWidget);
    });
  });

  group('Models', () {
    test('portfolio parsing reads the consolidated view and the broker lots', () {
      final p = Portfolio.fromJson(_portfolio);
      expect(p.value, 2850);
      expect(p.gainPct, closeTo(42.5, 0.001));
      expect(p.positions.single.ticker, 'SCOM');
      expect(p.byBroker.single.holdingId, 'h1');
    });

    test('a profile maps its score onto the five radar axes', () {
      final r = InvestorProfile.fromJson({'type': 'growth', 'riskScore': 90, 'horizonYears': 10, 'capitalRange': '>2m'}).radar;
      expect(r['Growth'], 90);
      expect(r['Safety'], 10);
      expect(r['Income'], 26); // 80 - 90 * 0.6 = 26
    });

    test('forgiving parsing: nulls and strings do not throw', () {
      final a = Allocation.fromJson({'valueKes': '12.5', 'rows': [null, {'ticker': 'x', 'weightPct': null}]});
      expect(a.value, 12.5);
      expect(a.rows.single.ticker, 'X');
      expect(RebalancePlan.fromJson(null).trades, isEmpty);
    });
  });
}
