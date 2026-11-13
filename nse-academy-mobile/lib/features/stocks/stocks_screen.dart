import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/stock.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';

enum StockSort {
  name('A–Z'),
  gainers('Top gainers'),
  losers('Top losers'),
  traded('Most traded');

  const StockSort(this.label);
  final String label;
}

/// Sector filter, search and sort over the stock list. Pure so it can be tested.
List<Stock> filterStocks(List<Stock> all, {String? sector, String query = '', StockSort sort = StockSort.name, Set<String>? only}) {
  final q = query.trim().toLowerCase();
  var out = all.where((s) {
    if (only != null && !only.contains(s.ticker)) return false;
    if (sector != null && (s.sector ?? 'Other') != sector) return false;
    if (q.isNotEmpty && !(s.ticker.toLowerCase().contains(q) || s.name.toLowerCase().contains(q))) return false;
    return true;
  }).toList();
  switch (sort) {
    case StockSort.name:
      out.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    case StockSort.gainers:
      out.sort((a, b) => b.changePct.compareTo(a.changePct));
    case StockSort.losers:
      out.sort((a, b) => a.changePct.compareTo(b.changePct));
    case StockSort.traded:
      out.sort((a, b) => b.valueTraded.compareTo(a.valueTraded));
  }
  return out;
}

/// The market overview (design section 4.5).
class StocksScreen extends ConsumerStatefulWidget {
  const StocksScreen({super.key});

  @override
  ConsumerState<StocksScreen> createState() => _StocksScreenState();
}

class _StocksScreenState extends ConsumerState<StocksScreen> {
  String? _sector;
  StockSort _sort = StockSort.name;
  bool _searching = false;
  bool _savedOnly = false;
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(stocksProvider);
    final saved = ref.watch(progressProvider.select((p) => p.bookmarkedStocks)).toSet();
    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(controller: _search, autofocus: true, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'Search company or ticker', border: InputBorder.none))
            : Text('NSE Stocks', style: AppText.h2(c.textPrimary)),
        actions: [IconButton(tooltip: _searching ? 'Close search' : 'Search', onPressed: () => setState(() { _searching = !_searching; if (!_searching) _search.clear(); }), icon: Icon(_searching ? Icons.close_rounded : Icons.search_rounded))],
      ),
      body: async.when(
        loading: () => ListView(padding: const EdgeInsets.all(Gap.screen), children: [const Skeleton(height: 110), for (var i = 0; i < 5; i++) const Padding(padding: EdgeInsets.only(top: 12), child: Skeleton(height: 72))]),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(stocksProvider)),
        data: (d) {
          final all = d.value;
          final sectors = {for (final s in all) s.sector ?? 'Other'}.toList()..sort();
          final shown = filterStocks(all, sector: _sector, query: _search.text, sort: _sort, only: _savedOnly ? saved : null);
          return RefreshIndicator(
            onRefresh: () => refreshAll(ref),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32),
              children: [
                if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
                _MarketSummary(stocks: all, updatedAt: d.fetchedAt),
                const SizedBox(height: 16),
                SizedBox(
                  height: 38,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    _Chip('All', _sector == null && !_savedOnly, () => setState(() { _sector = null; _savedOnly = false; })),
                    if (saved.isNotEmpty) _Chip('Saved', _savedOnly, () => setState(() => _savedOnly = !_savedOnly)),
                    for (final s in sectors) _Chip(s, _sector == s, () => setState(() => _sector = _sector == s ? null : s)),
                  ]),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: Text('${shown.length} Listed ${shown.length == 1 ? 'Company' : 'Companies'}', style: AppText.bodySmall(c.textSecondary).copyWith(fontWeight: FontWeight.w600))),
                  DropdownButton<StockSort>(
                    value: _sort,
                    underline: const SizedBox.shrink(),
                    style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600),
                    items: [for (final s in StockSort.values) DropdownMenuItem(value: s, child: Text(s.label))],
                    onChanged: (v) => setState(() => _sort = v ?? _sort),
                  ),
                ]),
                const SizedBox(height: 4),
                if (shown.isEmpty)
                  Padding(padding: const EdgeInsets.all(40), child: Center(child: Text('No companies match.', style: AppText.body(c.textSecondary))))
                else
                  for (final s in shown) Padding(padding: const EdgeInsets.only(bottom: 10), child: StockRow(stock: s, bookmarked: saved.contains(s.ticker), onTap: () => context.push('/stock/${s.ticker}'))),
                const SizedBox(height: 8),
                Text('Prices are delayed and for information only. Last updated ${formatShortDate(d.fetchedAt)}, ${d.fetchedAt.toLocal().hour.toString().padLeft(2, '0')}:${d.fetchedAt.toLocal().minute.toString().padLeft(2, '0')}.', style: AppText.caption(c.textMuted)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.selected, this.onTap);
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        labelStyle: AppText.caption(selected ? c.primary : c.textSecondary).copyWith(fontWeight: FontWeight.w600),
        selectedColor: c.primarySurface,
        backgroundColor: c.surface,
        side: BorderSide(color: selected ? c.primary : c.border),
        showCheckmark: false,
      ),
    );
  }
}

/// How the market is moving right now, worked out from the latest prices, with the latest daily report one tap away.
class _MarketSummary extends ConsumerWidget {
  const _MarketSummary({required this.stocks, required this.updatedAt});
  final List<Stock> stocks;
  final DateTime updatedAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final up = stocks.where((s) => s.isUp).length;
    final down = stocks.where((s) => s.isDown).length;
    final flat = stocks.length - up - down;
    final value = stocks.fold<double>(0, (a, s) => a + s.valueTraded);
    final report = ref.watch(reportProvider).value?.value;
    return SurfaceCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Market today', style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        Row(children: [
          _Stat('$up', 'Advancers', c.gain),
          _Stat('$down', 'Decliners', c.loss),
          _Stat('$flat', 'Unchanged', c.textSecondary),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: SizedBox(
            height: 8,
            child: Row(children: [
              if (up > 0) Expanded(flex: up, child: Container(color: c.gain)),
              if (flat > 0) Expanded(flex: flat, child: Container(color: c.border)),
              if (down > 0) Expanded(flex: down, child: Container(color: c.loss)),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Text('Value traded: KES ${compactNumber(value)}', style: AppText.bodySmall(c.textSecondary)),
        if (report != null && report.url.isNotEmpty)
          TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 30), alignment: Alignment.centerLeft),
            onPressed: () => launchUrl(Uri.parse(report.url), mode: LaunchMode.externalApplication),
            child: const ArrowLink('Read the latest daily report'),
          ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label, this.color);
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: AppText.price(color)),
          Text(label, style: AppText.caption(context.c.textSecondary)),
        ]),
      );
}
