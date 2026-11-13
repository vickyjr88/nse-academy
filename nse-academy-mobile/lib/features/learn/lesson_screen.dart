import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/reflow.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/markdown_view.dart';
import '../../widgets/reading.dart';
import '../../widgets/upgrade_card.dart';

/// One lesson of a course (design section 4.9): text, progress through the course, and previous / next.
class LessonScreen extends ConsumerWidget {
  const LessonScreen({super.key, required this.courseId, required this.lessonId});
  final int courseId;
  final int lessonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final courses = ref.watch(coursesProvider);
    final tier = ref.watch(tierProvider);
    return courses.when(
      loading: () => Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorState(error: e, onRetry: () => ref.invalidate(coursesProvider))),
      data: (d) {
        final course = d.value.where((x) => x.id == courseId).firstOrNull;
        final lessons = course?.lessonsInOrder ?? const <LessonRef>[];
        final idx = lessons.indexWhere((l) => l.id == lessonId);
        if (course == null || idx < 0) return Scaffold(appBar: AppBar(), body: Center(child: Text('That lesson could not be found.', style: AppText.body(c.textSecondary))));
        final ref0 = lessons[idx];
        final open = CourseAccess.canOpenLesson(course, lessonId, tier);
        if (!open) {
          return Scaffold(
            appBar: AppBar(title: Text(ref0.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16), maxLines: 1)),
            body: ListView(padding: const EdgeInsets.all(Gap.screen), children: [
              Text(ref0.title, style: AppText.h1(c.textPrimary).copyWith(fontSize: 24)),
              const SizedBox(height: 16),
              UpgradeCard(required: CourseAccess.requiredTier(course), signedIn: ref.watch(authProvider).value?.signedIn ?? false, title: 'This lesson is locked'),
            ]),
          );
        }
        return _LessonBody(course: course, lessons: lessons, index: idx);
      },
    );
  }
}

/// The CMS cuts lesson titles short; when the text opens with the full title, show that one.
String _fullTitle(String cmsTitle, String? body) {
  if (body == null) return cmsTitle;
  final lead = leadingTitle(body);
  return lead != null && lead.length > cmsTitle.length && lead.startsWith(cmsTitle.trim()) ? lead : cmsTitle;
}

class _LessonBody extends ConsumerWidget {
  const _LessonBody({required this.course, required this.lessons, required this.index});
  final Course course;
  final List<LessonRef> lessons;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final cur = lessons[index];
    final tier = ref.watch(tierProvider);
    final prev = index > 0 && CourseAccess.canOpenLesson(course, lessons[index - 1].id, tier) ? lessons[index - 1] : null;
    final next = index < lessons.length - 1 ? lessons[index + 1] : null;
    final done = ref.watch(progressProvider.select((p) => p.lessonsDone.contains(cur.id)));
    final async = ref.watch(lessonProvider(cur.id));
    final module = course.modules.where((m) => m.lessons.any((l) => l.id == cur.id)).firstOrNull;
    // Held directly: the reading callbacks also run while this screen is closing, when `ref` can no longer be used.
    final progress = ref.read(progressProvider.notifier);

    return ReadingScaffold(
      title: module?.title ?? course.title,
      ready: async.hasValue,
      onProgress: (p) {
        progress.setLessonProgress(courseId: course.id, lesson: cur, progress: p);
        if (p >= 0.95 && !done) progress.completeLesson(cur.id);
      },
      onReadSeconds: progress.addReadSeconds,
      bottomBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screen, vertical: 8),
          decoration: BoxDecoration(color: c.background, border: Border(top: BorderSide(color: c.border))),
          child: Row(children: [
            Expanded(child: OutlinedButton.icon(onPressed: prev == null ? null : () => context.pushReplacement('/lesson/${course.id}/${prev.id}'), icon: const Icon(Icons.arrow_back_rounded, size: 18), label: const Text('Previous'))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: next == null ? null : () => context.pushReplacement('/lesson/${course.id}/${next.id}'), iconAlignment: IconAlignment.end, icon: const Icon(Icons.arrow_forward_rounded, size: 18), label: const Text('Next'))),
          ]),
        ),
      ),
      children: [
        Text('Lesson ${index + 1} of ${lessons.length}', style: AppText.caption(c.textSecondary)),
        const SizedBox(height: 6),
        AppProgressBar((index + 1) / lessons.length),
        const SizedBox(height: 16),
        Text(_fullTitle(cur.title, async.value?.value.body), style: AppText.h1(c.textPrimary).copyWith(fontSize: 24)),
        const SizedBox(height: 6),
        Row(children: [Icon(Icons.schedule_rounded, size: 14, color: c.textMuted), const SizedBox(width: 4), Text('${cur.minutes} min read', style: AppText.caption(c.textSecondary))]),
        const SizedBox(height: 18),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(lessonProvider(cur.id))),
          data: (d) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
            MarkdownView(reflowPlainText(d.value.body)),
          ]),
        ),
        const SizedBox(height: 24),
        if (!done)
          OutlinedButton.icon(
            onPressed: () {
              HapticFeedback.mediumImpact();
              ref.read(progressProvider.notifier).completeLesson(cur.id);
            },
            icon: const Icon(Icons.check_rounded),
            label: const Text('Mark as done'),
          )
        else
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.check_circle_rounded, color: c.gain, size: 18), const SizedBox(width: 6), Text('Lesson complete', style: AppText.bodySmall(c.gain).copyWith(fontWeight: FontWeight.w600))]),
        const SizedBox(height: 12),
        Text('Educational content only, not investment advice.', style: AppText.caption(c.textMuted), textAlign: TextAlign.center),
      ],
    );
  }
}
