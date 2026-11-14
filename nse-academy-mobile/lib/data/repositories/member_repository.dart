import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/json_cache.dart';
import '../models/member.dart';
import 'auth_repository.dart';

Uri _uri(String path, [Map<String, String>? q]) => Uri.parse('${AppConfig.apiBase}/$path').replace(queryParameters: q);

List<T> _listOf<T>(dynamic json, T Function(dynamic) parse) => json is List ? [for (final e in json) parse(e)] : <T>[];

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
  Future<dynamic> _delete(String path, [Map<String, String>? q]) async => _api.deleteJson(_uri(path, q), headers: await _auth());

  // plan and Google Play billing
  Future<PlanStatus> planStatus() async => PlanStatus.fromJson(await _get('payments/status'));
  Future<String> playAccountId() async => ((await _get('payments/google/config')) as Map)['accountId'] as String;
  Future<PlanStatus> verifyPlayPurchase(String purchaseToken) async {
    await _post('payments/google/verify', {'purchaseToken': purchaseToken});
    return planStatus();
  }

  // push notifications
  Future<void> registerDevice(String token) => _post('devices', {'token': token, 'platform': 'android'});
  Future<void> unregisterDevice(String token) => _delete('devices', {'token': token});

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

  // financial advisers (any signed-in member; questions are rationed by plan)
  Future<AdviserPage> advisers({int page = 1}) async => AdviserPage.fromJson(await _api.getJson(_uri('financial-advisors', {'page': '$page', 'limit': '20'})));
  Future<Adviser> adviser(String id) async => Adviser.fromJson(await _api.getJson(_uri('financial-advisors/${Uri.encodeComponent(id)}')));
  Future<List<AdviserConnection>> adviserConnections() async => _listOf(await _get('financial-advisor/connections'), AdviserConnection.fromJson);
  Future<void> connectToAdviser(String id) => _post('financial-advisor/connect/${Uri.encodeComponent(id)}');
  Future<QuestionAllowance> questionAllowance() async => QuestionAllowance.fromJson(await _get('financial-advisor/queries/allowance'));
  /// Returns the id of the new conversation.
  Future<String> askAdviser(String adviserId, String question) async {
    final j = await _post('financial-advisor/queries', {'advisorId': adviserId, 'question': question});
    return j is Map && j['id'] is String ? j['id'] as String : '';
  }
  Future<List<AdviserQuestion>> myQuestions() async => _listOf(await _get('financial-advisor/queries/mine'), AdviserQuestion.fromJson);
  Future<QuestionThread> questionThread(String id) async => QuestionThread.fromJson(await _get('financial-advisor/queries/${Uri.encodeComponent(id)}'));
  Future<void> replyToQuestion(String id, String body) => _post('financial-advisor/queries/${Uri.encodeComponent(id)}/reply', {'body': body});
  Future<List<AdviserInsight>> insightsFeed() async => _listOf((await _get('financial-advisor/insights/feed', {'limit': '50'}) as Map)['data'], AdviserInsight.fromJson);

  // adviser workspace (members who are advisers)
  Future<AdviserSelf?> adviserSelf() async => AdviserSelf.fromJson(await _get('financial-advisor/me'));
  Future<List<ClientRequest>> clientRequests() async => _listOf(await _get('financial-advisor/clients', {'status': 'pending'}), ClientRequest.fromJson);
  Future<void> respondToRequest(String id, bool accept) => _post('financial-advisor/clients/${Uri.encodeComponent(id)}/respond', {'accept': accept});
  Future<List<AdviserQuestion>> clientQuestions() async => _listOf(await _get('financial-advisor/queries'), (j) => AdviserQuestion.fromJson(j, asAdviser: true));
  Future<void> answerQuestion(String id, String body) => _post('financial-advisor/queries/${Uri.encodeComponent(id)}/answer', {'body': body});
  Future<List<AdviserInsight>> myInsights() async => _listOf(await _get('financial-advisor/insights'), AdviserInsight.fromJson);
  Future<void> publishInsight({required String title, required String body, List<String> tickers = const []}) => _post('financial-advisor/insights', {'title': title, 'body': body, if (tickers.isNotEmpty) 'tickers': tickers});

  // organisation (corporate seats)
  Future<OrgMembership?> organisation() async => OrgMembership.fromJson(await _get('corporate/me'));
  Future<OrgDashboard> organisationDashboard() async => OrgDashboard.fromJson(await _get('corporate/dashboard'));
  Future<void> acceptInvite(String token) => _post('corporate/invite/accept', {'token': token});
  Future<void> inviteToOrganisation(String email) => _post('corporate/invite', {'email': email});
  Future<void> resendOrgInvite(String memberId) => _post('corporate/members/${Uri.encodeComponent(memberId)}/resend-invite');
  Future<void> removeOrgMember(String memberId) => _delete('corporate/members/${Uri.encodeComponent(memberId)}');

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
