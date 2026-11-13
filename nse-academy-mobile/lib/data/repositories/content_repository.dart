import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/json_cache.dart';
import '../models/article.dart';
import '../models/course.dart';
import '../models/glossary_term.dart';
import '../models/stock.dart';

/// Articles, glossary, company profiles and courses from the CMS's public read API.
class ContentRepository {
  ContentRepository(this._api, this._cache);
  final ApiClient _api;
  final JsonCache _cache;

  static const _listFields = ['title', 'slug', 'excerpt', 'category', 'read_time_minutes', 'publishedAt', 'author_name', 'is_premium', 'tags', 'og_image_url'];

  Uri _uri(String path, Map<String, String> q) => Uri.parse('${AppConfig.cmsBase}/api/$path').replace(queryParameters: q);

  Future<Cached<ArticlePage>> articles({String? category, String? search, int page = 1, int pageSize = 20, bool forceRefresh = false}) {
    final q = <String, String>{
      'pagination[page]': '$page',
      'pagination[pageSize]': '$pageSize',
      'sort[0]': 'publishedAt:desc',
      'populate[cover_image]': 'true',
      for (var i = 0; i < _listFields.length; i++) 'fields[$i]': _listFields[i],
      'filters[category][\$eq]': ?category,
      if (search != null && search.trim().isNotEmpty) ...{
        'filters[\$or][0][title][\$containsi]': search.trim(),
        'filters[\$or][1][excerpt][\$containsi]': search.trim(),
      },
    };
    final searching = search != null && search.trim().isNotEmpty;
    return _cache.load(
      key: 'articles:${category ?? 'all'}:p$page:s$pageSize:${searching ? 'q=${search.trim().toLowerCase()}' : ''}',
      ttl: searching ? const Duration(minutes: 2) : const Duration(minutes: 15),
      forceRefresh: forceRefresh,
      fetch: () => _api.getJson(_uri('articles', q)),
      parse: ArticlePage.fromJson,
    );
  }

  /// How many articles each category has, for the Learn tab's category tiles.
  Future<Cached<Map<String, int>>> categoryCounts({bool forceRefresh = false}) => _cache.load(
        key: 'articles:counts',
        ttl: const Duration(minutes: 15),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('articles', {'fields[0]': 'category', 'pagination[pageSize]': '200'})),
        parse: (json) {
          final counts = <String, int>{};
          for (final e in ((json as Map)['data'] as List? ?? const [])) {
            final c = flat((e as Map).cast<String, dynamic>())['category'] as String? ?? 'NSE News';
            counts[c] = (counts[c] ?? 0) + 1;
          }
          return counts;
        },
      );

  Future<Cached<Article>> article(String slug, {bool forceRefresh = false}) => _cache.load(
        key: 'article:$slug',
        ttl: const Duration(hours: 1),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('articles', {'filters[slug][\$eq]': slug, 'populate[cover_image]': 'true'})),
        parse: (json) {
          final data = ((json as Map)['data'] as List?) ?? const [];
          if (data.isEmpty) throw ApiException('That article could not be found.', statusCode: 404);
          return Article.fromJson((data.first as Map).cast<String, dynamic>());
        },
      );

  Future<Cached<List<GlossaryTerm>>> glossary({bool forceRefresh = false}) => _cache.load(
        key: 'glossary',
        ttl: const Duration(hours: 24),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('glossary-terms', {'pagination[limit]': '500', 'sort': 'term:asc'})),
        parse: parseGlossary,
      );

  Future<Cached<List<StockProfile>>> profiles({bool forceRefresh = false}) => _cache.load(
        key: 'profiles',
        ttl: const Duration(hours: 6),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('stock-profiles', {'pagination[pageSize]': '200', 'sort[0]': 'ticker:asc'})),
        parse: parseProfiles,
      );

  Future<Cached<List<Course>>> courses({bool forceRefresh = false}) => _cache.load(
        key: 'courses',
        ttl: const Duration(hours: 6),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('courses', {'populate[modules][populate]': 'lessons', 'sort': 'createdAt:asc'})),
        parse: parseCourses,
      );

  Future<Cached<Lesson>> lesson(int id, {bool forceRefresh = false}) => _cache.load(
        key: 'lesson:$id',
        ttl: const Duration(hours: 12),
        forceRefresh: forceRefresh,
        fetch: () => _api.getJson(_uri('lessons', {'filters[id][\$eq]': '$id'})),
        parse: (json) => Lesson.fromList(json) ?? (throw ApiException('That lesson could not be found.', statusCode: 404)),
      );

  Future<void> refreshContent() async {
    await _cache.expire('articles');
    await _cache.expire('glossary');
    await _cache.expire('profiles');
    await _cache.expire('courses');
  }
}
