import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/glossary_term.dart';
import '../../data/models/stock.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';
import '../../widgets/price_chart.dart';
import '../glossary/glossary_screen.dart';
import 'stock_member_sections.dart';

/// One company (design section 4.6): price, chart, key metrics, about, and glossary links.
class StockDetailScreen extends ConsumerStatefulWidget {
  const StockDetailScreen({super.key, required this.ticker});
  final String ticker;

  @override
  ConsumerState<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends ConsumerState<StockDetailScreen> {
  ChartRange _range = ChartRange.month;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final ticker = widget.ticker.toUpperCase();
    final stocks = ref.watch(stocksProvider);
    final saved = ref.watch(progressProvider.select((p) => p.bookmarkedStocks.contains(ticker)));
    return Scaffold(
      appBar: AppBar(
        title: Text(ticker, style: AppText.h3(c.textPrimary)),
        actions: [
          IconButton(
            tooltip: saved ? 'Remove from saved' : 'Save',
            icon: Icon(saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: saved ? c.primary : null),
            onPressed: () {
              HapticFeedback.mediumImpact();
              ref.read(progressProvider.notifier).toggleStockBookmark(ticker);
            },
          ),
        ],
      ),
      body: stocks.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(stocksProvider)),
        data: (d) {
          final s = d.value.where((x) => x.ticker == ticker).firstOrNull;
          if (s == null) return Center(child: Text('$ticker is not listed or has no recent price.', style: AppText.body(c.textSecondary)));
          return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
            if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
            Text(s.name, style: AppText.h2(c.textPrimary)),
            const SizedBox(height: 4),
            Row(children: [Text('NSE: ${s.ticker}', style: AppText.caption(c.textSecondary)), if (s.sector != null) ...[const SizedBox(width: 8), _Pill(s.sector!)]]),
            const SizedBox(height: 16),
            Text('KES ${formatPrice(s.price)}', style: AppText.price(c.textPrimary).copyWith(fontSize: 30, height: 1.2)),
            const SizedBox(height: 4),
            ChangeText(s.changePct, abs: s.changeAbs, style: AppText.bodySmall(c.textSecondary)),
            const SizedBox(height: 20),
            _ChartSection(ticker: ticker, range: _range, onRange: (r) => setState(() => _range = r), stock: s),
            const SizedBox(height: Gap.section),
            _Metrics(stock: s, ticker: ticker),
            if (s.description != null) ...[
              const SizedBox(height: Gap.section),
              Text('About', style: AppText.h3(c.textPrimary)),
              const SizedBox(height: 8),
              Text(s.description!, style: AppText.bodySmall(c.textSecondary).copyWith(height: 1.55), maxLines: _expanded ? null : 5, overflow: _expanded ? null : TextOverflow.ellipsis),
              TextButton(style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32), alignment: Alignment.centerLeft), onPressed: () => setState(() => _expanded = !_expanded), child: Text(_expanded ? 'Show less' : 'Read more', style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600))),
            ],
            const SizedBox(height: Gap.section),
            MemberStockSections(ticker: ticker, price: s.price),
            const SizedBox(height: 8),
            _LearnAbout(),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/companies/${s.ticker}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.open_in_new_rounded, size: 18), label: const Text('Full company page on the website')),
            const SizedBox(height: 16),
            Text('Prices are delayed and for information only. This is educational content, not investment advice.', style: AppText.caption(c.textMuted)),
          ]);
        },
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(Gap.radiusPill)), child: Text(text, style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w600)));
  }
}

class _ChartSection extends ConsumerWidget {
  const _ChartSection({required this.ticker, required this.range, required this.onRange, required this.stock});
  final String ticker;
  final ChartRange range;
  final ValueChanged<ChartRange> onRange;
  final Stock stock;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final hist = ref.watch(historyProvider(ticker));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      hist.when(
        loading: () => const Skeleton(height: 180),
        error: (e, _) => SizedBox(height: 180, child: Center(child: Text('The price chart is not available right now.', style: AppText.bodySmall(c.textSecondary)))),
        data: (d) {
          final pts = sliceRange(d.value, range);
          final days = d.value.isEmpty ? 0 : d.value.last.date.difference(d.value.first.date).inDays;
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            PriceChart(points: pts),
            if (days > 0 && days < range.days) Padding(padding: const EdgeInsets.only(top: 6), child: Text('We have $days days of price history for this stock so far.', style: AppText.caption(c.textMuted))),
          ]);
        },
      ),
      const SizedBox(height: 10),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        for (final r in ChartRange.values)
          GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onRange(r);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(color: r == range ? c.primarySurface : Colors.transparent, borderRadius: BorderRadius.circular(Gap.radiusPill)),
              child: Text(r.label, style: AppText.caption(r == range ? c.primary : c.textSecondary).copyWith(fontWeight: FontWeight.w700)),
            ),
          ),
      ]),
    ]);
  }
}

class _Metrics extends ConsumerWidget {
  const _Metrics({required this.stock, required this.ticker});
  final Stock stock;
  final String ticker;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final hist = ref.watch(historyProvider(ticker)).value?.value ?? const <PricePoint>[];
    final glossary = ref.watch(glossaryProvider).value?.value ?? const [];
    double? hi, lo;
    if (hist.length >= 2) {
      hi = hist.map((p) => p.price).reduce((a, b) => a > b ? a : b);
      lo = hist.map((p) => p.price).reduce((a, b) => a < b ? a : b);
    }
    final span = hist.length >= 2 ? hist.last.date.difference(hist.first.date).inDays : 0;
    final rangeLabel = span >= 350 ? '52W' : '${span}D';

    void term(String q) {
      final t = findTerm(glossary, q);
      if (t != null) {
        showGlossarySheet(context, t, glossary);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No glossary entry for "$q" yet.')));
      }
    }

    final tiles = <Widget>[
      MetricTile('Previous close', formatPrice(stock.previousClose)),
      MetricTile('Day change', signedPct(stock.changePct), color: ChangeText.colorFor(context, stock.changePct)),
      MetricTile('Volume', compactNumber(stock.volume), onTap: () => term('volume')),
      if (stock.dividendYield != null) MetricTile('Dividend yield', '${stock.dividendYield!.toStringAsFixed(1)}%', onTap: () => term('dividend yield')),
      if (hi != null && lo != null) ...[MetricTile('$rangeLabel high', formatPrice(hi)), MetricTile('$rangeLabel low', formatPrice(lo))],
      if (stock.risk != null) MetricTile('Risk level', stock.risk!.name[0].toUpperCase() + stock.risk!.name.substring(1)),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Key Metrics', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 2.4, children: tiles),
    ]);
  }
}

class _LearnAbout extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final glossary = ref.watch(glossaryProvider).value?.value ?? const [];
    final terms = [for (final q in ['dividend yield', 'p/e', 'market cap', 'volume', 'bid']) findTerm(glossary, q)].whereType<GlossaryTerm>().take(3).toList();
    if (terms.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 12),
      Text('Learn About This Stock', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      for (final t in terms)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Tappable(
            onTap: () => showGlossarySheet(context, t, glossary),
            child: SurfaceCard(child: Row(children: [Icon(Icons.menu_book_rounded, color: c.primary, size: 20), const SizedBox(width: 12), Expanded(child: Text('What is ${t.term}?', style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w600))), Icon(Icons.chevron_right_rounded, color: c.textMuted)])),
          ),
        ),
    ]);
  }
}
