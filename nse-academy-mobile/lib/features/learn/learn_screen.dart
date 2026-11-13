import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/article.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';

/// The educational hub (design section 4.3): courses and article categories.
class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final courses = ref.watch(coursesProvider);
    final counts = ref.watch(categoryCountsProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Learn', style: AppText.h2(c.textPrimary)), actions: [IconButton(tooltip: 'Search', onPressed: () => context.push('/search'), icon: const Icon(Icons.search_rounded))]),
      body: RefreshIndicator(
        onRefresh: () => refreshAll(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32),
          children: [
            const SectionHeader('Courses'),
            courses.when(
              loading: () => const Column(children: [Skeleton(height: 130), SizedBox(height: 12), Skeleton(height: 130)]),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(coursesProvider)),
              data: (d) => Column(children: [
                if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
                for (final course in d.value) Padding(padding: const EdgeInsets.only(bottom: Gap.cardGap), child: _CourseCard(course: course)),
              ]),
            ),
            const SizedBox(height: Gap.section - 8),
            const SectionHeader('Browse by Category'),
            counts.when(
              loading: () => const Skeleton(height: 200),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(categoryCountsProvider)),
              data: (d) {
                final cats = [...articleCategories]..sort((a, b) => (d.value[b] ?? 0).compareTo(d.value[a] ?? 0));
                return GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.25,
                  children: [for (final cat in cats) _CategoryTile(category: cat, count: d.value[cat] ?? 0)],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CourseCard extends ConsumerWidget {
  const _CourseCard({required this.course});
  final Course course;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final tier = ref.watch(tierProvider);
    final done = ref.watch(progressProvider.select((p) => p.lessonsDone));
    final lessons = course.lessonsInOrder;
    final doneHere = lessons.where((l) => done.contains(l.id)).length;
    final progress = lessons.isEmpty ? 0.0 : doneHere / lessons.length;
    final required = CourseAccess.requiredTier(course);
    final open = tier.atLeast(required);
    final preview = CourseAccess.isFreePreviewCourse(course) && !open;
    final hours = (course.totalMinutes / 60);
    return Tappable(
      onTap: () => context.push('/course/${course.id}'),
      child: SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(10)), child: Icon(required == Tier.intermediary ? Icons.candlestick_chart_rounded : Icons.menu_book_rounded, color: c.primary)),
            const SizedBox(width: 12),
            Expanded(child: Text(course.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16), maxLines: 2, overflow: TextOverflow.ellipsis)),
          ]),
          const SizedBox(height: 10),
          Text('${course.modules.length} chapters · ${course.lessonCount} lessons · ${hours < 1 ? '${course.totalMinutes} min' : '${hours.toStringAsFixed(hours >= 10 ? 0 : 1)} h'}', style: AppText.caption(c.textSecondary)),
          const SizedBox(height: 10),
          AppProgressBar(progress, showLabel: true),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: Align(alignment: Alignment.centerLeft, child: open || preview ? ArrowLink(open ? (doneHere == 0 ? 'Start learning' : 'Continue') : 'First ${CourseAccess.freePreviewModules} chapters free') : Text('Needs the ${required.label} plan', style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600)))),
            if (!open && !preview) Icon(Icons.lock_rounded, size: 16, color: c.textMuted),
          ]),
        ]),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.count});
  final String category;
  final int count;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = CategoryBadge.colorFor(context, category);
    return Tappable(
      onTap: () => context.push('/category/${Uri.encodeComponent(category)}'),
      child: SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)), child: Icon(iconForCategory(category), color: color, size: 20)),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(category, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('$count item${count == 1 ? '' : 's'}', style: AppText.caption(c.textSecondary)),
          ]),
        ]),
      ),
    );
  }
}
