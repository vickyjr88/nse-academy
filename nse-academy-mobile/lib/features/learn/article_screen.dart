import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/article.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/markdown_view.dart';
import '../../widgets/reading.dart';

/// A full article (design section 4.4). Falls back to the bookmarked copy when offline.
class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(articleProvider(slug));
    final saved = ref.watch(progressProvider).bookmarks.where((a) => a.slug == slug && (a.body ?? '').isNotEmpty).firstOrNull;
    return async.when(
      data: (d) => _ArticleBody(article: d.value, fromCache: d.fromCache, fetchedAt: d.fetchedAt),
      loading: () => saved != null ? _ArticleBody(article: saved, fromCache: false, fetchedAt: DateTime.now()) : Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator())),
      error: (e, _) => saved != null
          ? _ArticleBody(article: saved, fromCache: true, fetchedAt: saved.publishedAt)
          : Scaffold(appBar: AppBar(), body: ErrorState(error: e, onRetry: () => ref.invalidate(articleProvider(slug)))),
    );
  }
}

class _ArticleBody extends ConsumerStatefulWidget {
  const _ArticleBody({required this.article, required this.fromCache, required this.fetchedAt});
  final Article article;
  final bool fromCache;
  final DateTime fetchedAt;

  @override
  ConsumerState<_ArticleBody> createState() => _ArticleBodyState();
}

class _ArticleBodyState extends ConsumerState<_ArticleBody> {
  // Held directly: the reading callbacks also run while this screen is closing, when `ref` can no longer be used.
  late final ProgressNotifier _progress = ref.read(progressProvider.notifier);

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _progress.markArticleOpened(widget.article));
  }

  void _toggleBookmark() {
    HapticFeedback.mediumImpact();
    final now = _progress.toggleBookmark(widget.article);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(now ? 'Saved to bookmarks (available offline)' : 'Bookmark removed'), duration: const Duration(seconds: 2)));
  }

  Future<void> _share() => SharePlus.instance.share(ShareParams(text: '${widget.article.title}\n${AppConfig.siteBase}/blog/${widget.article.slug}', subject: widget.article.title));

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final a = widget.article;
    final bookmarked = ref.watch(progressProvider.select((p) => p.isBookmarked(a.slug)));
    final related = ref.watch(recentArticlesProvider).value?.value.articles.where((r) => r.slug != a.slug && r.category == a.category).take(6).toList() ?? const <Article>[];
    final body = (a.body ?? '').trim();

    return ReadingScaffold(
      title: a.category,
      actions: [
        IconButton(tooltip: bookmarked ? 'Remove bookmark' : 'Bookmark', onPressed: _toggleBookmark, icon: Icon(bookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: bookmarked ? c.primary : null)),
        IconButton(tooltip: 'Share', onPressed: _share, icon: const Icon(Icons.ios_share_rounded)),
      ],
      onProgress: (p) => _progress.setArticleProgress(a, p),
      onReadSeconds: _progress.addReadSeconds,
      children: [
        if (widget.fromCache) CachedBanner(fetchedAt: widget.fetchedAt),
        if (a.coverImageUrl != null)
          Padding(padding: const EdgeInsets.only(bottom: 16), child: ClipRRect(borderRadius: BorderRadius.circular(Gap.radiusCard), child: Image.network(a.coverImageUrl!, fit: BoxFit.cover, height: 190, width: double.infinity, errorBuilder: (_, _, _) => const SizedBox.shrink()))),
        Align(alignment: Alignment.centerLeft, child: CategoryBadge(a.category)),
        const SizedBox(height: 12),
        Text(a.title, style: AppText.h1(c.textPrimary)),
        const SizedBox(height: 10),
        Wrap(spacing: 14, runSpacing: 4, children: [
          _Meta(Icons.calendar_today_rounded, formatDate(a.publishedAt)),
          _Meta(Icons.schedule_rounded, '${a.readTimeMinutes} min read'),
          _Meta(Icons.person_outline_rounded, a.authorName),
        ]),
        const SizedBox(height: 16),
        const Divider(),
        const SizedBox(height: 16),
        if (body.isEmpty) Text(a.excerpt, style: AppText.body(c.textPrimary)) else MarkdownView(body),
        const SizedBox(height: 24),
        CalloutBlock(
          kind: CalloutKind.warning,
          child: Text('Educational content only, not investment advice. Prices and figures may be delayed or change. Check with a licensed adviser before you invest.', style: AppText.bodySmall(c.textPrimary)),
        ),
        if (related.isNotEmpty) ...[
          const SizedBox(height: 28),
          Text('Related Articles', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 12),
          SizedBox(
            height: 132,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: related.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) => Tappable(
                onTap: () => context.pushReplacement('/article/${related[i].slug}'),
                child: Container(
                  width: 220,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: c.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: Text(related[i].title, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w600), maxLines: 4, overflow: TextOverflow.ellipsis)),
                    Text('${related[i].readTimeMinutes} min', style: AppText.caption(c.textSecondary)),
                  ]),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14, color: c.textMuted), const SizedBox(width: 4), Text(text, style: AppText.caption(c.textSecondary))]);
  }
}
