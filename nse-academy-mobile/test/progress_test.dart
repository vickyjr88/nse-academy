import 'package:flutter_test/flutter_test.dart';
import 'package:nse_academy/data/local/app_settings.dart';
import 'package:nse_academy/data/local/learning_progress.dart';
import 'package:nse_academy/data/models/article.dart';
import 'package:nse_academy/data/quiz_bank.dart';

void main() {
  final mon = DateTime(2026, 11, 9, 9);
  DateTime day(int d) => DateTime(2026, 11, d, 10);

  group('streak', () {
    test('starts at 1, grows on consecutive days, and is idempotent within a day', () {
      var p = const LearningProgress().touchDay(day(9));
      expect(p.streak, 1);
      expect(p.touchDay(DateTime(2026, 11, 9, 20)).streak, 1);
      p = p.touchDay(day(10)).touchDay(day(11));
      expect(p.streak, 3);
      expect(p.longestStreak, 3);
    });

    test('restarts after a missed day but remembers the longest', () {
      var p = const LearningProgress().touchDay(day(9)).touchDay(day(10)).touchDay(day(11));
      p = p.touchDay(day(13));
      expect(p.streak, 1);
      expect(p.longestStreak, 3);
    });

    test('a lapsed streak shows as 0, a live one as its length', () {
      final p = const LearningProgress().touchDay(day(9)).touchDay(day(10));
      expect(p.streakOn(day(10)), 2);
      expect(p.streakOn(day(11)), 2); // yesterday counts: they can still extend it today
      expect(p.streakOn(day(12)), 0);
      expect(const LearningProgress().streakOn(mon), 0);
    });

    test('crosses month boundaries', () {
      final p = const LearningProgress().touchDay(DateTime(2026, 10, 31, 22)).touchDay(DateTime(2026, 11, 1, 8));
      expect(p.streak, 2);
    });
  });

  test('progress survives a round trip through JSON, bookmarks included', () {
    final a = Article.fromJson({'id': 1, 'title': 'T', 'slug': 's', 'category': 'NSE News', 'body': 'Body', 'publishedAt': '2026-01-01T00:00:00Z'});
    final p = const LearningProgress().touchDay(day(9)).copyWith(
          articlesRead: {'s'},
          lessonsDone: {4},
          quizzesPassed: {'ipo'},
          quizToday: (day: '2026-11-09', id: 'ipo', chosen: 1),
          readSeconds: 90,
          articleProgress: {'s': 0.5},
          lastRead: const LastRead(kind: 'article', key: 's', title: 'T', progress: 0.5, minutesLeft: 3),
          bookmarks: [a],
          bookmarkedStocks: ['SCOM'],
        );
    final q = LearningProgress.fromJson(p.toJson());
    expect(q.streak, 1);
    expect(q.articlesRead, {'s'});
    expect(q.lessonsDone, {4});
    expect(q.quizToday, (day: '2026-11-09', id: 'ipo', chosen: 1));
    expect(q.articleProgress['s'], 0.5);
    expect(q.lastRead!.minutesLeft, 3);
    expect(q.bookmarks.single.body, 'Body');
    expect(q.isBookmarked('s'), isTrue);
    expect(q.bookmarkedStocks, ['SCOM']);
  });

  test('quiz questions are valid, and the same all day and different tomorrow', () {
    for (final q in quizBank) {
      expect(q.options.length, 3, reason: q.id);
      expect(q.correct, inInclusiveRange(0, q.options.length - 1), reason: q.id);
      expect(q.explanation.length, greaterThan(20), reason: q.id);
    }
    expect({for (final q in quizBank) q.id}.length, quizBank.length);
    expect(questionFor(DateTime(2026, 11, 9, 1)).id, questionFor(DateTime(2026, 11, 9, 23)).id);
    expect(questionFor(DateTime(2026, 11, 9)).id, isNot(questionFor(DateTime(2026, 11, 10)).id));
  });

  test('onboarding interests map to real article categories, without repeats', () {
    final s = const AppSettings().copyWith(interestIds: ['analysis', 'strategy', 'basics']);
    expect(s.preferredCategories, ['Investor Education', 'NSE News', 'Market Analysis', 'Daily Update', 'Weekly Roundup', 'IPO Watch']);
    expect(const AppSettings().preferredCategories, isEmpty);
  });

  test('settings round trip, including the theme', () {
    final s = const AppSettings().copyWith(onboarded: true, level: ExperienceLevel.experienced, interestIds: ['basics']);
    final r = AppSettings.fromJson(s.toJson());
    expect(r.onboarded, isTrue);
    expect(r.level, ExperienceLevel.experienced);
    expect(r.interestIds, ['basics']);
  });
}
