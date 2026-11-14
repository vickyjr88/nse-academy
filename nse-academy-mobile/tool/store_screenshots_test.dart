// ignore_for_file: invalid_use_of_visible_for_testing_member
// Captures the Play Store screenshots from the real app.
//
//   LIVE_CACHE=/some/dir flutter test tool/store_screenshots_test.dart
//
// The app runs against recorded copies of the live public API/CMS responses (never the network from inside the test).
// A request with no recording is logged to $LIVE_CACHE/_misses.txt as "<file>\t<url>"; tool/fetch_live.py downloads those
// and the test is run again. PNGs land in store/screens/raw.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/app.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:nse_academy/router.dart';
import 'package:nse_academy/state/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _name(Uri u) {
  var h = 0xcbf29ce484222325;
  for (final c in u.toString().codeUnits) {
    h = ((h ^ c) * 0x100000001b3) & 0x7fffffffffffffff;
  }
  return h.toRadixString(16);
}

final String _cache = Platform.environment['LIVE_CACHE'] ?? (throw StateError('set LIVE_CACHE'));

Future<http.Response> _serve(http.Request r) async {
  final f = File('$_cache/${_name(r.url)}.json');
  if (f.existsSync()) {
    return http.Response.bytes(f.readAsBytesSync(), 200, headers: {'content-type': 'application/json; charset=utf-8'});
  }
  File('$_cache/_misses.txt').writeAsStringSync('${_name(r.url)}\t${r.url}\n', mode: FileMode.append);
  return http.Response('{"message":"not recorded"}', 404);
}


// ---- a sample Premium member, for the screenshots of the signed-in features (clearly invented numbers)

http.Response _j(Object o) => http.Response(jsonEncode(o), 200, headers: {'content-type': 'application/json; charset=utf-8'});

({String t, String n, int q, double cost, double px}) _lot(String t, String n, int q, double cost, double px) => (t: t, n: n, q: q, cost: cost, px: px);
final _book = [_lot('SCOM', 'Safaricom PLC', 1200, 17.40, 28.50), _lot('EQTY', 'Equity Group Holdings', 400, 44.00, 58.25), _lot('KCB', 'KCB Group', 350, 38.50, 41.00), _lot('EABL', 'East African Breweries', 60, 142.00, 168.00), _lot('KPLC', 'Kenya Power & Lighting', 2000, 1.95, 2.60)];

Future<http.Response> _member(http.Request r) async {
  if (r.headers['Authorization'] != 'Bearer shot') return _serve(r);
  final p = r.url.path;
  final value = _book.fold<double>(0, (a, x) => a + x.q * x.px);
  final cost = _book.fold<double>(0, (a, x) => a + x.q * x.cost);
  if (p == '/users/me') {
    return _j({'id': 'u1', 'email': 'sample@example.com', 'name': 'Wanjiru Kamau', 'effectiveTier': 'premium', 'subscription': {'tier': 'premium', 'currentPeriodEnd': '2027-01-12T00:00:00.000Z'}, 'investorProfile': {'type': 'dividend', 'riskScore': 40, 'horizonYears': 5, 'capitalRange': '100k-500k', 'isPublic': false}});
  }
  if (p == '/payments/status') return _j({'effectiveTier': 'premium', 'tier': 'premium'});
  if (p == '/notifications/unread-count') return _j({'count': 2});
  if (p == '/journal/portfolio') {
    return _j({
      'positions': [],
      'consolidated': [for (final x in _book) {'ticker': x.t, 'companyName': x.n, 'quantity': x.q, 'avgCost': x.cost, 'costEstimated': false, 'costBasisKes': x.q * x.cost, 'currentPrice': x.px, 'marketValueKes': x.q * x.px, 'unrealizedGainKes': x.q * (x.px - x.cost)}],
      'totalCostBasisKes': cost,
      'totalMarketValueKes': value,
      'totalUnrealizedGainKes': value - cost,
    });
  }
  if (p == '/portfolio-watch') {
    return _j({'enabled': true, 'result': {'valueKes': value, 'dayChangeKes': 1430.0, 'dayChangePct': 1.67}, 'fresh': [{'kind': 'TAKE_PROFIT', 'ticker': 'SCOM', 'key': 'a', 'text': 'SCOM is 64% above what you paid. Consider whether to take some profit.'}, {'kind': 'CONCENTRATION', 'ticker': 'SCOM', 'key': 'b', 'text': 'SCOM is 39% of your portfolio.'}]});
  }
  return http.Response('{"message":"not found"}', 404);
}

const _w = 1080.0, _h = 1920.0, _dpr = 2.75;
final _key = GlobalKey();

Future<void> _launch(WidgetTester tester, {bool dark = false, String? goTo, bool member = false}) async {
  debugDisableShadows = false; // flutter_test paints shadows as solid black unless told otherwise (reset in _shot)
  SharedPreferences.setMockInitialValues({
    'flutter.settings': '{"onboarded":true,"level":"basics","interests":["analysis"],"theme":"${dark ? 'dark' : 'light'}"}',
  });
  final sp = await SharedPreferences.getInstance();
  tester.view
    ..physicalSize = const Size(_w, _h)
    ..devicePixelRatio = _dpr
    ..padding = const FakeViewPadding(top: 30 * _dpr, bottom: 18 * _dpr)
    ..viewPadding = const FakeViewPadding(top: 30 * _dpr, bottom: 18 * _dpr);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(RepaintBoundary(
    key: _key,
    child: ProviderScope(
      retry: (_, _) => null,
      overrides: [
        sharedPrefsProvider.overrideWithValue(sp),
        apiClientProvider.overrideWithValue(ApiClient(client: MockClient(member ? _member : _serve))),
        tokenStoreProvider.overrideWithValue(member ? (MemoryTokenStore()..write('shot')) : MemoryTokenStore()),
      ],
      child: const NseAcademyApp(),
    ),
  ));
  await tester.pumpAndSettle();
  if (goTo != null) await _go(tester, goTo);
}

Future<void> _go(WidgetTester tester, String path) async {
  ProviderScope.containerOf(tester.element(find.byType(NseAcademyApp))).read(routerProvider).go(path);
  // Let the network futures (mock) resolve, then animations.
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
  await tester.pumpAndSettle();
}

Future<void> _shot(WidgetTester tester, String name) async {
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
  await tester.pumpAndSettle();
  await tester.runAsync(() async {
    final b = _key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image img = await b.toImage(pixelRatio: _dpr);
    final bytes = (await img.toByteData(format: ui.ImageByteFormat.png))!;
    final out = File('store/screens/raw/$name.png')..createSync(recursive: true);
    out.writeAsBytesSync(bytes.buffer.asUint8List());
  });
  debugDisableShadows = true;
}

/// flutter_test draws every glyph as a block unless the fonts are loaded by hand.
Future<void> _loadFonts() async {
  Future<void> family(String name, List<String> paths) async {
    final l = FontLoader(name);
    for (final p in paths) {
      l.addFont(Future.value(ByteData.sublistView(File(p).readAsBytesSync())));
    }
    await l.load();
  }

  const w = ['500', '600', '700', '800'];
  await family('PlusJakartaSans', [for (final x in w) 'assets/fonts/PlusJakartaSans-$x.ttf']);
  await family('Inter', [for (final x in ['400', '500', '600', '700']) 'assets/fonts/Inter-$x.ttf']);
  await family('JetBrainsMono', [for (final x in ['400', '500', '600', '700']) 'assets/fonts/JetBrainsMono-$x.ttf']);
  final root = Platform.environment['FLUTTER_ROOT']!;
  await family('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
}

void main() {
  setUpAll(_loadFonts);
  final course = Platform.environment['COURSE_ID'] ?? '1';
  final lesson = Platform.environment['LESSON_ID'] ?? '1';
  final ticker = Platform.environment['TICKER'] ?? 'SCOM';

  testWidgets('home', (t) async {
    await _launch(t);
    await _shot(t, '01-home');
  });
  testWidgets('learn', (t) async {
    await _launch(t, goTo: '/learn');
    await _shot(t, '02-learn');
  });
  testWidgets('course', (t) async {
    await _launch(t, goTo: '/course/$course');
    await _shot(t, '03-course');
  });
  testWidgets('lesson', (t) async {
    await _launch(t, goTo: '/lesson/$course/$lesson');
    await _shot(t, '04-lesson');
  });
  testWidgets('stocks', (t) async {
    await _launch(t, goTo: '/stocks');
    await _shot(t, '05-stocks');
  });
  testWidgets('stock detail', (t) async {
    await _launch(t, goTo: '/stock/$ticker');
    await _shot(t, '06-stock');
  });
  testWidgets('glossary', (t) async {
    await _launch(t, goTo: '/glossary');
    await _shot(t, '07-glossary');
  });
  testWidgets('home dark', (t) async {
    await _launch(t, dark: true);
    await _shot(t, '08-home-dark');
  });
  testWidgets('tools', (t) async {
    await _launch(t, goTo: '/tools', member: true);
    await _shot(t, '09-tools');
  });
  testWidgets('investor profile', (t) async {
    await _launch(t, goTo: '/tools/profiler', member: true);
    await _shot(t, '10-profile');
  });
  testWidgets('portfolio', (t) async {
    await _launch(t, goTo: '/tools/portfolio', member: true);
    await _shot(t, '11-portfolio');
  });
}
