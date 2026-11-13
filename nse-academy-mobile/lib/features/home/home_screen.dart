import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/article.dart';
import '../../data/models/market_report.dart';
import '../../data/quiz_bank.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';

/// The personalised dashboard (design section 4.2).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final settings = ref.watch(settingsProvider);
    final progress = ref.watch(progressProvider);
    final auth = ref.watch(authProvider).value;
    final firstName = auth?.session?.user.name.trim().split(RegExp(r'\s+')).first;
    final now = DateTime.now();
    final themeMode = settings.themeMode;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('NSE Academy', style: AppText.h3(c.primary)),
        actions: [
          IconButton(tooltip: 'Search', onPressed: () => context.push('/search'), icon: const Icon(Icons.search_rounded)),
          IconButton(
            tooltip: dark ? 'Switch to light mode' : 'Switch to dark mode',
            onPressed: () {
              HapticFeedback.lightImpact();
              ref.read(settingsProvider.notifier).setThemeMode(dark ? ThemeMode.light : ThemeMode.dark);
            },
            icon: Icon(dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded, semanticLabel: themeMode.name),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => refreshAll(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32),
          children: [
            Text('${greetingFor(now)}, ${firstName == null || firstName.isEmpty ? 'Investor' : firstName}!', style: AppText.h1(c.textPrimary)),
            const SizedBox(height: 6),
            StreakBadge(progress.streakOn(now)),
            const SizedBox(height: Gap.section),
            const _DailyTip(),
            if (progress.lastRead != null) ...[const SizedBox(height: Gap.section), _ContinueReading(last: progress.lastRead!)],
            const SizedBox(height: Gap.section),
            const _MarketSnapshot(),
            const SizedBox(height: Gap.section),
            const _FeaturedArticles(),
            const SizedBox(height: Gap.section),
            const _QuickQuiz(),
          ],
        ),
      ),
    );
  }
}

class _DailyTip extends ConsumerWidget {
  const _DailyTip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final report = ref.watch(reportProvider);
    return report.when(
      loading: () => const Skeleton(height: 150),
      error: (_, _) => _tipCard(context, title: 'Today on the NSE', body: 'The NSE trades Monday to Friday and closes at 3 pm East Africa Time. Check the Stocks tab for the latest delayed prices.', source: null),
      data: (r) {
        final MarketReport m = r.value;
        final lesson = m.lessons.isNotEmpty ? m.lessons.first : null;
        return _tipCard(context, title: lesson?.title ?? m.headline, body: lesson?.body ?? m.summary, source: m, label: 'Daily Market Tip · ${m.label}');
      },
    );
  }

  Widget _tipCard(BuildContext context, {required String title, required String body, MarketReport? source, String label = 'Daily Market Tip'}) {
    final c = context.c;
    return SurfaceCard(
      color: c.primarySurface,
      borderColor: c.primary.withValues(alpha: 0.25),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(Icons.trending_up_rounded, size: 18, color: c.primary), const SizedBox(width: 6), Expanded(child: Text(label, style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700)))]),
        const SizedBox(height: 10),
        Text(title, style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 6),
        Text(body, style: AppText.bodySmall(c.textSecondary), maxLines: 4, overflow: TextOverflow.ellipsis),
        if (source != null && source.url.isNotEmpty) ...[
          const SizedBox(height: 8),
          TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32), alignment: Alignment.centerLeft),
            onPressed: () => launchUrl(Uri.parse(source.url), mode: LaunchMode.externalApplication),
            child: const ArrowLink('Read the full report'),
          ),
        ],
      ]),
    );
  }
}

class _ContinueReading extends StatelessWidget {
  const _ContinueReading({required this.last});
  final dynamic last;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionHeader('Continue Reading'),
      Tappable(
        onTap: () => last.kind == 'lesson' ? context.push('/lesson/${last.courseId}/${last.key}') : context.push('/article/${last.key}'),
        child: SurfaceCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(last.title as String, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16), maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 10),
            AppProgressBar(last.progress as double, showLabel: true),
            const SizedBox(height: 6),
            Text('${last.minutesLeft} min left', style: AppText.caption(c.textSecondary)),
          ]),
        ),
      ),
    ]);
  }
}

class _MarketSnapshot extends ConsumerWidget {
  const _MarketSnapshot();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stocks = ref.watch(stocksProvider);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionHeader('Market Snapshot', action: 'See all', onAction: () => context.go('/stocks')),
      stocks.when(
        loading: () => SizedBox(height: 106, child: ListView(scrollDirection: Axis.horizontal, children: [for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(right: 12), child: Skeleton(height: 106, width: 132))])),
        error: (e, _) => SurfaceCard(child: Text(e is Exception ? e.toString() : 'Prices are not available right now.', style: AppText.bodySmall(context.c.textSecondary))),
        data: (d) {
          final busiest = [...d.value]..sort((a, b) => b.valueTraded.compareTo(a.valueTraded));
          final top = busiest.take(8).toList();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
            SizedBox(
              height: 106,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: top.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) => StockCard(stock: top[i], onTap: () => context.push('/stock/${top[i].ticker}')),
              ),
            ),
            const SizedBox(height: 6),
            Text('Most traded today · delayed prices', style: AppText.caption(context.c.textMuted)),
          ]);
        },
      ),
    ]);
  }
}

class _FeaturedArticles extends ConsumerWidget {
  const _FeaturedArticles();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentArticlesProvider);
    final prefs = ref.watch(settingsProvider).preferredCategories;
    final progress = ref.watch(progressProvider);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionHeader('Featured Articles', action: 'More', onAction: () => context.go('/learn')),
      recent.when(
        loading: () => Column(children: [for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(bottom: 12), child: Skeleton(height: 96))]),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(recentArticlesProvider)),
        data: (d) {
          final list = [...d.value.articles];
          // Articles in the member's chosen categories come first; within each group, newest first.
          list.sort((a, b) {
            final pa = prefs.contains(a.category) ? 0 : 1;
            final pb = prefs.contains(b.category) ? 0 : 1;
            return pa != pb ? pa.compareTo(pb) : b.publishedAt.compareTo(a.publishedAt);
          });
          return Column(children: [
            if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
            for (final a in list.take(4))
              Padding(
                padding: const EdgeInsets.only(bottom: Gap.cardGap),
                child: ArticleCard(
                  article: a,
                  bookmarked: progress.isBookmarked(a.slug),
                  progress: progress.articleProgress[a.slug],
                  onTap: () => context.push('/article/${a.slug}'),
                  onLongPress: () => _quickBookmark(context, ref, a),
                ),
              ),
          ]);
        },
      ),
    ]);
  }
}

void _quickBookmark(BuildContext context, WidgetRef ref, Article a) {
  final now = ref.read(progressProvider.notifier).toggleBookmark(a);
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(now ? 'Bookmarked' : 'Bookmark removed'), duration: const Duration(seconds: 2)));
}

class _QuickQuiz extends ConsumerWidget {
  const _QuickQuiz();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final today = DateTime.now();
    final q = questionFor(today);
    final saved = ref.watch(progressProvider.select((p) => p.quizToday));
    final answered = saved != null && saved.id == q.id && saved.day == today.toIso8601String().substring(0, 10) ? saved.chosen : null;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionHeader('Quick Quiz'),
      SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(q.question, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          for (var i = 0; i < q.options.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _QuizOption(
                letter: String.fromCharCode(65 + i),
                text: q.options[i],
                state: answered == null ? null : (i == q.correct ? _OptionState.correct : (i == answered ? _OptionState.wrong : _OptionState.neutral)),
                onTap: answered != null
                    ? null
                    : () {
                        final right = ref.read(progressProvider.notifier).answerQuiz(q, i, today);
                        right ? HapticFeedback.heavyImpact() : HapticFeedback.vibrate();
                      },
              ),
            ),
          if (answered != null) ...[
            const SizedBox(height: 4),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(answered == q.correct ? Icons.check_circle_rounded : Icons.info_rounded, size: 18, color: answered == q.correct ? c.gain : c.warning),
              const SizedBox(width: 8),
              Expanded(child: Text('${answered == q.correct ? 'Correct! ' : 'Not quite. '}${q.explanation}', style: AppText.bodySmall(c.textSecondary))),
            ]),
            const SizedBox(height: 8),
            Text('A new question tomorrow.', style: AppText.caption(c.textMuted)),
          ],
        ]),
      ),
    ]);
  }
}

enum _OptionState { correct, wrong, neutral }

class _QuizOption extends StatelessWidget {
  const _QuizOption({required this.letter, required this.text, required this.state, required this.onTap});
  final String letter;
  final String text;
  final _OptionState? state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = switch (state) { _OptionState.correct => c.gain, _OptionState.wrong => c.loss, _ => c.border };
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      decoration: BoxDecoration(color: state == null || state == _OptionState.neutral ? c.background : color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(Gap.radiusButton), border: Border.all(color: color)),
      child: InkWell(
        borderRadius: BorderRadius.circular(Gap.radiusButton),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(children: [
            Text('$letter)', style: AppText.bodySmall(c.textSecondary).copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: AppText.bodySmall(c.textPrimary))),
            if (state == _OptionState.correct) Icon(Icons.check_circle_rounded, color: c.gain, size: 20),
            if (state == _OptionState.wrong) Icon(Icons.cancel_rounded, color: c.loss, size: 20),
          ]),
        ),
      ),
    );
  }
}

// Re-exported so Learn and Profile share the same quick-bookmark behaviour.
void quickBookmark(BuildContext context, WidgetRef ref, Article a) => _quickBookmark(context, ref, a);
