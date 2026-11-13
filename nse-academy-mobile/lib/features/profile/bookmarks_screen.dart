import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';

class BookmarksScreen extends ConsumerWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final p = ref.watch(progressProvider);
    final stocks = ref.watch(stocksProvider).value?.value ?? const [];
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(title: Text('Bookmarks', style: AppText.h3(c.textPrimary)), bottom: TabBar(labelColor: c.primary, indicatorColor: c.primary, tabs: [Tab(text: 'Articles (${p.bookmarks.length})'), Tab(text: 'Stocks (${p.bookmarkedStocks.length})')])),
        body: TabBarView(children: [
          p.bookmarks.isEmpty
              ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('No saved articles. Tap the bookmark on an article, or long-press an article card.', textAlign: TextAlign.center, style: AppText.body(c.textSecondary))))
              : ListView(padding: const EdgeInsets.all(Gap.screen), children: [
                  for (final a in p.bookmarks)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Gap.cardGap),
                      child: Dismissible(
                        key: ValueKey(a.slug),
                        direction: DismissDirection.endToStart,
                        background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), decoration: BoxDecoration(color: c.loss.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(Gap.radiusCard)), child: Icon(Icons.delete_outline_rounded, color: c.loss)),
                        onDismissed: (_) => ref.read(progressProvider.notifier).toggleBookmark(a),
                        child: ArticleCard(article: a, bookmarked: true, onTap: () => context.push('/article/${a.slug}')),
                      ),
                    ),
                ]),
          p.bookmarkedStocks.isEmpty
              ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('No saved stocks. Tap the bookmark on a stock.', textAlign: TextAlign.center, style: AppText.body(c.textSecondary))))
              : ListView(padding: const EdgeInsets.all(Gap.screen), children: [
                  for (final t in p.bookmarkedStocks)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: () {
                        final s = stocks.where((x) => x.ticker == t).firstOrNull;
                        return s != null
                            ? StockRow(stock: s, bookmarked: true, onTap: () => context.push('/stock/$t'))
                            : ListTile(tileColor: c.surface, title: Text(t), subtitle: const Text('No recent price'), onTap: () => context.push('/stock/$t'));
                      }(),
                    ),
                ]),
        ]),
      ),
    );
  }
}
