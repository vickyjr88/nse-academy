import 'package:flutter_test/flutter_test.dart';
import 'package:nse_academy/core/reflow.dart';

import 'fixtures.dart';

void main() {
  test('joins hard-wrapped PDF lines back into paragraphs and drops the lesson title block', () {
    final out = reflowPlainText(lessonBodyText);
    final paragraphs = out.split('\n\n');
    expect(out, isNot(contains('Why Invest in the Nairobi Securities')));
    expect(paragraphs.first, startsWith("The Nairobi Securities Exchange (NSE) is Kenya's premier marketplace"));
    // The first paragraph is one unbroken block, not four short lines.
    expect(paragraphs.first, isNot(contains('\n')));
    expect(paragraphs.first, endsWith('available to Kenyan investors.'));
    expect(paragraphs[1], startsWith('Consider the numbers.'));
    expect(paragraphs[1], contains('crossed KSh 2.9 trillion'));
  });

  test('turns a short stand-alone line into a heading and bullets into a list', () {
    final out = reflowPlainText(lessonBodyText);
    expect(out, contains('### Key Takeaways'));
    expect(out, contains('- Diversify across sectors\n- Invest regularly'));
  });

  test('recovers the full lesson title the CMS cut short', () {
    expect(leadingTitle(lessonBodyText), 'Why Invest in the Nairobi Securities Exchange?');
    expect(leadingTitle('Just one short line.'), isNull);
    expect(leadingTitle(''), isNull);
  });

  test('copes with empty and single-line input', () {
    expect(reflowPlainText(''), '');
    expect(reflowPlainText('Just one short line.'), 'Just one short line.');
  });

  test('keeps blank-line paragraph breaks it is given', () {
    final out = reflowPlainText('First paragraph that is long enough to look like a real wrapped line of text here.\n\nSecond paragraph.');
    expect(out.split('\n\n'), hasLength(2));
  });
}
