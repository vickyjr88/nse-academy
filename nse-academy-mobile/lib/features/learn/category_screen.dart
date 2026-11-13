import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';
import '../home/home_screen.dart' show quickBookmark;

/// Every article in one category, newest first, loaded a page at a time.
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, required this.category});
  final String category;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  int _pages = 1;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final progress = ref.watch(progressProvider);
    final pages = [for (var p = 1; p <= _pages; p++) ref.watch(articlesProvider((category: widget.category, search: null, page: p)))];
    final first = pages.first;
    return Scaffold(
      appBar: AppBar(title: Text(widget.category, style: AppText.h3(c.textPrimary))),
      body: RefreshIndicator(
        onRefresh: () => refreshAll(ref),
        child: first.when(
          loading: () => ListView(padding: const EdgeInsets.all(Gap.screen), children: [for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.only(bottom: 12), child: Skeleton(height: 96))]),
          error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(articlesProvider)),
          data: (firstPage) {
            final articles = [for (final p in pages) ...?p.value?.value.articles];
            final hasMore = _pages < firstPage.value.pageCount;
            if (articles.isEmpty) return Center(child: Text('No articles in this category yet.', style: AppText.body(c.textSecondary)));
            return ListView(
              padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32),
              children: [
                if (firstPage.fromCache) CachedBanner(fetchedAt: firstPage.fetchedAt),
                for (final a in articles)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.cardGap),
                    child: ArticleCard(article: a, bookmarked: progress.isBookmarked(a.slug), progress: progress.articleProgress[a.slug], onTap: () => context.push('/article/${a.slug}'), onLongPress: () => quickBookmark(context, ref, a)),
                  ),
                if (hasMore) OutlinedButton(onPressed: () => setState(() => _pages++), child: const Text('Load more')),
              ],
            );
          },
        ),
      ),
    );
  }
}
