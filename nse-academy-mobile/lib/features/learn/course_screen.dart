import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/upgrade_card.dart';

/// A course's chapters and lessons, with locks for what the member's plan does not include.
class CourseScreen extends ConsumerWidget {
  const CourseScreen({super.key, required this.courseId});
  final int courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final async = ref.watch(coursesProvider);
    final tier = ref.watch(tierProvider);
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    final done = ref.watch(progressProvider.select((p) => p.lessonsDone));
    return Scaffold(
      appBar: AppBar(title: Text('Course', style: AppText.h3(c.textPrimary))),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          error: e,
          onRetry: () => ref.invalidate(coursesProvider),
        ),
        data: (d) {
          final course = d.value.where((x) => x.id == courseId).firstOrNull;
          if (course == null) {
            return Center(
              child: Text(
                'That course could not be found.',
                style: AppText.body(c.textSecondary),
              ),
            );
          }
          final required = CourseAccess.requiredTier(course);
          final lessons = course.lessonsInOrder;
          final doneHere = lessons.where((l) => done.contains(l.id)).length;
          final firstOpen = lessons
              .where(
                (l) =>
                    !done.contains(l.id) &&
                    CourseAccess.canOpenLesson(course, l.id, tier),
              )
              .firstOrNull;
          return ListView(
            padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32),
            children: [
              Text(
                course.title,
                style: AppText.h1(c.textPrimary).copyWith(fontSize: 24),
              ),
              if (course.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  course.description,
                  style: AppText.bodySmall(c.textSecondary),
                ),
              ],
              const SizedBox(height: 14),
              AppProgressBar(
                lessons.isEmpty ? 0 : doneHere / lessons.length,
                showLabel: true,
              ),
              const SizedBox(height: 4),
              Text(
                '$doneHere of ${lessons.length} lessons done',
                style: AppText.caption(c.textSecondary),
              ),
              if (firstOpen != null) ...[
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () =>
                      context.push('/lesson/${course.id}/${firstOpen.id}'),
                  child: Text(
                    doneHere == 0
                        ? 'Start the first lesson'
                        : 'Continue: ${firstOpen.title}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
              if (!tier.atLeast(required)) ...[
                const SizedBox(height: 14),
                UpgradeCard(
                  required: required,
                  signedIn: signedIn,
                  title: CourseAccess.isFreePreviewCourse(course)
                      ? 'The first ${CourseAccess.freePreviewModules} chapters are free'
                      : '${required.label} course',
                ),
              ],
              const SizedBox(height: 20),
              for (var i = 0; i < course.modules.length; i++)
                _ModuleTile(course: course, index: i, tier: tier, done: done),
            ],
          );
        },
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({
    required this.course,
    required this.index,
    required this.tier,
    required this.done,
  });
  final Course course;
  final int index;
  final Tier tier;
  final Set<int> done;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final m = course.modules[index];
    final open = CourseAccess.canOpenModule(course, index, tier);
    final doneCount = m.lessons.where((l) => done.contains(l.id)).length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: c.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Gap.radiusCard),
          side: BorderSide(color: c.border),
        ),
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            shape: const Border(),
            collapsedShape: const Border(),
            initiallyExpanded: index == 0 && open,
            title: Text(
              m.title,
              style: AppText.bodySmall(
                c.textPrimary,
              ).copyWith(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              open
                  ? '$doneCount / ${m.lessons.length} lessons'
                  : 'Locked · ${m.lessons.length} lessons',
              style: AppText.caption(c.textSecondary),
            ),
            leading: Icon(
              open ? Icons.folder_open_rounded : Icons.lock_rounded,
              color: open ? c.primary : c.textMuted,
              size: 20,
            ),
            children: [
              for (final l in m.lessons)
                ListTile(
                  dense: true,
                  enabled: true,
                  leading: Icon(
                    done.contains(l.id)
                        ? Icons.check_circle_rounded
                        : (open
                              ? Icons.play_circle_outline_rounded
                              : Icons.lock_outline_rounded),
                    size: 20,
                    color: done.contains(l.id)
                        ? c.gain
                        : (open ? c.primary : c.textMuted),
                  ),
                  title: Text(
                    l.title,
                    style: AppText.bodySmall(
                      open ? c.textPrimary : c.textMuted,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Text(
                    '${l.minutes} min',
                    style: AppText.caption(c.textMuted),
                  ),
                  onTap: () => context.push('/lesson/${course.id}/${l.id}'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
