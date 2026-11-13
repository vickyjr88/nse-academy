import 'package:intl/intl.dart';

final _price = NumberFormat('#,##0.00', 'en_KE');
final _int = NumberFormat('#,##0', 'en_KE');

String formatPrice(double v) => _price.format(v);
String formatKes(double v) => 'KES ${formatPrice(v)}';
String formatInt(num v) => _int.format(v);

/// 12300000 -> "12.3M", 4500 -> "4.5K".
String compactNumber(num v) {
  final a = v.abs();
  if (a >= 1e9) return '${_trim(v / 1e9)}B';
  if (a >= 1e6) return '${_trim(v / 1e6)}M';
  if (a >= 1e3) return '${_trim(v / 1e3)}K';
  return formatInt(v);
}

String _trim(double v) => v.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '');

String signedPct(double v) => '${v > 0 ? '+' : ''}${v.toStringAsFixed(2)}%';
String signedNum(double v) => '${v > 0 ? '+' : ''}${v.toStringAsFixed(2)}';

String formatDate(DateTime d) => DateFormat('MMM d, yyyy').format(d.toLocal());
String formatShortDate(DateTime d) => DateFormat('d MMM').format(d.toLocal());

/// "Good morning" / "afternoon" / "evening" in the device's local time.
String greetingFor(DateTime now) {
  final h = now.hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

String yyyyMmDd(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

/// The CMS stores excerpts and summaries as Markdown. Cards show plain text.
String stripMarkdown(String s) {
  var t = s;
  t = t.replaceAll(RegExp(r'```[\s\S]*?```'), ' ');
  t = t.replaceAll(RegExp(r'!\[[^\]]*\]\([^)]*\)'), ' ');
  t = t.replaceAllMapped(RegExp(r'\[([^\]]+)\]\([^)]*\)'), (m) => m.group(1)!);
  t = t.replaceAll(RegExp(r'^\s{0,3}#{1,6}\s*', multiLine: true), '');
  t = t.replaceAll(RegExp(r'^\s{0,3}>\s?', multiLine: true), '');
  t = t.replaceAll(RegExp(r'^\s*[-*+]\s+', multiLine: true), '');
  t = t.replaceAll(RegExp(r'^\s*\d+\.\s+', multiLine: true), '');
  t = t.replaceAll(RegExp(r'[*_`~|]+'), '');
  t = t.replaceAll(RegExp(r'\s+'), ' ').trim();
  return t;
}

/// A short, clean card blurb: stripped, cut at a word boundary.
String blurb(String s, {int max = 140}) {
  final t = stripMarkdown(s);
  if (t.length <= max) return t;
  final cut = t.substring(0, max);
  final space = cut.lastIndexOf(' ');
  return '${(space > max * 0.6 ? cut.substring(0, space) : cut).trimRight()}…';
}
