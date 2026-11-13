import 'article.dart';

class GlossaryTerm {
  const GlossaryTerm({required this.term, required this.definition, this.example});
  final String term;
  final String definition;
  final String? example;

  /// The first letter shown in the A-Z index.
  String get letter {
    final c = term.trim().isEmpty ? '#' : term.trim()[0].toUpperCase();
    return RegExp(r'[A-Z]').hasMatch(c) ? c : '#';
  }

  factory GlossaryTerm.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    final ex = (a['example'] as String?)?.trim();
    return GlossaryTerm(
      term: (a['term'] as String? ?? '').trim(),
      definition: (a['definition'] as String? ?? '').trim(),
      example: ex == null || ex.isEmpty ? null : ex,
    );
  }

  Map<String, dynamic> toJson() => {'term': term, 'definition': definition, 'example': example};

  /// Some entries in the CMS were imported cut in the middle of a sentence: the "term" is a fragment such as "(IPO)"
  /// and the definition starts mid-sentence. They would read as nonsense, so they are left out until fixed at source.
  bool get isUsable {
    if (term.isEmpty || definition.length < 12) return false;
    if (!RegExp(r'^[A-Za-z0-9]').hasMatch(term)) return false;
    if (!RegExp(r'^[A-Z0-9"“(]').hasMatch(definition)) return false;
    return true;
  }
}

List<GlossaryTerm> parseGlossary(dynamic json) {
  final data = ((json as Map)['data'] as List?) ?? const [];
  final terms = data.map((e) => GlossaryTerm.fromJson((e as Map).cast<String, dynamic>())).where((t) => t.isUsable).toList();
  terms.sort((a, b) => a.term.toLowerCase().compareTo(b.term.toLowerCase()));
  return terms;
}
