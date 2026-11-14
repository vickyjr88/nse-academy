import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/app.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/data/models/member.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:nse_academy/features/profile/account_screen.dart';
import 'package:nse_academy/features/push/push_controller.dart';
import 'package:nse_academy/features/push/push_gateway.dart';
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

class FakePush implements PushGateway {
  FakePush({this.isSupported = true, this.allow = true});
  final bool isSupported;
  final bool allow;
  final taps = StreamController<String>.broadcast();
  bool forgot = false;
  @override
  Future<bool> get supported async => isSupported;
  @override
  Future<bool> requestPermission() async => allow;
  @override
  Future<String?> token() async => 'fcm-token-0123456789abcdef0123456789';
  @override
  Future<void> forgetToken() async => forgot = true;
  @override
  Stream<String> get tokenRefreshed => const Stream.empty();
  @override
  Stream<String> get tapped => taps.stream;
  @override
  Future<String?> launchedFrom() async => null;
  @override
  Stream<void> get arrived => const Stream.empty();
}

/// What the fake adviser endpoints remember between calls.
class _Advisers {
  String? connection; // null | pending | accepted | declined
  bool adviserProfile = false;
  String approval = 'approved';
  int remaining = 1;
  final messages = <Map<String, dynamic>>[];
  final questions = <Map<String, dynamic>>[];
  final answers = <String>[];
}

final _amina = {'id': 'a1', 'headline': 'Certified financial planner', 'bio': 'I help Kenyans build dividend portfolios.', 'specialties': ['Dividend investing'], 'credentials': 'CFP', 'user': {'name': 'Amina Otieno'}};

/// What the fake organisation endpoints answer: `me` is the member's own row, null for no organisation.
class _Org {
  _Org(this.me);
  Map<String, dynamic>? me;
  final invited = <String>[];
  final accepted = <String>[];
  final removed = <String>[];
}

Map<String, dynamic> _orgRow({String role = 'member', bool accepted = true, String? token}) => {
      'id': 'om1',
      'role': role,
      'inviteAccepted': accepted,
      'inviteToken': token,
      'org': {'name': 'Mwalimu SACCO', 'license': {'tier': 'premium', 'seats': 5, 'seatsUsed': 2, 'status': 'active', 'currentPeriodEnd': '2027-06-01T00:00:00.000Z'}},
    };

/// A fake of the API and CMS for a member on [tier], with the calls the member screens make.
Future<http.Response> Function(http.Request) _server({String tier = 'premium', List<http.Request>? seen, bool hasProfile = false, _Advisers? adv, _Org? org}) {
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
    if (p == '/financial-advisors') return _json({'data': [_amina], 'total': 1, 'page': 1, 'limit': 20, 'totalPages': 1});
    if (p == '/financial-advisors/a1') return _json(_amina);
    if (adv != null && p.startsWith('/financial-advisor/')) {
      if (!ok) return _json({'message': 'Unauthorized'}, 401);
      if (p == '/financial-advisor/connections') return _json([if (adv.connection != null) {'id': 'c1', 'status': adv.connection, 'source': 'request', 'advisor': _amina}]);
      if (p == '/financial-advisor/connect/a1') {
        adv.connection = 'pending';
        return _json({'id': 'c1', 'status': 'pending'}, 201);
      }
      if (p == '/financial-advisor/queries/allowance') return _json({'tier': tier, 'limit': 1, 'used': 1 - adv.remaining, 'remaining': adv.remaining, 'unlimited': false, 'resetsOn': '2026-12-01T00:00:00.000Z'});
      if (p == '/financial-advisor/queries' && r.method == 'POST') {
        final body = jsonDecode(r.body) as Map<String, dynamic>;
        adv.remaining = 0;
        adv.messages.add({'id': 'm1', 'senderRole': 'client', 'body': body['question'], 'createdAt': '2026-11-14T09:00:00.000Z'});
        adv.questions.add({'id': 'q1', 'subject': body['question'], 'status': 'open', 'updatedAt': '2026-11-14T09:00:00.000Z', 'advisor': _amina, '_count': {'messages': 1}});
        return _json({'id': 'q1'}, 201);
      }
      if (p == '/financial-advisor/queries/mine') return _json(adv.questions);
      if (p == '/financial-advisor/queries/q1' && r.method == 'GET') return _json({'id': 'q1', 'subject': 'q', 'advisor': _amina, 'user': {'id': 'u1', 'name': 'Jane Doe'}, 'messages': adv.messages});
      if (p == '/financial-advisor/queries/q1/reply') {
        adv.messages.add({'id': 'm${adv.messages.length + 1}', 'senderRole': 'client', 'body': (jsonDecode(r.body) as Map)['body'], 'createdAt': '2026-11-14T10:00:00.000Z'});
        return _json({'id': 'q1'}, 201);
      }
      if (p == '/financial-advisor/insights/feed') return _json({'data': [{'id': 'i1', 'title': 'Why I like Safaricom', 'body': 'Strong cash flow and a growing dividend.', 'tickers': ['SCOM'], 'createdAt': '2026-11-13T09:00:00.000Z', 'advisor': _amina}], 'total': 1, 'page': 1, 'limit': 50, 'totalPages': 1});
      if (p == '/financial-advisor/me') return adv.adviserProfile ? _json({'id': 'a9', 'headline': 'Me', 'approvalStatus': adv.approval, 'isActive': true}) : http.Response('', 200);
      if (p == '/financial-advisor/clients') return _json([{'id': 'r1', 'status': 'pending', 'requestedAt': '2026-11-12T09:00:00.000Z', 'user': {'id': 'u7', 'name': 'Peter Kamau', 'email': 'p@example.com'}}]);
      if (p == '/financial-advisor/queries' && r.method == 'GET') return _json([{'id': 'q5', 'subject': 'Should I buy KCB?', 'status': 'open', 'updatedAt': '2026-11-14T08:00:00.000Z', 'user': {'id': 'u7', 'name': 'Peter Kamau'}, '_count': {'messages': 1}}]);
      if (p == '/financial-advisor/insights') return _json(<Object>[]);
    }
    if (org != null && p.startsWith('/corporate/')) {
      if (!ok) return _json({'message': 'Unauthorized'}, 401);
      if (p == '/corporate/me') return org.me == null ? http.Response('', 200) : _json(org.me!);
      if (p == '/corporate/invite/accept') {
        org.accepted.add((jsonDecode(r.body) as Map)['token'] as String);
        org.me = _orgRow();
        return _json({'success': true}, 201);
      }
      if (p == '/corporate/dashboard') {
        return _json({
          'name': 'Mwalimu SACCO',
          'license': (_orgRow()['org'] as Map)['license'],
          'members': [
            {'id': 'om1', 'role': 'admin', 'inviteAccepted': true, 'user': {'name': 'Jane Doe', 'email': 'jane@example.com'}},
            {'id': 'om2', 'role': 'member', 'inviteAccepted': false, 'user': {'name': 'Peter Kamau', 'email': 'peter@example.com'}},
          ],
        });
      }
      if (p == '/corporate/invite') {
        org.invited.add((jsonDecode(r.body) as Map)['email'] as String);
        return _json({'inviteLink': 'x'}, 201);
      }
      if (p == '/corporate/members/om2' && r.method == 'DELETE') {
        org.removed.add('om2');
        return _json({'success': true});
      }
    }
    if (p == '/devices') return !ok ? _json({'message': 'Unauthorized'}, 401) : _json({'registered': r.method == 'POST'});
    if (p == '/digest') return _json({'enabled': false});
    if (p == '/referrals/stats') return _json({'referralCode': 'JANE123', 'totalReferrals': 3, 'completedReferrals': 1, 'pendingReferrals': 2, 'freeMonthsEarned': 1});
    return http.Response('{"message":"not found"}', 404);
  };
}

Future<void> _launch(WidgetTester tester, {Future<http.Response> Function(http.Request)? server, bool signedIn = false, List<Override> overrides = const []}) async {
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
      ...overrides,
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

  group('Financial advisers', () {
    testWidgets('anyone can browse the directory and read a profile; connecting asks them to sign in', (tester) async {
      await _launch(tester, server: _server(tier: 'free', adv: _Advisers()));
      await _openTool(tester, 'Financial advisers');
      expect(find.text('Amina Otieno'), findsOneWidget);
      expect(find.textContaining('does not give investment advice'), findsOneWidget);
      await tester.tap(find.text('Amina Otieno'));
      await tester.pumpAndSettle();
      expect(find.text('Certified financial planner'), findsOneWidget);
      expect(find.text('Dividend investing'), findsOneWidget);
      expect(find.text('Sign in to connect'), findsOneWidget);
    });

    testWidgets('a member connects, then (once accepted) asks a question and replies in the thread', (tester) async {
      final adv = _Advisers();
      await _launch(tester, server: _server(tier: 'free', adv: adv), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      await tester.tap(find.text('Amina Otieno'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Request to connect'));
      await tester.pumpAndSettle();
      expect(adv.connection, 'pending');
      expect(find.textContaining('has not answered yet'), findsOneWidget);

      adv.connection = 'accepted';
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Amina Otieno'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ask a question'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1 of 1 question left this month on your free plan'), findsOneWidget);
      await tester.enterText(find.byType(TextField).last, 'Is SCOM a good dividend stock?');
      await tester.tap(find.text('Send question'));
      await tester.pumpAndSettle();
      expect(find.text('Is SCOM a good dividend stock?'), findsOneWidget); // now in the conversation
      await tester.pump(const Duration(seconds: 6)); // let any snack bar go
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, 'Thank you, and what about KCB?');
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(adv.messages.map((m) => m['body']), ['Is SCOM a good dividend stock?', 'Thank you, and what about KCB?']); // the server has both
      expect(find.text('Thank you, and what about KCB?'), findsOneWidget); // and the thread shows the reply, not the draft
      expect(tester.widget<TextField>(find.byType(TextField).last).controller!.text, isEmpty);
    });

    testWidgets('with no questions left the Send button is off and the sheet says so', (tester) async {
      final adv = _Advisers()
        ..connection = 'accepted'
        ..remaining = 0;
      await _launch(tester, server: _server(tier: 'free', adv: adv), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      await tester.tap(find.text('Amina Otieno'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ask a question'));
      await tester.pumpAndSettle();
      expect(find.textContaining('0 of 1 question left'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Send question')).onPressed, isNull);
    });

    testWidgets('insights from connected advisers are listed', (tester) async {
      await _launch(tester, server: _server(tier: 'free', adv: _Advisers()), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      await tester.tap(find.text('Insights'));
      await tester.pumpAndSettle();
      expect(find.text('Why I like Safaricom'), findsOneWidget);
      expect(find.text('SCOM'), findsOneWidget);
    });

    testWidgets('a member who is not an adviser sees no workspace', (tester) async {
      await _launch(tester, server: _server(tier: 'free', adv: _Advisers()), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      expect(find.text('My questions'), findsOneWidget);
      expect(find.text('Adviser workspace'), findsNothing);
    });

    testWidgets('an approved adviser gets the workspace with requests and client questions', (tester) async {
      final adv = _Advisers()..adviserProfile = true;
      await _launch(tester, server: _server(tier: 'free', adv: adv), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      await tester.tap(find.text('Adviser workspace'));
      await tester.pumpAndSettle();
      expect(find.text('Peter Kamau'), findsOneWidget);
      await tester.tap(find.text('Questions'));
      await tester.pumpAndSettle();
      expect(find.text('Should I buy KCB?'), findsOneWidget);
      expect(find.text('Needs answer'), findsOneWidget);
    });

    testWidgets('an adviser whose profile is not approved yet is told to wait', (tester) async {
      final adv = _Advisers()
        ..adviserProfile = true
        ..approval = 'pending';
      await _launch(tester, server: _server(tier: 'free', adv: adv), signedIn: true);
      await _openTool(tester, 'Financial advisers');
      await tester.tap(find.text('Adviser workspace'));
      await tester.pumpAndSettle();
      expect(find.text('Waiting for approval'), findsOneWidget);
    });
  });

  group('My organisation', () {
    Future<void> open(WidgetTester tester, _Org org) async {
      await _launch(tester, server: _server(tier: 'free', org: org), signedIn: true);
      await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Profile')).last);
      await tester.pumpAndSettle();
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -700));
      await tester.pumpAndSettle();
      await tester.tap(find.text('My organisation'));
      await tester.pumpAndSettle();
    }

    testWidgets('a member with no organisation is told how one is set up', (tester) async {
      await open(tester, _Org(null));
      expect(find.text('No organisation'), findsOneWidget);
    });

    testWidgets('an invitation can be accepted, and then shows the seat', (tester) async {
      final org = _Org(_orgRow(accepted: false, token: 'tok-123'));
      await open(tester, org);
      expect(find.text('Mwalimu SACCO invited you'), findsOneWidget);
      await tester.tap(find.text('Accept invitation'));
      await tester.pumpAndSettle();
      expect(org.accepted, ['tok-123']);
      expect(find.textContaining('Premium plan through your organisation until'), findsOneWidget);
    });

    testWidgets('an admin sees seats and people, can invite by email and remove a pending person', (tester) async {
      final org = _Org(_orgRow(role: 'admin'));
      await open(tester, org);
      expect(find.text('2 of 5'), findsOneWidget);
      expect(find.text('Peter Kamau'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Email'), 'amina@example.com');
      await tester.tap(find.text('Send invitation'));
      await tester.pumpAndSettle();
      expect(org.invited, ['amina@example.com']);
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Remove'));
      await tester.pumpAndSettle();
      expect(org.removed, ['om2']);
    });
  });

  group('Push notifications', () {
    Future<void> openAccount(WidgetTester tester) async {
      await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text('Profile')).last);
      await tester.pumpAndSettle();
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -700));
      await tester.pumpAndSettle();
      await tester.tap(find.text('My account'));
      await tester.pumpAndSettle();
    }

    testWidgets('where push cannot work the account page has no notification switch', (tester) async {
      await _launch(tester, server: _server(tier: 'free'), signedIn: true, overrides: [pushGatewayProvider.overrideWithValue(FakePush(isSupported: false))]);
      await openAccount(tester);
      expect(find.text('Notifications on this phone'), findsNothing);
    });

    testWidgets('turning notifications on registers this phone, and off removes it', (tester) async {
      final seen = <http.Request>[];
      final gw = FakePush();
      await _launch(tester, server: _server(tier: 'free', seen: seen), signedIn: true, overrides: [pushGatewayProvider.overrideWithValue(gw)]);
      await openAccount(tester);
      await tester.scrollUntilVisible(find.text('Notifications on this phone'), 200, scrollable: find.descendant(of: find.byType(AccountScreen), matching: find.byType(Scrollable)).first);
      await tester.ensureVisible(find.widgetWithText(SwitchListTile, 'Notifications on this phone'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SwitchListTile, 'Notifications on this phone'));
      await tester.pumpAndSettle();
      final reg = seen.firstWhere((r) => r.url.path == '/devices' && r.method == 'POST');
      expect(jsonDecode(reg.body), {'token': 'fcm-token-0123456789abcdef0123456789', 'platform': 'android'});
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SwitchListTile, 'Notifications on this phone'));
      await tester.pumpAndSettle();
      final del = seen.firstWhere((r) => r.url.path == '/devices' && r.method == 'DELETE');
      expect(del.url.queryParameters['token'], 'fcm-token-0123456789abcdef0123456789');
      expect(gw.forgot, isTrue);
    });

    testWidgets('if the member refuses the permission nothing is registered and they are told how to allow it', (tester) async {
      final seen = <http.Request>[];
      await _launch(tester, server: _server(tier: 'free', seen: seen), signedIn: true, overrides: [pushGatewayProvider.overrideWithValue(FakePush(allow: false))]);
      await openAccount(tester);
      await tester.scrollUntilVisible(find.text('Notifications on this phone'), 200, scrollable: find.descendant(of: find.byType(AccountScreen), matching: find.byType(Scrollable)).first);
      await tester.ensureVisible(find.widgetWithText(SwitchListTile, 'Notifications on this phone'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(SwitchListTile, 'Notifications on this phone'));
      await tester.pumpAndSettle();
      expect(seen.where((r) => r.url.path == '/devices'), isEmpty);
      expect(find.textContaining('blocked'), findsOneWidget);
    });

    testWidgets('tapping a notification opens the screen it names', (tester) async {
      final gw = FakePush();
      await _launch(tester, server: _server(tier: 'free', adv: _Advisers()), signedIn: true, overrides: [pushGatewayProvider.overrideWithValue(gw)]);
      gw.taps.add('/advisers/insights');
      await tester.pumpAndSettle();
      expect(find.text('Adviser insights'), findsOneWidget);
      expect(find.text('Why I like Safaricom'), findsOneWidget);
    });

    testWidgets('a notification that names a screen outside the member area is ignored', (tester) async {
      final gw = FakePush();
      await _launch(tester, server: _server(tier: 'free'), signedIn: true, overrides: [pushGatewayProvider.overrideWithValue(gw)]);
      gw.taps.add('/signin');
      await tester.pumpAndSettle();
      expect(find.text('Sign in'), findsNothing);
    });

    test('only the app\'s own member screens are allowed as a notification target', () {
      for (final ok in ['/tools/alerts', '/tools/portfolio', '/advisers', '/advisers/questions/q1', '/profile/account']) {
        expect(isAllowedPushRoute(ok), isTrue, reason: ok);
      }
      for (final bad in ['', '/signin', '/onboarding', 'https://evil.example', '//evil', '/toolsx']) {
        expect(isAllowedPushRoute(bad), isFalse, reason: bad);
      }
    });
  });
}
