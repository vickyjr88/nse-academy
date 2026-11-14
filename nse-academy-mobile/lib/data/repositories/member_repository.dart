import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/json_cache.dart';
import '../models/member.dart';
import 'auth_repository.dart';

Uri _uri(String path, [Map<String, String>? q]) => Uri.parse('${AppConfig.apiBase}/$path').replace(queryParameters: q);

/// The signed-in features. Every call carries the member's token; the server decides what their plan allows and answers
/// 403 for the rest, which the screens show as a locked feature rather than an error.
class MemberRepository {
  MemberRepository(this._api, this._tokens);
  final ApiClient _api;
  final TokenStore _tokens;

  Future<Map<String, String>> _auth() async {
    final t = await _tokens.read();
    if (t == null) throw ApiException('Sign in to use this.', statusCode: 401);
    return {'Authorization': 'Bearer $t'};
  }

  Future<dynamic> _get(String path, [Map<String, String>? q]) async => _api.getJson(_uri(path, q), headers: await _auth());
  Future<dynamic> _post(String path, [Map<String, dynamic> body = const {}]) async => _api.postJson(_uri(path), body, headers: await _auth());
  Future<dynamic> _put(String path, Map<String, dynamic> body) async => _api.putJson(_uri(path), body, headers: await _auth());
  Future<dynamic> _patch(String path, Map<String, dynamic> body) async => _api.patchJson(_uri(path), body, headers: await _auth());
  Future<dynamic> _delete(String path) async => _api.deleteJson(_uri(path), headers: await _auth());

  // account
  Future<Account> account() async => Account.fromJson(await _get('users/me'));
  Future<void> updateAccount({String? name, String? phone}) => _patch('users/me', {'name': ?name, 'phone': ?phone});
  Future<bool> digestEnabled() async => (await _get('digest') as Map)['enabled'] == true;
  Future<bool> setDigest(bool on) async => (await _put('digest', {'enabled': on}) as Map)['enabled'] == true;
  Future<ReferralStats> referrals() async => ReferralStats.fromJson(await _get('referrals/stats'));

  // investor profile and picks
  Future<List<ProfilerQuestion>> quizQuestions() async => ((await _api.getJson(_uri('profiler/questions'))) as List).whereType<Map>().map((m) => ProfilerQuestion.fromJson(m.cast<String, dynamic>())).toList();
  Future<InvestorProfile> submitQuiz(List<({int questionId, int optionIndex})> answers) async =>
      InvestorProfile.fromJson((await _post('profiler/submit', {'answers': [for (final a in answers) {'questionId': a.questionId, 'optionIndex': a.optionIndex}]})) as Map<String, dynamic>);
  Future<InvestorProfile> setShared(bool isPublic) async => InvestorProfile.fromJson((await _post('profiler/share', {'isPublic': isPublic})) as Map<String, dynamic>);
  Future<Recommendations> recommendations() async => Recommendations.fromJson(await _get('advisor/recommendations'));
  Future<CompanyFit> companyFit(String ticker) async => CompanyFit.fromJson(await _get('advisor/research', {'ticker': ticker}));
  Future<Advice> aiAdvice(String ticker) async => Advice.fromJson(await _get('advisor/ai-advice', {'ticker': ticker}));

  // portfolio journal
  Future<Portfolio> portfolio() async => Portfolio.fromJson(await _get('journal/portfolio'));
  Future<TradePage> trades({int page = 1, int limit = 50}) async => TradePage.fromJson(await _get('journal/trades', {'page': '$page', 'limit': '$limit'}));
  Future<void> addTrade(Map<String, dynamic> body) => _post('journal/trades', body);
  Future<void> updateTrade(String id, Map<String, dynamic> body) => _put('journal/trades/$id', body);
  Future<void> deleteTrade(String id) => _delete('journal/trades/$id');
  Future<void> setHoldingCost(String holdingId, double avgCost) => _put('journal/holdings/${Uri.encodeComponent(holdingId)}/cost', {'avgCost': avgCost});
  /// Reads a CDS statement PDF and seeds holdings from it. Returns how many holdings were found.
  Future<int> importStatement(List<int> bytes, String filename) async {
    final j = await _api.postPdf(_uri('journal/statements/import'), bytes: bytes, filename: filename, headers: await _auth());
    return j is Map && j['holdingsRead'] is num ? (j['holdingsRead'] as num).toInt() : 0;
  }

  Future<RealizedGains> realizedGains({int? year}) async => RealizedGains.fromJson(await _get('journal/realized-gains', {'year': ?(year == null ? null : '$year')}));
  Future<List<Dividend>> dividends() async => parseDividends(await _get('journal/dividends'));
  Future<void> addDividend(Map<String, dynamic> body) => _post('journal/dividends', body);
  Future<void> deleteDividend(String id) => _delete('journal/dividends/$id');
  Future<List<YieldOnCost>> yieldOnCost() async => parseYieldOnCost(await _get('journal/dividends/yield-on-cost'));

  // allocation
  Future<Allocation> allocation() async => Allocation.fromJson(await _get('allocation'));
  Future<List<TargetWeight>> saveTargets(List<TargetWeight> targets) async => parseTargets(await _put('allocation/targets', {'targets': [for (final t in targets) t.toJson()]}));
  Future<RebalancePlan> rebalance(double cash) async => RebalancePlan.fromJson(await _get('allocation/rebalance', {'cash': cash.toString()}));
  Future<ModelComparison> compareModel(String slug) async => ModelComparison.fromJson(await _get('model-portfolios/${Uri.encodeComponent(slug)}/compare'));
  Future<void> adoptModel(String slug) => _post('model-portfolios/${Uri.encodeComponent(slug)}/use-as-targets');

  // alerts and notifications
  Future<List<PriceAlert>> alerts() async => parseAlerts(await _get('alerts'));
  Future<void> addAlert({required String ticker, required double target, required bool above}) => _post('alerts', {'ticker': ticker, 'targetPrice': target, 'direction': above ? 'ABOVE' : 'BELOW'});
  Future<void> deleteAlert(String id) => _delete('alerts/$id');
  Future<List<AppNotification>> notifications() async => parseNotifications(await _get('notifications'));
  Future<void> markRead(String id) => _patch('notifications/$id/read', const {});
  Future<void> markAllRead() => _post('notifications/read-all');
  Future<int> unreadCount() async {
    final j = await _get('notifications/unread-count');
    return j is Map && j['count'] is num ? (j['count'] as num).toInt() : 0;
  }

  // portfolio watch (Premium)
  Future<PortfolioWatch> watch() async => PortfolioWatch.fromJson(await _get('portfolio-watch'));
  Future<void> setWatch(bool on) => _put('portfolio-watch/settings', {'enabled': on});
}

/// Public tools that need no sign-in: brokers, research and model portfolios. Cached so they open offline.
class ToolsRepository {
  ToolsRepository(this._api, this._cache);
  final ApiClient _api;
  final JsonCache _cache;

  Future<Cached<List<Broker>>> brokers() => _cache.load(key: 'brokers', ttl: const Duration(hours: 6), fetch: () => _api.getJson(_uri('brokers')), parse: parseBrokers);

  Future<Cached<List<ResearchSummary>>> research({String? kind}) =>
      _cache.load(key: 'research:${kind ?? 'all'}', ttl: const Duration(minutes: 30), fetch: () => _api.getJson(_uri('public/research', {'kind': ?kind})), parse: parseResearchList);

  Future<Cached<ResearchNote>> researchNote(String slug) =>
      _cache.load(key: 'research-note:$slug', ttl: const Duration(hours: 2), fetch: () => _api.getJson(_uri('public/research/${Uri.encodeComponent(slug)}')), parse: ResearchNote.fromJson);

  Future<Cached<ModelList>> models() => _cache.load(key: 'models', ttl: const Duration(minutes: 30), fetch: () => _api.getJson(_uri('public/model-portfolios')), parse: ModelList.fromJson);

  Future<Cached<ModelDetail>> model(String slug) =>
      _cache.load(key: 'model:$slug', ttl: const Duration(minutes: 30), fetch: () => _api.getJson(_uri('public/model-portfolios/${Uri.encodeComponent(slug)}')), parse: ModelDetail.fromJson);
}
