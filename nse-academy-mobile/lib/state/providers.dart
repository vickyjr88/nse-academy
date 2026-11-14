import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../core/json_cache.dart';
import '../data/local/app_settings.dart';
import '../data/local/learning_progress.dart';
import '../data/models/article.dart';
import '../data/models/course.dart';
import '../data/models/glossary_term.dart';
import '../data/models/market_report.dart';
import '../data/models/member.dart';
import '../data/models/stock.dart';
import '../data/quiz_bank.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/content_repository.dart';
import '../data/repositories/market_repository.dart';
import '../data/repositories/member_repository.dart';

// ---- plumbing (overridden in main() and in tests)

final sharedPrefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('sharedPrefsProvider must be overridden'));
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final jsonCacheProvider = Provider<JsonCache>((ref) => JsonCache(ref.watch(sharedPrefsProvider)));
final tokenStoreProvider = Provider<TokenStore>((ref) => const SecureTokenStore());
final contentRepositoryProvider = Provider<ContentRepository>((ref) => ContentRepository(ref.watch(apiClientProvider), ref.watch(jsonCacheProvider)));
final marketRepositoryProvider = Provider<MarketRepository>((ref) => MarketRepository(ref.watch(apiClientProvider), ref.watch(jsonCacheProvider)));
final memberRepositoryProvider = Provider<MemberRepository>((ref) => MemberRepository(ref.watch(apiClientProvider), ref.watch(tokenStoreProvider)));
final toolsRepositoryProvider = Provider<ToolsRepository>((ref) => ToolsRepository(ref.watch(apiClientProvider), ref.watch(jsonCacheProvider)));
final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStoreProvider)));

// ---- settings

class SettingsNotifier extends Notifier<AppSettings> {
  static const _key = 'settings';

  @override
  AppSettings build() {
    final raw = ref.watch(sharedPrefsProvider).getString(_key);
    if (raw == null) return const AppSettings();
    try {
      return AppSettings.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return const AppSettings();
    }
  }

  void _set(AppSettings s) {
    state = s;
    ref.read(sharedPrefsProvider).setString(_key, jsonEncode(s.toJson()));
  }

  void completeOnboarding(ExperienceLevel level, List<String> interestIds) => _set(state.copyWith(onboarded: true, level: level, interestIds: interestIds));
  void setThemeMode(ThemeMode m) => _set(state.copyWith(themeMode: m));
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

// ---- learning progress

class ProgressNotifier extends Notifier<LearningProgress> {
  static const _key = 'progress';
  static const maxBookmarks = 200;

  @override
  LearningProgress build() {
    final raw = ref.watch(sharedPrefsProvider).getString(_key);
    if (raw == null) return const LearningProgress();
    try {
      return LearningProgress.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return const LearningProgress();
    }
  }

  void _set(LearningProgress p) {
    state = p;
    ref.read(sharedPrefsProvider).setString(_key, jsonEncode(p.toJson()));
  }

  /// Called when the app opens and when the member reads or answers something: today counts toward the streak.
  void touchToday([DateTime? now]) => _set(state.touchDay(now ?? DateTime.now()));

  void markArticleOpened(Article a) {
    final read = {...state.articlesRead, a.slug};
    _set(state.touchDay(DateTime.now()).copyWith(articlesRead: read));
  }

  void setArticleProgress(Article a, double progress) {
    final p = progress.clamp(0.0, 1.0);
    final prev = state.articleProgress[a.slug] ?? 0;
    if (p <= prev && state.lastRead?.key == a.slug) return;
    final best = p > prev ? p : prev;
    _set(state.copyWith(
      articleProgress: {...state.articleProgress, a.slug: best},
      lastRead: LastRead(kind: 'article', key: a.slug, title: a.title, progress: best, minutesLeft: ((1 - best) * a.readTimeMinutes).ceil().clamp(0, 999)),
    ));
  }

  void setLessonProgress({required int courseId, required LessonRef lesson, required double progress}) {
    final p = progress.clamp(0.0, 1.0);
    _set(state.copyWith(lastRead: LastRead(kind: 'lesson', key: '${lesson.id}', title: lesson.title, progress: p, minutesLeft: ((1 - p) * lesson.minutes).ceil().clamp(0, 999), courseId: courseId)));
  }

  void completeLesson(int id) => _set(state.touchDay(DateTime.now()).copyWith(lessonsDone: {...state.lessonsDone, id}));

  /// Returns whether the article is now bookmarked.
  bool toggleBookmark(Article a) {
    final has = state.isBookmarked(a.slug);
    final list = has ? state.bookmarks.where((b) => b.slug != a.slug).toList() : [a, ...state.bookmarks].take(maxBookmarks).toList();
    _set(state.copyWith(bookmarks: list));
    return !has;
  }

  bool toggleStockBookmark(String ticker) {
    final has = state.bookmarkedStocks.contains(ticker);
    _set(state.copyWith(bookmarkedStocks: has ? state.bookmarkedStocks.where((t) => t != ticker).toList() : [ticker, ...state.bookmarkedStocks]));
    return !has;
  }

  /// Records today's quiz answer. Returns whether it was right.
  bool answerQuiz(QuizQuestion q, int chosen, DateTime today) {
    final right = chosen == q.correct;
    _set(state.touchDay(today).copyWith(
      quizToday: (day: today.toIso8601String().substring(0, 10), id: q.id, chosen: chosen),
      quizzesPassed: right ? {...state.quizzesPassed, q.id} : state.quizzesPassed,
    ));
    return right;
  }

  void addReadSeconds(int seconds) {
    if (seconds <= 0) return;
    _set(state.copyWith(readSeconds: state.readSeconds + seconds.clamp(0, 1800)));
  }

  void resetProgress() => _set(LearningProgress(bookmarks: state.bookmarks, bookmarkedStocks: state.bookmarkedStocks));
}

final progressProvider = NotifierProvider<ProgressNotifier, LearningProgress>(ProgressNotifier.new);

// ---- sign-in

class AuthState {
  const AuthState({this.session});
  final Session? session;
  bool get signedIn => session != null;
  Tier get tier => session?.tier ?? Tier.free;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async => AuthState(session: await ref.read(authRepositoryProvider).restore());

  Future<void> signIn(String email, String password) async {
    final s = await ref.read(authRepositoryProvider).signIn(email, password);
    state = AsyncData(AuthState(session: s));
  }

  Future<void> register({required String name, required String email, required String password, String? referralCode}) async {
    final s = await ref.read(authRepositoryProvider).register(name: name, email: email, password: password, referralCode: referralCode);
    state = AsyncData(AuthState(session: s));
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    state = const AsyncData(AuthState());
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

/// The plan the member is on, Free when signed out or while it is loading.
final tierProvider = Provider<Tier>((ref) => ref.watch(authProvider).value?.tier ?? Tier.free);

// ---- content

typedef ArticleQuery = ({String? category, String? search, int page});

final articlesProvider = FutureProvider.family<Cached<ArticlePage>, ArticleQuery>((ref, q) => ref.watch(contentRepositoryProvider).articles(category: q.category, search: q.search, page: q.page));
final recentArticlesProvider = FutureProvider<Cached<ArticlePage>>((ref) => ref.watch(contentRepositoryProvider).articles(pageSize: 30));
final categoryCountsProvider = FutureProvider<Cached<Map<String, int>>>((ref) => ref.watch(contentRepositoryProvider).categoryCounts());
final articleProvider = FutureProvider.family<Cached<Article>, String>((ref, slug) => ref.watch(contentRepositoryProvider).article(slug));
final glossaryProvider = FutureProvider<Cached<List<GlossaryTerm>>>((ref) => ref.watch(contentRepositoryProvider).glossary());
final coursesProvider = FutureProvider<Cached<List<Course>>>((ref) => ref.watch(contentRepositoryProvider).courses());
final lessonProvider = FutureProvider.family<Cached<Lesson>, int>((ref, id) => ref.watch(contentRepositoryProvider).lesson(id));

// ---- market

final quotesProvider = FutureProvider<Cached<List<Quote>>>((ref) => ref.watch(marketRepositoryProvider).quotes());
final reportProvider = FutureProvider<Cached<MarketReport>>((ref) => ref.watch(marketRepositoryProvider).latestReport());
final historyProvider = FutureProvider.family<Cached<List<PricePoint>>, String>((ref, ticker) => ref.watch(marketRepositoryProvider).history(ticker));

/// Every listed company with its price. Company profiles add detail but are not needed for prices, so if they fail
/// the list still shows.
final stocksProvider = FutureProvider<Cached<List<Stock>>>((ref) async {
  final quotes = await ref.watch(quotesProvider.future);
  List<StockProfile> profiles = const [];
  try {
    profiles = (await ref.watch(contentRepositoryProvider).profiles()).value;
  } catch (_) {}
  return Cached(mergeStocks(quotes.value, profiles), quotes.fetchedAt, fromCache: quotes.fromCache);
});

/// Today's pull-to-refresh: mark everything stale, then rebuild the providers so they refetch.
Future<void> refreshAll(WidgetRef ref) async {
  await ref.read(contentRepositoryProvider).refreshContent();
  await ref.read(marketRepositoryProvider).refresh();
  ref
    ..invalidate(recentArticlesProvider)
    ..invalidate(categoryCountsProvider)
    ..invalidate(glossaryProvider)
    ..invalidate(coursesProvider)
    ..invalidate(quotesProvider)
    ..invalidate(reportProvider)
    ..invalidate(stocksProvider);
}

// ---- member features (signed in; the server enforces the plan)

/// Changes when a different member signs in or out, so account data is never shown to the wrong person.
final _memberIdProvider = Provider<String?>((ref) => ref.watch(authProvider.select((a) => a.value?.session?.user.id)));

/// A member-only fetch: waits for the account, refetches on every visit, and is dropped on sign-out.
FutureProvider<T> _member<T>(Future<T> Function(MemberRepository r) load) => FutureProvider.autoDispose<T>((ref) {
      ref.watch(_memberIdProvider);
      return load(ref.watch(memberRepositoryProvider));
    });

final accountProvider = _member((r) => r.account());
final digestProvider = _member((r) => r.digestEnabled());
final referralsProvider = _member((r) => r.referrals());
final quizProvider = FutureProvider<List<ProfilerQuestion>>((ref) => ref.watch(memberRepositoryProvider).quizQuestions());
final recommendationsProvider = _member((r) => r.recommendations());
final companyFitProvider = FutureProvider.autoDispose.family<CompanyFit, String>((ref, ticker) {
  ref.watch(_memberIdProvider);
  return ref.watch(memberRepositoryProvider).companyFit(ticker);
});

final portfolioProvider = _member((r) => r.portfolio());
final tradesProvider = _member((r) => r.trades());
final realizedProvider = _member((r) => r.realizedGains());
final dividendsProvider = _member((r) => r.dividends());
final yieldOnCostProvider = _member((r) => r.yieldOnCost());
final allocationProvider = _member((r) => r.allocation());
final rebalanceProvider = FutureProvider.autoDispose.family<RebalancePlan, double>((ref, cash) {
  ref.watch(_memberIdProvider);
  return ref.watch(memberRepositoryProvider).rebalance(cash);
});
final comparisonProvider = FutureProvider.autoDispose.family<ModelComparison, String>((ref, slug) {
  ref.watch(_memberIdProvider);
  return ref.watch(memberRepositoryProvider).compareModel(slug);
});
final alertsProvider = _member((r) => r.alerts());
final notificationsProvider = _member((r) => r.notifications());
final watchProvider = _member((r) => r.watch());

/// Brokers are public and cached; the trade form and the broker list both use them.
final brokersProvider = FutureProvider<Cached<List<Broker>>>((ref) => ref.watch(toolsRepositoryProvider).brokers());
final researchListProvider = FutureProvider.family<Cached<List<ResearchSummary>>, String?>((ref, kind) => ref.watch(toolsRepositoryProvider).research(kind: kind));
final researchNoteProvider = FutureProvider.family<Cached<ResearchNote>, String>((ref, slug) => ref.watch(toolsRepositoryProvider).researchNote(slug));
final modelsProvider = FutureProvider<Cached<ModelList>>((ref) => ref.watch(toolsRepositoryProvider).models());
final modelProvider = FutureProvider.family<Cached<ModelDetail>, String>((ref, slug) => ref.watch(toolsRepositoryProvider).model(slug));

/// Unread notification count for the badge. 0 when signed out or below the plan that has alerts.
final unreadProvider = FutureProvider.autoDispose<int>((ref) async {
  final tier = ref.watch(tierProvider);
  ref.watch(_memberIdProvider);
  if (!tier.atLeast(Tier.intermediary)) return 0;
  try {
    return await ref.watch(memberRepositoryProvider).unreadCount();
  } catch (_) {
    return 0;
  }
});
