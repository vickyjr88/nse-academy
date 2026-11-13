import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/app.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:nse_academy/state/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';

http.Response _json(String body) => http.Response(body, 200, headers: {'content-type': 'application/json; charset=utf-8'});

/// Serves the fixtures the way the CMS and the API would.
Future<http.Response> _server(http.Request r, {bool offline = false}) async {
  if (offline) throw http.ClientException('offline');
  final p = r.url.path;
  final q = r.url.queryParameters;
  if (p == '/api/articles') return _json(q.containsKey(r'filters[slug][$eq]') ? articleBodyJson : articlesJson);
  if (p == '/api/glossary-terms') return _json(glossaryJson);
  if (p == '/api/stock-profiles') return _json(profilesJson);
  if (p == '/api/courses') return _json(coursesJson);
  if (p == '/api/lessons') return _json(lessonJson(int.parse(q[r'filters[id][$eq]']!)));
  if (p == '/public/market-data') return _json(quotesJson);
  if (p.startsWith('/public/market-data/') && p.endsWith('/history')) return _json(historyJson(p.split('/')[3]));
  if (p == '/public/market-reports/latest') return _json(reportJson);
  return http.Response('{"message":"not found"}', 404);
}

Future<void> _launch(WidgetTester tester, {Map<String, Object> prefs = const {}, bool offline = false}) async {
  SharedPreferences.setMockInitialValues(prefs);
  final sp = await SharedPreferences.getInstance();
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: [
      sharedPrefsProvider.overrideWithValue(sp),
      apiClientProvider.overrideWithValue(ApiClient(client: MockClient((r) => _server(r, offline: offline)))),
      tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
    ],
    child: const NseAcademyApp(),
  ));
  await tester.pumpAndSettle();
}

const _onboarded = {'flutter.settings': '{"onboarded":true,"level":"basics","interests":["analysis"],"theme":"light"}'};

Future<void> _tab(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byType(InkResponse), matching: find.text(label)).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('first launch walks through onboarding and lands on Home', (tester) async {
    await _launch(tester);
    expect(find.text('Welcome to\nNSE Academy'), findsOneWidget);
    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();
    expect(find.text('How familiar are you with stock investing?'), findsOneWidget);
    await tester.tap(find.text('I know the basics'));
    await tester.pumpAndSettle();
    expect(find.text('What interests you most?'), findsOneWidget);
    await tester.tap(find.text('Market Analysis'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text("You're all set!"), findsOneWidget);
    expect(find.text('Start as Learner'), findsOneWidget);
    expect(find.textContaining('article'), findsWidgets); // "N articles ready for you" from the real category counts
    await tester.tap(find.text('Enter NSE Academy'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Investor!'), findsOneWidget);
    expect(find.text('Market Snapshot'), findsOneWidget);
  });

  testWidgets('Home shows the market tip, the busiest stocks, featured articles and a quiz', (tester) async {
    await _launch(tester, prefs: _onboarded);
    expect(find.textContaining('One stock can dominate'), findsOneWidget); // today's lesson from the market report
    expect(find.text('SCOM'), findsOneWidget);
    expect(find.text('28.50'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Featured Articles'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('Green Friday'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Quick Quiz'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('A)'), findsOneWidget);
  });

  testWidgets('answering the quick quiz shows whether it was right, with the explanation, and keeps the answer', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await tester.scrollUntilVisible(find.text('Quick Quiz'), 300, scrollable: find.byType(Scrollable).first);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(find.text('A)').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('A new question tomorrow'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsWidgets);
  });

  testWidgets('Stocks lists every listed company, filters by sector and searches', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Stocks');
    expect(find.text('4 Listed Companies'), findsOneWidget);
    expect(find.text('Safaricom PLC'), findsOneWidget); // the profile's name
    expect(find.text('Kenya Re'), findsOneWidget); // no profile: the feed's name
    expect(find.text('Advancers'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Banking'));
    await tester.pumpAndSettle();
    expect(find.text('1 Listed Company'), findsOneWidget);
    expect(find.text('KCB Group PLC'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, 'All'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Search'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'kenya re');
    await tester.pumpAndSettle();
    expect(find.text('1 Listed Company'), findsOneWidget);
    expect(find.text('Kenya Re'), findsOneWidget);
  });

  testWidgets('a stock opens with its price, chart ranges, metrics and glossary links', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Stocks');
    await tester.tap(find.text('Safaricom PLC'));
    await tester.pumpAndSettle();
    expect(find.text('KES 28.50'), findsOneWidget);
    expect(find.text('Key Metrics'), findsOneWidget);
    expect(find.text('1M'), findsOneWidget);
    await tester.tap(find.text('3M'));
    await tester.pumpAndSettle();
    expect(find.textContaining('days of price history'), findsOneWidget); // we only have 39 days of fixture history
    expect(find.text('5.2%'), findsOneWidget); // dividend yield
    await tester.tap(find.text('Dividend yield'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Annual dividend per share divided by the share price'), findsOneWidget);
  });

  testWidgets('the glossary hides malformed entries and opens a term with related terms', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Glossary');
    expect(find.text('Bear Market'), findsOneWidget);
    expect(find.text('(IPO)'), findsNothing);
    expect(find.text('(P/E)'), findsNothing);
    await tester.tap(find.text('Bull Market'));
    await tester.pumpAndSettle();
    expect(find.text('Related terms'), findsOneWidget); // its definition mentions "Bear Market"
    expect(find.widgetWithText(ActionChip, 'Bear Market'), findsOneWidget);
    await tester.tap(find.widgetWithText(ActionChip, 'Bear Market'));
    await tester.pumpAndSettle();
    expect(find.text('The NSE entered a bear market in 2022.'), findsOneWidget); // the example
  });

  testWidgets('Learn shows the courses and article categories with counts', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Learn');
    expect(find.textContaining("The Complete Investor's Guide"), findsOneWidget);
    expect(find.text('NSE Complete Trading Guide'), findsOneWidget);
    expect(find.textContaining('chapters · '), findsWidgets);
    expect(find.text('Browse by Category'), findsOneWidget);
    expect(find.text('Daily Update'), findsOneWidget);
  });

  testWidgets('a Free member gets the first three chapters of the investor\'s guide and an upgrade prompt for the rest', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Learn');
    await tester.tap(find.textContaining("The Complete Investor's Guide"));
    await tester.pumpAndSettle();
    expect(find.textContaining('first 3 chapters are free'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Locked · 1 lessons'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Locked · 1 lessons'), findsOneWidget); // chapter 4
    expect(find.text('0 / 1 lessons'), findsWidgets);
    await tester.tap(find.text('Start the first lesson'));
    await tester.pumpAndSettle();
    expect(find.text('Lesson 1 of 4'), findsOneWidget);
    expect(find.textContaining("The Nairobi Securities Exchange (NSE) is Kenya's premier marketplace"), findsOneWidget);
    expect(find.text('Key Takeaways'), findsOneWidget); // re-flowed into a heading
  });

  testWidgets('the trading guide is locked for a Free member', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Learn');
    await tester.tap(find.text('NSE Complete Trading Guide'));
    await tester.pumpAndSettle();
    expect(find.text('Intermediary course'), findsOneWidget);
    expect(find.text('See plans'), findsNothing); // the Play build does not steer members to a purchase on the website
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('an article opens, can be bookmarked, and the bookmark appears on Profile', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await tester.tap(find.byTooltip('Search'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'CDS');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(find.text('ARTICLES'), findsOneWidget);
    await tester.tap(find.textContaining('How to Open a CDS Account').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('A CDS account holds your shares electronically.'), findsOneWidget);
    expect(find.text('Related Articles'), findsNothing);
    await tester.tap(find.byTooltip('Bookmark'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Saved to bookmarks'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    await _tab(tester, 'Profile');
    expect(find.text('How to Open a CDS Account'), findsOneWidget);
    expect(find.text('Learner level'), findsOneWidget);
  });

  testWidgets('Profile lets the member switch to dark mode', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Profile');
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();
    final ctx = tester.element(find.byType(Scaffold).first);
    expect(Theme.of(ctx).brightness, Brightness.dark);
  });

  testWidgets('with no network and nothing saved, Stocks says you are offline and offers to retry', (tester) async {
    await _launch(tester, prefs: _onboarded, offline: true);
    await _tab(tester, 'Stocks');
    expect(find.text('You are offline'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('the sign-in form checks the email before it calls the server', (tester) async {
    await _launch(tester, prefs: _onboarded);
    await _tab(tester, 'Profile');
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -900));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
  });
}
