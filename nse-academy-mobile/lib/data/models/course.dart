import 'article.dart';

enum Tier {
  free,
  intermediary,
  premium;

  static Tier parse(String? s) => switch (s) { 'premium' => Tier.premium, 'intermediary' => Tier.intermediary, _ => Tier.free };
  String get label => switch (this) { Tier.free => 'Free', Tier.intermediary => 'Intermediary', Tier.premium => 'Premium' };
  bool atLeast(Tier other) => index >= other.index;
}

class LessonRef {
  const LessonRef({required this.id, required this.title, required this.minutes, required this.isPremium});
  final int id;
  final String title;
  final int minutes;
  final bool isPremium;

  factory LessonRef.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    return LessonRef(id: (raw['id'] as num).toInt(), title: a['title'] as String? ?? '', minutes: (a['duration_minutes'] as num?)?.toInt() ?? 5, isPremium: a['is_premium'] == true);
  }
}

class CourseModule {
  const CourseModule({required this.id, required this.title, required this.order, required this.lessons});
  final int id;
  final String title;
  final int order;
  final List<LessonRef> lessons;

  factory CourseModule.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    final lessons = ((a['lessons'] as List?) ?? const []).map((e) => LessonRef.fromJson((e as Map).cast<String, dynamic>())).toList()..sort((x, y) => x.id.compareTo(y.id));
    return CourseModule(id: (raw['id'] as num).toInt(), title: a['title'] as String? ?? '', order: (a['order'] as num?)?.toInt() ?? 0, lessons: lessons);
  }
}

class Course {
  const Course({required this.id, required this.title, required this.description, required this.modules});
  final int id;
  final String title;
  final String description;
  final List<CourseModule> modules;

  int get lessonCount => modules.fold(0, (n, m) => n + m.lessons.length);
  int get totalMinutes => modules.fold(0, (n, m) => n + m.lessons.fold(0, (k, l) => k + l.minutes));

  /// Every lesson in reading order (module order, then lesson order), so previous and next can cross module boundaries.
  List<LessonRef> get lessonsInOrder => [for (final m in modules) ...m.lessons];

  factory Course.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    final modules = ((a['modules'] as List?) ?? const []).map((e) => CourseModule.fromJson((e as Map).cast<String, dynamic>())).toList()..sort((x, y) => x.order.compareTo(y.order));
    return Course(id: (raw['id'] as num).toInt(), title: a['title'] as String? ?? '', description: a['description'] as String? ?? '', modules: modules);
  }
}

List<Course> parseCourses(dynamic json) => (((json as Map)['data'] as List?) ?? const []).map((e) => Course.fromJson((e as Map).cast<String, dynamic>())).toList();

/// The plan a course needs, and which of its modules are open to everyone: the same rules the website applies.
/// The trading guide needs Intermediary; the investor's guide is Premium with its first three modules free.
class CourseAccess {
  static Tier requiredTier(Course c) => c.title.toLowerCase().contains('trading') ? Tier.intermediary : Tier.premium;

  static const freePreviewModules = 3;

  static bool isFreePreviewCourse(Course c) => requiredTier(c) == Tier.premium;

  static bool canOpenModule(Course c, int moduleIndex, Tier tier) {
    if (tier.atLeast(requiredTier(c))) return true;
    return isFreePreviewCourse(c) && moduleIndex < freePreviewModules;
  }

  static bool canOpenLesson(Course c, int lessonId, Tier tier) {
    for (var i = 0; i < c.modules.length; i++) {
      if (c.modules[i].lessons.any((l) => l.id == lessonId)) return canOpenModule(c, i, tier);
    }
    return false;
  }
}

class Lesson {
  const Lesson({required this.id, required this.title, required this.body, required this.minutes});
  final int id;
  final String title;
  final String body;
  final int minutes;

  static Lesson? fromList(dynamic json) {
    final data = ((json as Map)['data'] as List?) ?? const [];
    if (data.isEmpty) return null;
    final raw = (data.first as Map).cast<String, dynamic>();
    final a = flat(raw);
    return Lesson(id: (raw['id'] as num).toInt(), title: a['title'] as String? ?? '', body: a['body_markdown'] as String? ?? '', minutes: (a['duration_minutes'] as num?)?.toInt() ?? 5);
  }
}
