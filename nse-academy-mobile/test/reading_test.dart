import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:nse_academy/core/theme.dart';
import 'package:nse_academy/widgets/reading.dart';

Widget _app(Widget child) => MaterialApp(theme: buildTheme(Brightness.light), home: child);

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('does not count a page as read while its text is still loading', (tester) async {
    final seen = <double>[];
    Widget page({required bool ready}) => _app(ReadingScaffold(title: 'T', ready: ready, onProgress: seen.add, children: [if (ready) for (var i = 0; i < 80; i++) Text('line $i') else const CircularProgressIndicator()]));

    await tester.pumpWidget(page(ready: false));
    await tester.pump();
    expect(seen, isEmpty); // only a spinner is on screen: nothing was read

    await tester.pumpWidget(page(ready: true));
    await tester.pump();
    await tester.pump();
    expect(seen.where((p) => p >= 0.98), isEmpty); // a long text, not yet scrolled
    await tester.drag(find.byType(ListView), const Offset(0, -10000));
    await tester.pumpAndSettle();
    expect(seen.last, greaterThanOrEqualTo(0.98)); // scrolled to the end: read
  });

  testWidgets('reports the seconds spent reading when the screen closes', (tester) async {
    var reported = -1;
    await tester.pumpWidget(_app(ReadingScaffold(title: 'T', onReadSeconds: (s) => reported = s, children: const [Text('x')])));
    await tester.pumpWidget(_app(const SizedBox())); // the screen is closed
    expect(reported, greaterThanOrEqualTo(0));
  });
}
