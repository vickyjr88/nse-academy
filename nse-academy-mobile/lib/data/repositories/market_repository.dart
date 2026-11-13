import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/json_cache.dart';
import '../models/market_report.dart';
import '../models/stock.dart';

/// Prices and the daily market report from the NSE Academy API. Prices are delayed, never live.
class MarketRepository {
  MarketRepository(this._api, this._cache);
  final ApiClient _api;
  final JsonCache _cache;

  Uri _uri(String path, [Map<String, String>? q]) => Uri.parse('${AppConfig.apiBase}/$path').replace(queryParameters: q);

  Future<Cached<List<Quote>>> quotes({bool forceRefresh = false}) => _cache.load(
        key: 'quotes',
        ttl: const Duration(minutes: 5),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('public/market-data')),
        parse: parseQuotes,
      );

  Future<Cached<List<PricePoint>>> history(String ticker, {int days = 365, bool forceRefresh = false}) => _cache.load(
        key: 'history:${ticker.toUpperCase()}:$days',
        ttl: const Duration(minutes: 30),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('public/market-data/${Uri.encodeComponent(ticker.toUpperCase())}/history', {'days': '$days'})),
        parse: parseHistory,
      );

  Future<Cached<MarketReport>> latestReport({bool forceRefresh = false}) => _cache.load(
        key: 'report:latest',
        ttl: const Duration(minutes: 30),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('public/market-reports/latest')),
        parse: MarketReport.fromJson,
      );

  Future<void> refresh() async {
    await _cache.expire('quotes');
    await _cache.expire('history');
    await _cache.expire('report');
  }
}
