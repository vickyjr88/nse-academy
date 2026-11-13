class MarketLesson {
  const MarketLesson(this.title, this.body);
  final String title;
  final String body;
}

class MarketBreadth {
  const MarketBreadth({required this.advancers, required this.decliners, required this.unchanged, required this.traded});
  final int advancers;
  final int decliners;
  final int unchanged;
  final int traded;
}

/// The latest published daily market report (the same one the website shows), reduced to what the app displays.
class MarketReport {
  const MarketReport({required this.sessionYmd, required this.label, required this.headline, required this.summary, required this.url, required this.lessons, this.breadth, this.valueTradedKes});
  final String sessionYmd;
  final String label;
  final String headline;
  final String summary;
  final String url;
  final List<MarketLesson> lessons;
  final MarketBreadth? breadth;
  final double? valueTradedKes;

  factory MarketReport.fromJson(dynamic json) {
    final m = (json as Map).cast<String, dynamic>();
    final facts = (m['facts'] as Map?)?.cast<String, dynamic>();
    final b = (facts?['breadth'] as Map?)?.cast<String, dynamic>();
    return MarketReport(
      sessionYmd: m['sessionYmd'] as String? ?? '',
      label: m['label'] as String? ?? '',
      headline: m['headline'] as String? ?? '',
      summary: m['summary'] as String? ?? '',
      url: m['url'] as String? ?? '',
      lessons: ((m['lessons'] as List?) ?? const []).map((e) {
        final l = (e as Map).cast<String, dynamic>();
        return MarketLesson(l['title'] as String? ?? '', l['body'] as String? ?? '');
      }).toList(),
      breadth: b == null ? null : MarketBreadth(advancers: (b['advancers'] as num?)?.toInt() ?? 0, decliners: (b['decliners'] as num?)?.toInt() ?? 0, unchanged: (b['unchanged'] as num?)?.toInt() ?? 0, traded: (b['traded'] as num?)?.toInt() ?? 0),
      valueTradedKes: (facts?['valueTradedKes'] as num?)?.toDouble(),
    );
  }
}
