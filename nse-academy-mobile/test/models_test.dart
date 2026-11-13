import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nse_academy/core/format.dart';
import 'package:nse_academy/data/models/article.dart';
import 'package:nse_academy/data/models/course.dart';
import 'package:nse_academy/data/models/glossary_term.dart';
import 'package:nse_academy/data/models/market_report.dart';
import 'package:nse_academy/data/models/stock.dart';

import 'fixtures.dart';

void main() {
  group('Article', () {
    test('parses a page of articles, with and without a cover, and the pagination meta', () {
      final page = ArticlePage.fromJson(jsonDecode(articlesJson));
      expect(page.total, 3);
      expect(page.pageCount, 1);
      expect(page.articles.map((a) => a.slug), ['green-friday', 'bamb-analysis', 'cds-account']);
      expect(page.articles[0].coverImageUrl, isNull);
      expect(page.articles[1].coverImageUrl, 'https://nseacademy-admin.vitaldigitalmedia.net/uploads/bamb.jpg');
      expect(page.articles[1].isPremium, isTrue);
      expect(page.articles[0].tags, ['daily', 'market']);
    });

    test('accepts the older Strapi shape with attributes nested', () {
      final a = Article.fromJson({'id': 1, 'attributes': {'title': 'T', 'slug': 's', 'category': 'NSE News', 'publishedAt': '2026-01-01T00:00:00Z'}});
      expect(a.title, 'T');
      expect(a.readTimeMinutes, 5);
    });

    test('survives a round trip through JSON (bookmarks are stored that way)', () {
      final a = ArticlePage.fromJson(jsonDecode(articlesJson)).articles[1];
      final b = Article.fromJson(a.toJson());
      expect([b.slug, b.title, b.category, b.coverImageUrl, b.isPremium], [a.slug, a.title, a.category, a.coverImageUrl, a.isPremium]);
    });

    test('card blurbs are plain text, cut at a word', () {
      final text = blurb('# Markets rally\n\nThe NSE **extended** gains on Friday as [turnover](http://x) climbed.\n\n' * 4, max: 90);
      expect(text, isNot(contains('#')));
      expect(text, isNot(contains('**')));
      expect(text, isNot(contains('](')));
      expect(text.length, lessThanOrEqualTo(92));
      expect(text, endsWith('…'));
    });
  });

  group('Glossary', () {
    test('leaves out the entries the CMS import cut mid-sentence, and sorts the rest', () {
      final terms = parseGlossary(jsonDecode(glossaryJson));
      expect(terms.map((t) => t.term), ['Ask Price (Offer Price)', 'Bear Market', 'Bull Market', 'Dividend Yield', 'Volume']);
      expect(terms.any((t) => t.term.startsWith('(')), isFalse);
    });

    test('groups by first letter', () {
      expect(GlossaryTerm(term: 'Bear Market', definition: 'x' * 20).letter, 'B');
      expect(GlossaryTerm(term: '52-week high', definition: 'x' * 20).letter, '#');
    });
  });

  group('Stocks', () {
    test('merges prices with profiles; prices decide what is listed', () {
      final quotes = parseQuotes(jsonDecode(quotesJson));
      final stocks = mergeStocks(quotes, parseProfiles(jsonDecode(profilesJson)));
      expect(stocks.map((s) => s.ticker), ['EQTY', 'KCB', 'KNRE', 'SCOM']);
      final scom = stocks.firstWhere((s) => s.ticker == 'SCOM');
      expect(scom.name, 'Safaricom PLC'); // the profile's name wins
      expect(scom.sector, 'Telecommunications');
      expect(scom.dividendYield, 5.2);
      final knre = stocks.firstWhere((s) => s.ticker == 'KNRE');
      expect(knre.name, 'Kenya Re'); // no profile: the price feed's name
      expect(knre.sector, isNull);
    });

    test('works the previous close and the absolute change back from the percentage', () {
      final s = mergeStocks(parseQuotes(jsonDecode(quotesJson)), const []).firstWhere((s) => s.ticker == 'SCOM');
      expect(s.previousClose, closeTo(28.5 / 1.0124, 1e-9));
      expect(s.changeAbs, closeTo(28.5 - 28.5 / 1.0124, 1e-9));
      expect(s.isUp, isTrue);
    });

    test('formats prices and changes for display', () {
      expect(formatPrice(28.5), '28.50');
      expect(compactNumber(12300000), '12.3M');
      expect(compactNumber(4500), '4.5K');
      expect(signedPct(1.236), '+1.24%');
      expect(signedPct(-0.5), '-0.50%');
    });

    test('slices a price series to the chosen range, ending at the latest point', () {
      final pts = parseHistory(jsonDecode(historyJson('SCOM', days: 40)));
      expect(pts, hasLength(40));
      final week = sliceRange(pts, ChartRange.week);
      expect(week.last.date, pts.last.date);
      expect(week.length, 8);
      expect(sliceRange(pts, ChartRange.year), hasLength(40)); // we only have 40 days: show them all
    });
  });

  group('Courses', () {
    final courses = parseCourses(jsonDecode(coursesJson));
    final guide = courses[0];
    final trading = courses[1];

    test('parses modules and lessons in reading order', () {
      expect(guide.modules.map((m) => m.order), [0, 1, 2, 3]);
      expect(guide.lessonCount, 4);
      expect(guide.lessonsInOrder.map((l) => l.id), [2, 3, 4, 5]);
      expect(guide.totalMinutes, 21);
    });

    test('applies the website\'s rules: the trading guide needs Intermediary; the investor\'s guide is Premium with 3 free chapters', () {
      expect(CourseAccess.requiredTier(trading), Tier.intermediary);
      expect(CourseAccess.requiredTier(guide), Tier.premium);
      expect([for (var i = 0; i < 4; i++) CourseAccess.canOpenModule(guide, i, Tier.free)], [true, true, true, false]);
      expect(CourseAccess.canOpenModule(guide, 3, Tier.intermediary), isFalse);
      expect(CourseAccess.canOpenModule(guide, 3, Tier.premium), isTrue);
      expect(CourseAccess.canOpenModule(trading, 0, Tier.free), isFalse);
      expect(CourseAccess.canOpenModule(trading, 0, Tier.intermediary), isTrue);
      expect(CourseAccess.canOpenLesson(guide, 5, Tier.free), isFalse);
      expect(CourseAccess.canOpenLesson(guide, 2, Tier.free), isTrue);
      expect(CourseAccess.canOpenLesson(guide, 999, Tier.premium), isFalse);
    });

    test('reads a lesson from the list response', () {
      final l = Lesson.fromList(jsonDecode(lessonJson(2)))!;
      expect(l.id, 2);
      expect(l.body, contains('Nairobi Securities Exchange (NSE)'));
      expect(Lesson.fromList({'data': []}), isNull);
    });
  });

  group('Market report', () {
    test('keeps the headline, lessons and breadth the app shows', () {
      final r = MarketReport.fromJson(jsonDecode(reportJson));
      expect(r.label, 'Thursday 12 November 2026');
      expect(r.lessons.single.title, startsWith('One stock'));
      expect(r.breadth!.advancers, 26);
      expect(r.valueTradedKes, 405800000);
    });
  });
}
