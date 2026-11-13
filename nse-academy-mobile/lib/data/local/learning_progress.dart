import '../../core/format.dart';
import '../models/article.dart';

/// What the member was last reading, so Home can offer to continue.
class LastRead {
  const LastRead({required this.kind, required this.key, required this.title, required this.progress, required this.minutesLeft, this.courseId});
  final String kind; // 'article' or 'lesson'
  final String key; // article slug or lesson id
  final String title;
  final double progress;
  final int minutesLeft;
  final int? courseId;

  Map<String, dynamic> toJson() => {'kind': kind, 'key': key, 'title': title, 'progress': progress, 'minutesLeft': minutesLeft, 'courseId': courseId};
  factory LastRead.fromJson(Map<String, dynamic> m) => LastRead(
        kind: m['kind'] as String? ?? 'article',
        key: m['key'] as String? ?? '',
        title: m['title'] as String? ?? '',
        progress: (m['progress'] as num?)?.toDouble() ?? 0,
        minutesLeft: (m['minutesLeft'] as num?)?.toInt() ?? 0,
        courseId: (m['courseId'] as num?)?.toInt(),
      );
}

/// Everything the app remembers about the member's learning. Immutable: each change returns a new value.
class LearningProgress {
  const LearningProgress({
    this.streak = 0,
    this.longestStreak = 0,
    this.lastActiveDay,
    this.articlesRead = const {},
    this.lessonsDone = const {},
    this.quizzesPassed = const {},
    this.quizToday,
    this.readSeconds = 0,
    this.articleProgress = const {},
    this.lastRead,
    this.bookmarks = const [],
    this.bookmarkedStocks = const [],
  });

  final int streak;
  final int longestStreak;
  final String? lastActiveDay; // yyyy-MM-dd, device-local
  final Set<String> articlesRead;
  final Set<int> lessonsDone;
  final Set<String> quizzesPassed;
  final ({String day, String id, int chosen})? quizToday;
  final int readSeconds;
  final Map<String, double> articleProgress;
  final LastRead? lastRead;
  final List<Article> bookmarks;
  final List<String> bookmarkedStocks;

  /// The streak as it stands on `today`: a streak that was not extended yesterday or today has ended.
  int streakOn(DateTime today) {
    final last = lastActiveDay;
    if (last == null) return 0;
    final t = yyyyMmDd(today);
    final y = yyyyMmDd(DateTime(today.year, today.month, today.day).subtract(const Duration(days: 1)));
    return (last == t || last == y) ? streak : 0;
  }

  /// Counts today as a day of learning: extends the streak if yesterday was one, restarts it otherwise.
  LearningProgress touchDay(DateTime today) {
    final t = yyyyMmDd(today);
    if (lastActiveDay == t) return this;
    final y = yyyyMmDd(DateTime(today.year, today.month, today.day).subtract(const Duration(days: 1)));
    final next = lastActiveDay == y ? streak + 1 : 1;
    return copyWith(streak: next, longestStreak: next > longestStreak ? next : longestStreak, lastActiveDay: t);
  }

  LearningProgress copyWith({
    int? streak,
    int? longestStreak,
    String? lastActiveDay,
    Set<String>? articlesRead,
    Set<int>? lessonsDone,
    Set<String>? quizzesPassed,
    ({String day, String id, int chosen})? quizToday,
    int? readSeconds,
    Map<String, double>? articleProgress,
    LastRead? lastRead,
    List<Article>? bookmarks,
    List<String>? bookmarkedStocks,
  }) =>
      LearningProgress(
        streak: streak ?? this.streak,
        longestStreak: longestStreak ?? this.longestStreak,
        lastActiveDay: lastActiveDay ?? this.lastActiveDay,
        articlesRead: articlesRead ?? this.articlesRead,
        lessonsDone: lessonsDone ?? this.lessonsDone,
        quizzesPassed: quizzesPassed ?? this.quizzesPassed,
        quizToday: quizToday ?? this.quizToday,
        readSeconds: readSeconds ?? this.readSeconds,
        articleProgress: articleProgress ?? this.articleProgress,
        lastRead: lastRead ?? this.lastRead,
        bookmarks: bookmarks ?? this.bookmarks,
        bookmarkedStocks: bookmarkedStocks ?? this.bookmarkedStocks,
      );

  bool isBookmarked(String slug) => bookmarks.any((a) => a.slug == slug);

  Map<String, dynamic> toJson() => {
        'streak': streak,
        'longestStreak': longestStreak,
        'lastActiveDay': lastActiveDay,
        'articlesRead': articlesRead.toList(),
        'lessonsDone': lessonsDone.toList(),
        'quizzesPassed': quizzesPassed.toList(),
        'quizToday': quizToday == null ? null : {'day': quizToday!.day, 'id': quizToday!.id, 'chosen': quizToday!.chosen},
        'readSeconds': readSeconds,
        'articleProgress': articleProgress,
        'lastRead': lastRead?.toJson(),
        'bookmarks': bookmarks.map((a) => a.toJson()).toList(),
        'bookmarkedStocks': bookmarkedStocks,
      };

  factory LearningProgress.fromJson(Map<String, dynamic> m) {
    final q = m['quizToday'] as Map?;
    return LearningProgress(
      streak: (m['streak'] as num?)?.toInt() ?? 0,
      longestStreak: (m['longestStreak'] as num?)?.toInt() ?? 0,
      lastActiveDay: m['lastActiveDay'] as String?,
      articlesRead: ((m['articlesRead'] as List?) ?? const []).map((e) => e.toString()).toSet(),
      lessonsDone: ((m['lessonsDone'] as List?) ?? const []).map((e) => (e as num).toInt()).toSet(),
      quizzesPassed: ((m['quizzesPassed'] as List?) ?? const []).map((e) => e.toString()).toSet(),
      quizToday: q == null ? null : (day: q['day'] as String, id: q['id'] as String, chosen: (q['chosen'] as num).toInt()),
      readSeconds: (m['readSeconds'] as num?)?.toInt() ?? 0,
      articleProgress: ((m['articleProgress'] as Map?) ?? const {}).map((k, v) => MapEntry(k.toString(), (v as num).toDouble())),
      lastRead: m['lastRead'] is Map ? LastRead.fromJson((m['lastRead'] as Map).cast<String, dynamic>()) : null,
      bookmarks: ((m['bookmarks'] as List?) ?? const []).map((e) => Article.fromJson((e as Map).cast<String, dynamic>())).toList(),
      bookmarkedStocks: ((m['bookmarkedStocks'] as List?) ?? const []).map((e) => e.toString()).toList(),
    );
  }
}
