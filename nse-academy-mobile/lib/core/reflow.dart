/// Lesson text in the CMS was pasted from a PDF: lines are hard-wrapped at about 100 characters and paragraphs are not
/// separated by blank lines. Shown as-is on a phone it breaks mid-sentence. This joins the wrapped lines back into
/// paragraphs (and turns short stand-alone lines into headings and bullets into a list) so it can be shown as Markdown.
///
/// The lesson's full title as it appears at the top of the text. The CMS title field of the same lesson is cut at about
/// 36 characters ("Why Invest in the Nairobi Securities"), while the body repeats it in full across its first lines.
String? leadingTitle(String raw) {
  final lines = raw.replaceAll('\r', '').split('\n').map((l) => l.trim()).toList();
  final lengths = lines.where((l) => l.isNotEmpty).map((l) => l.length).toList()..sort();
  if (lengths.isEmpty) return null;
  final wrap = lengths[(lengths.length * 0.9).floor().clamp(0, lengths.length - 1)];
  final firstFull = lines.indexWhere((l) => l.length >= wrap * 0.7);
  if (firstFull < 1 || firstFull > 4) return null;
  final t = lines.take(firstFull).where((l) => l.isNotEmpty).join(' ').trim();
  return t.isEmpty ? null : t;
}

/// A line ends a paragraph when it finishes a sentence and is clearly shorter than the wrap width, since only the last
/// line of a paragraph falls short. The text before the first real paragraph is the lesson's own title, which the app
/// already shows in its header, so it is dropped.
String reflowPlainText(String raw, {bool dropLeadingTitle = true}) {
  final lines = raw.replaceAll('\r', '').split('\n').map((l) => l.trim()).toList();
  final lengths = lines.where((l) => l.isNotEmpty).map((l) => l.length).toList()..sort();
  if (lengths.isEmpty) return '';
  final wrap = lengths[(lengths.length * 0.9).floor().clamp(0, lengths.length - 1)];

  // Drop the title block: lines until the first one that looks like the start of a full paragraph.
  var start = 0;
  if (dropLeadingTitle) {
    final firstFull = lines.indexWhere((l) => l.length >= wrap * 0.7);
    if (firstFull > 0 && firstFull <= 4) start = firstFull;
  }

  final bulletStart = RegExp(r'^([•▪●◦·]|[-*]\s|\d{1,2}[.)]\s)');
  bool endsSentence(String l) => RegExp(r'[.!?:”")\]]$').hasMatch(l);

  final out = <String>[];
  final buf = StringBuffer();
  var lastLine = '';
  void flush() {
    final t = buf.toString().trim();
    if (t.isNotEmpty) out.add(t);
    buf.clear();
  }

  for (var i = start; i < lines.length; i++) {
    final line = lines[i];
    if (line.isEmpty) {
      flush();
      continue;
    }
    final next = i + 1 < lines.length ? lines[i + 1] : '';
    final startsNew = bulletStart.hasMatch(line);
    if (startsNew) flush();

    // A short line with no sentence ending, between paragraphs, followed by a capitalised line: a heading.
    final words = line.split(' ').length;
    final canStartBlock = buf.isEmpty || endsSentence(lastLine);
    final isHeading = canStartBlock && !startsNew && words <= 9 && line.length < wrap * 0.6 && !RegExp(r'[.,;]$').hasMatch(line) && next.isNotEmpty && RegExp(r'^[A-Z0-9]').hasMatch(next);
    if (isHeading) {
      flush();
      out.add('### $line');
      lastLine = '';
      continue;
    }

    if (startsNew) {
      final item = line.replaceFirst(RegExp(r'^([•▪●◦·]|[-*]|\d{1,2}[.)])\s*'), '');
      out.add('- $item');
      continue;
    }
    if (buf.isNotEmpty) buf.write(' ');
    buf.write(line);
    lastLine = line;
    if (endsSentence(line) && line.length < wrap * 0.75) flush();
  }
  flush();

  // Adjacent list items belong to one list: single newline between them, a blank line elsewhere.
  final res = StringBuffer();
  for (var i = 0; i < out.length; i++) {
    if (i > 0) res.write(out[i].startsWith('- ') && out[i - 1].startsWith('- ') ? '\n' : '\n\n');
    res.write(out[i]);
  }
  return res.toString();
}
