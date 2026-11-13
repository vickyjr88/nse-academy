import 'article.dart';

enum RiskLevel { low, medium, high }

class StockProfile {
  const StockProfile({required this.ticker, required this.companyName, required this.sector, required this.description, this.dividendYield, this.risk = RiskLevel.medium});
  final String ticker;
  final String companyName;
  final String sector;
  final String description;
  final double? dividendYield;
  final RiskLevel risk;

  factory StockProfile.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    return StockProfile(
      ticker: (a['ticker'] as String? ?? '').toUpperCase(),
      companyName: a['company_name'] as String? ?? '',
      sector: a['sector'] as String? ?? '',
      description: a['description'] as String? ?? '',
      dividendYield: (a['dividend_yield'] as num?)?.toDouble(),
      risk: switch (a['risk_level']) { 'low' => RiskLevel.low, 'high' => RiskLevel.high, _ => RiskLevel.medium },
    );
  }
}

List<StockProfile> parseProfiles(dynamic json) => (((json as Map)['data'] as List?) ?? const []).map((e) => StockProfile.fromJson((e as Map).cast<String, dynamic>())).where((p) => p.ticker.isNotEmpty).toList();

class Quote {
  const Quote({required this.ticker, required this.name, required this.price, required this.changePct, required this.volume, this.updatedAt});
  final String ticker;
  final String name;
  final double price;
  final double changePct;
  final double volume;
  final DateTime? updatedAt;

  /// Value traded, used to find the busiest stocks.
  double get valueTraded => price * volume;

  factory Quote.fromJson(Map<String, dynamic> m) => Quote(
        ticker: (m['ticker'] as String? ?? '').toUpperCase(),
        name: m['name'] as String? ?? '',
        price: (m['price'] as num?)?.toDouble() ?? 0,
        changePct: (m['changePct'] as num?)?.toDouble() ?? 0,
        volume: (m['volume'] as num?)?.toDouble() ?? 0,
        updatedAt: DateTime.tryParse(m['updatedAt'] as String? ?? ''),
      );
}

List<Quote> parseQuotes(dynamic json) => (json as List).map((e) => Quote.fromJson((e as Map).cast<String, dynamic>())).where((q) => q.ticker.isNotEmpty && q.price > 0).toList();

/// A listed company: its latest price joined with what we know about it.
class Stock {
  const Stock({required this.ticker, required this.name, required this.price, required this.changePct, required this.volume, this.sector, this.description, this.dividendYield, this.risk, this.updatedAt});
  final String ticker;
  final String name;
  final double price;
  final double changePct;
  final double volume;
  final String? sector;
  final String? description;
  final double? dividendYield;
  final RiskLevel? risk;
  final DateTime? updatedAt;

  bool get isUp => changePct > 0;
  bool get isDown => changePct < 0;

  /// The price a day earlier, worked back from today's percentage change.
  double get previousClose => changePct <= -100 ? price : price / (1 + changePct / 100);
  double get changeAbs => price - previousClose;
  double get valueTraded => price * volume;
}

/// Prices are the source of truth for what is listed; profiles add the sector, description and dividend yield.
List<Stock> mergeStocks(List<Quote> quotes, List<StockProfile> profiles) {
  final by = {for (final p in profiles) p.ticker: p};
  final out = quotes.map((q) {
    final p = by[q.ticker];
    return Stock(
      ticker: q.ticker,
      name: (p != null && p.companyName.isNotEmpty) ? p.companyName : q.name,
      price: q.price,
      changePct: q.changePct,
      volume: q.volume,
      sector: (p != null && p.sector.isNotEmpty) ? p.sector : null,
      description: (p != null && p.description.isNotEmpty) ? p.description : null,
      dividendYield: p?.dividendYield,
      risk: p?.risk,
      updatedAt: q.updatedAt,
    );
  }).toList();
  out.sort((a, b) => a.ticker.compareTo(b.ticker));
  return out;
}

class PricePoint {
  const PricePoint(this.date, this.price);
  final DateTime date;
  final double price;
}

List<PricePoint> parseHistory(dynamic json) => (((json as Map)['points'] as List?) ?? const []).map((e) {
      final m = (e as Map).cast<String, dynamic>();
      return PricePoint(DateTime.parse(m['date'] as String), (m['price'] as num).toDouble());
    }).toList();

enum ChartRange {
  week('1W', 7),
  month('1M', 30),
  quarter('3M', 90),
  half('6M', 180),
  year('1Y', 365);

  const ChartRange(this.label, this.days);
  final String label;
  final int days;
}

/// The points of a series that fall inside the range, ending at its last point.
List<PricePoint> sliceRange(List<PricePoint> all, ChartRange range) {
  if (all.isEmpty) return const [];
  final cutoff = all.last.date.subtract(Duration(days: range.days));
  final out = all.where((p) => !p.date.isBefore(cutoff)).toList();
  return out.length >= 2 ? out : all.length >= 2 ? all.sublist(all.length - 2) : all;
}
