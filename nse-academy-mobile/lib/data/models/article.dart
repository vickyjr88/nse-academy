import '../../core/config.dart';

/// Strapi 5 returns fields directly; Strapi 4 nested them under `attributes`. Accept both.
Map<String, dynamic> flat(Map<String, dynamic> raw) => (raw['attributes'] is Map) ? {...raw, ...(raw['attributes'] as Map).cast<String, dynamic>()} : raw;

List<String> stringList(dynamic v) {
  if (v is List) return v.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
  if (v is String) return v.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  return const [];
}

String? absoluteCmsUrl(String? path) {
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return '${AppConfig.cmsBase}$path';
}

/// The seven real article categories (as in the CMS).
const articleCategories = <String>[
  'Daily Update',
  'NSE News',
  'Weekly Roundup',
  'Market Analysis',
  'Stock Deep Dive',
  'IPO Watch',
  'Investor Education',
];

class Article {
  const Article({
    required this.id,
    required this.slug,
    required this.title,
    required this.excerpt,
    required this.category,
    required this.authorName,
    required this.readTimeMinutes,
    required this.publishedAt,
    this.body,
    this.coverImageUrl,
    this.tags = const [],
    this.isPremium = false,
  });

  final int id;
  final String slug;
  final String title;
  final String excerpt;
  final String category;
  final String authorName;
  final int readTimeMinutes;
  final DateTime publishedAt;
  final String? body;
  final String? coverImageUrl;
  final List<String> tags;
  final bool isPremium;

  factory Article.fromJson(Map<String, dynamic> raw) {
    final a = flat(raw);
    final cover = a['cover_image'];
    String? coverUrl;
    if (cover is Map) {
      final c = cover['data'] is Map ? flat((cover['data'] as Map).cast<String, dynamic>()) : cover.cast<String, dynamic>();
      coverUrl = absoluteCmsUrl(c['url'] as String?);
    }
    coverUrl ??= a['og_image_url'] is String && (a['og_image_url'] as String).isNotEmpty ? a['og_image_url'] as String : null;
    return Article(
      id: (raw['id'] as num?)?.toInt() ?? 0,
      slug: a['slug'] as String? ?? '',
      title: a['title'] as String? ?? 'Untitled',
      excerpt: a['excerpt'] as String? ?? '',
      category: a['category'] as String? ?? 'NSE News',
      authorName: a['author_name'] as String? ?? 'NSE Academy',
      readTimeMinutes: (a['read_time_minutes'] as num?)?.toInt() ?? 5,
      publishedAt: DateTime.tryParse((a['publishedAt'] ?? a['createdAt'] ?? '') as String) ?? DateTime.fromMillisecondsSinceEpoch(0),
      body: a['body'] as String?,
      coverImageUrl: coverUrl,
      tags: stringList(a['tags']),
      isPremium: a['is_premium'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'title': title,
        'excerpt': excerpt,
        'category': category,
        'author_name': authorName,
        'read_time_minutes': readTimeMinutes,
        'publishedAt': publishedAt.toIso8601String(),
        'body': body,
        'og_image_url': coverImageUrl,
        'tags': tags,
        'is_premium': isPremium,
      };
}

class ArticlePage {
  const ArticlePage(this.articles, this.total, this.pageCount);
  final List<Article> articles;
  final int total;
  final int pageCount;

  factory ArticlePage.fromJson(dynamic json) {
    final m = (json as Map).cast<String, dynamic>();
    final list = ((m['data'] as List?) ?? const []).map((e) => Article.fromJson((e as Map).cast<String, dynamic>())).toList();
    final p = (m['meta'] is Map ? (m['meta'] as Map)['pagination'] : null) as Map?;
    return ArticlePage(list, (p?['total'] as num?)?.toInt() ?? list.length, (p?['pageCount'] as num?)?.toInt() ?? 1);
  }
}
