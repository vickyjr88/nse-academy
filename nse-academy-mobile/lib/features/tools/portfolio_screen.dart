import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';
import 'dividend_form.dart';

/// Refreshes everything that depends on the journal after a trade, dividend or cost changes.
void refreshJournal(WidgetRef ref) {
  for (final p in [portfolioProvider, tradesProvider, realizedProvider, dividendsProvider, yieldOnCostProvider, allocationProvider, watchProvider]) {
    ref.invalidate(p);
  }
}


/// Lets the member pick a CDS statement (PDF) and seeds their holdings from it.
Future<void> importStatement(BuildContext context, WidgetRef ref) async {
  final file = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf']);
  if (file == null || !context.mounted) return;
  final List<int> bytes;
  try {
    bytes = await file.readAsBytes();
  } catch (_) {
    if (context.mounted) showMessage(context, 'That file could not be read. Try another copy of the statement.');
    return;
  }
  if (!context.mounted) return;
  if (bytes.length > 10 * 1024 * 1024) return showMessage(context, 'That file is too large. Statements must be under 10 MB.');
  showMessage(context, 'Reading your statement…');
  try {
    final n = await ref.read(memberRepositoryProvider).importStatement(bytes, file.name);
    refreshJournal(ref);
    if (context.mounted) showMessage(context, n > 0 ? 'Imported $n ${n == 1 ? 'holding' : 'holdings'}. Costs are estimates until you enter the real ones.' : 'Statement imported.');
  } on ApiException catch (e) {
    if (context.mounted) showMessage(context, e.message);
  }
}

class PortfolioScreen extends ConsumerStatefulWidget {
  const PortfolioScreen({super.key});
  @override
  ConsumerState<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends ConsumerState<PortfolioScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this)..addListener(() => setState(() {}));

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final allowed = ref.watch(tierProvider).atLeast(Tier.intermediary) && (ref.watch(authProvider).value?.signedIn ?? false);
    return Scaffold(
      appBar: AppBar(
        title: Text('Portfolio journal', style: AppText.h3(c.textPrimary)),
        actions: [
          if (allowed && _tabs.index <= 2)
            TextButton.icon(
              onPressed: () async {
                if (_tabs.index == 2) {
                  await showDividendSheet(context, ref);
                } else {
                  await context.push('/tools/trade');
                }
              },
              icon: const Icon(Icons.add_rounded, size: 20),
              label: Text(_tabs.index == 2 ? 'Dividend' : 'Trade'),
            ),
          const SizedBox(width: 8),
        ],
        bottom: allowed ? TabBar(controller: _tabs, isScrollable: true, tabAlignment: TabAlignment.start, tabs: const [Tab(text: 'Holdings'), Tab(text: 'Trades'), Tab(text: 'Dividends'), Tab(text: 'Gains')]) : null,
      ),
      body: PlanGate(
        required: Tier.intermediary,
        title: 'Portfolio journal',
        icon: Icons.account_balance_wallet_rounded,
        pitch: const ['Log your buys and sells and see your holdings valued at today\'s prices.', 'Unrealised and realised gains, worked out for you.', 'Record dividends and see your yield on cost.', 'Feeds your allocation and rebalancing plan.'],
        child: TabBarView(controller: _tabs, children: const [_Holdings(), _Trades(), _Dividends(), _Gains()]),
      ),
    );
  }
}

// ---- holdings

class _Holdings extends ConsumerWidget {
  const _Holdings();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<Portfolio>(
      value: ref.watch(portfolioProvider),
      onRetry: () => ref.invalidate(portfolioProvider),
      builder: (p) => RefreshIndicator(
        onRefresh: () async => refreshJournal(ref),
        child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
          if (p.isEmpty)
            EmptyState(
              icon: Icons.account_balance_wallet_outlined,
              title: 'No holdings yet',
              body: 'Add a buy trade and it shows here, valued at the latest price.',
              action: Column(mainAxisSize: MainAxisSize.min, children: [
                FilledButton.icon(onPressed: () => context.push('/tools/trade'), icon: const Icon(Icons.add_rounded), label: const Text('Add your first trade')),
                const SizedBox(height: 10),
                OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: () => importStatement(context, ref), icon: const Icon(Icons.upload_file_rounded, size: 18), label: const Text('Import a CDS statement (PDF)')),
              ]),
            )
          else ...[
            SurfaceCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('PORTFOLIO VALUE', style: AppText.caption(c.textSecondary).copyWith(letterSpacing: 0.6, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(formatKes(p.value), style: AppText.price(c.textPrimary).copyWith(fontSize: 28)),
                const SizedBox(height: 6),
                Row(children: [Text('Unrealised  ', style: AppText.caption(c.textSecondary)), Flexible(child: GainText(p.gain, pct: p.gainPct, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)))]),
                const SizedBox(height: 2),
                Text('Cost ${formatKes(p.cost)}', style: AppText.caption(c.textMuted)),
              ]),
            ),
            const SizedBox(height: 12),
            const _WatchCard(),
            const SizedBox(height: Gap.section),
            Text('Holdings', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 10),
            for (final pos in p.positions) Padding(padding: const EdgeInsets.only(bottom: 10), child: _PositionCard(pos: pos, all: p)),
            Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => importStatement(context, ref), icon: const Icon(Icons.upload_file_rounded, size: 18), label: const Text('Import a CDS statement (PDF)'))),
            Text('Prices are delayed. Cost marked "est." was estimated from the price on import day; tap a holding to enter the real one.', style: AppText.caption(c.textMuted)),
          ],
        ]),
      ),
    );
  }
}

class _PositionCard extends ConsumerWidget {
  const _PositionCard({required this.pos, required this.all});
  final Position pos;
  final Portfolio all;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Tappable(
      onTap: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => _PositionSheet(pos: pos, all: all)),
      child: SurfaceCard(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(pos.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text('${formatInt(pos.quantity)} shares', style: AppText.caption(c.textSecondary)),
              Text(pos.avgCost == null ? 'Cost unknown' : 'Avg ${formatPrice(pos.avgCost!)}${pos.costEstimated ? ' est.' : ''}', style: AppText.caption(pos.avgCost == null || pos.costEstimated ? c.warning : c.textMuted)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(pos.value == null ? 'No price' : formatKes(pos.value!), style: AppText.metric(c.textPrimary).copyWith(fontSize: 15)),
            const SizedBox(height: 2),
            if (pos.gain != null) GainText(pos.gain!, pct: pos.gainPct, bare: true, style: AppText.caption(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
          ]),
        ]),
      ),
    );
  }
}

class _PositionSheet extends ConsumerWidget {
  const _PositionSheet({required this.pos, required this.all});
  final Position pos;
  final Portfolio all;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final lots = all.byBroker.where((b) => b.ticker == pos.ticker).toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(pos.ticker, style: AppText.h2(c.textPrimary)),
          if (pos.name != null) Text(pos.name!, style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 14),
          for (final l in lots)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SurfaceCard(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.brokerName ?? 'Broker', style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w600)),
                      Text('${formatInt(l.quantity)} shares · ${l.avgCost == null ? 'cost unknown' : 'avg ${formatPrice(l.avgCost!)}${l.costEstimated ? ' (estimated)' : ''}'}', style: AppText.caption(c.textSecondary)),
                    ]),
                  ),
                  if (l.holdingId != null) TextButton(onPressed: () => _editCost(context, ref, l), child: Text(l.avgCost == null || l.costEstimated ? 'Set cost' : 'Edit cost')),
                ]),
              ),
            ),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () { Navigator.pop(context); context.push('/stock/${pos.ticker}'); }, child: const Text('View stock'))),
            const SizedBox(width: 10),
            Expanded(child: FilledButton(onPressed: () { Navigator.pop(context); context.push('/tools/trade?ticker=${pos.ticker}'); }, child: const Text('Add trade'))),
          ]),
        ]),
      ),
    );
  }

  Future<void> _editCost(BuildContext context, WidgetRef ref, Position lot) async {
    final ctrl = TextEditingController(text: lot.avgCost?.toStringAsFixed(2) ?? '');
    final v = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Cost per share, ${lot.ticker}'),
        content: TextField(controller: ctrl, autofocus: true, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'KES per share')),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, double.tryParse(ctrl.text.trim())), child: const Text('Save'))],
      ),
    );
    ctrl.dispose();
    if (v == null || v <= 0 || !context.mounted) return;
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).setHoldingCost(lot.holdingId!, v), done: 'Cost saved.');
    if (ok) {
      refreshJournal(ref);
      if (context.mounted) Navigator.pop(context);
    }
  }
}

class _WatchCard extends ConsumerWidget {
  const _WatchCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final premium = ref.watch(tierProvider).atLeast(Tier.premium);
    return SurfaceCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(Icons.visibility_rounded, color: c.primary, size: 20), const SizedBox(width: 8), Expanded(child: Text('Portfolio Watch', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16))), if (!premium) Text('Premium', style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w700))]),
        const SizedBox(height: 6),
        if (!premium)
          Text('A daily note on your own holdings: take-profit levels, drawdowns, concentration and big movers. Included in the Premium plan.', style: AppText.bodySmall(c.textSecondary))
        else
          MemberAsync<PortfolioWatch>(
            value: ref.watch(watchProvider),
            onRetry: () => ref.invalidate(watchProvider),
            loading: const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator())),
            builder: (w) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (w.dayChange != null) Row(children: [Text('Today  ', style: AppText.caption(c.textSecondary)), Flexible(child: GainText(w.dayChange!, pct: w.dayChangePct, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)))]),
              const SizedBox(height: 6),
              if (w.items.isEmpty) Text('Nothing needs your attention today.', style: AppText.bodySmall(c.textSecondary)),
              for (final i in w.items) Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.circle, size: 6, color: c.primary), const SizedBox(width: 8), Expanded(child: Text(i.text, style: AppText.bodySmall(c.textPrimary)))])),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text('Email me this every day', style: AppText.bodySmall(c.textPrimary)),
                value: w.enabled,
                onChanged: (v) async {
                  final ok = await runAction(context, () => ref.read(memberRepositoryProvider).setWatch(v), done: v ? 'Daily Portfolio Watch is on.' : 'Daily Portfolio Watch is off.');
                  if (ok) ref.invalidate(watchProvider);
                },
              ),
            ]),
          ),
      ]),
    );
  }
}

// ---- trades

class _Trades extends ConsumerWidget {
  const _Trades();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<TradePage>(
      value: ref.watch(tradesProvider),
      onRetry: () => ref.invalidate(tradesProvider),
      builder: (page) {
        if (page.trades.isEmpty) return SingleChildScrollView(child: EmptyState(icon: Icons.receipt_long_outlined, title: 'No trades yet', body: 'Record each buy and sell. Fees are worked out from your broker if you leave them blank.', action: FilledButton.icon(onPressed: () => context.push('/tools/trade'), icon: const Icon(Icons.add_rounded), label: const Text('Add a trade'))));
        return RefreshIndicator(
          onRefresh: () async => refreshJournal(ref),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
            Text('${page.total} ${page.total == 1 ? 'trade' : 'trades'}', style: AppText.caption(c.textSecondary)),
            const SizedBox(height: 8),
            for (final t in page.trades)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Tappable(
                  onTap: () => context.push('/tools/trade', extra: t),
                  onLongPress: () => _confirmDelete(context, ref, t),
                  child: SurfaceCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Container(width: 44, padding: const EdgeInsets.symmetric(vertical: 4), alignment: Alignment.center, decoration: BoxDecoration(color: (t.isBuy ? c.gain : c.loss).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text(t.isBuy ? 'BUY' : 'SELL', style: AppText.caption(t.isBuy ? c.gain : c.loss).copyWith(fontWeight: FontWeight.w800, fontSize: 11))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(t.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
                          Text('${formatInt(t.quantity)} @ ${formatPrice(t.price)}', style: AppText.caption(c.textSecondary)),
                          Text('${formatDate(t.date)}${t.brokerName.isEmpty ? '' : ' · ${t.brokerName}'}${t.imported ? ' · imported' : ''}', style: AppText.caption(c.textMuted)),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(formatKes(t.total), style: AppText.metric(c.textPrimary).copyWith(fontSize: 14)), Text('fees ${formatPrice(t.fees)}', style: AppText.caption(c.textMuted))]),
                    ]),
                  ),
                ),
              ),
            Text('Tap a trade to edit it. Press and hold to delete.', style: AppText.caption(c.textMuted)),
          ]),
        );
      },
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, Trade t) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this trade?'),
        content: Text('${t.isBuy ? 'Buy' : 'Sell'} ${t.quantity} ${t.ticker} on ${formatDate(t.date)}. Your holdings and gains are recalculated.'),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete'))],
      ),
    );
    if (yes != true || !context.mounted) return;
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).deleteTrade(t.id), done: 'Trade deleted.');
    if (ok) refreshJournal(ref);
  }
}

// ---- dividends

class _Dividends extends ConsumerWidget {
  const _Dividends();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final yoc = ref.watch(yieldOnCostProvider).value ?? const <YieldOnCost>[];
    return MemberAsync<List<Dividend>>(
      value: ref.watch(dividendsProvider),
      onRetry: () => ref.invalidate(dividendsProvider),
      builder: (divs) {
        if (divs.isEmpty) return SingleChildScrollView(child: EmptyState(icon: Icons.payments_outlined, title: 'No dividends yet', body: 'Record dividends you receive to see your income and yield on cost.', action: FilledButton.icon(onPressed: () => showDividendSheet(context, ref), icon: const Icon(Icons.add_rounded), label: const Text('Add a dividend'))));
        final total = divs.fold<double>(0, (a, d) => a + d.amount);
        return RefreshIndicator(
          onRefresh: () async => refreshJournal(ref),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
            MetricRow([MetricTile('Dividends received', formatKes(total)), MetricTile('Payments', '${divs.length}')]),
            if (yoc.isNotEmpty) ...[
              const SizedBox(height: Gap.section),
              Text('Yield on cost', style: AppText.h3(c.textPrimary)),
              const SizedBox(height: 4),
              Text('Last 12 months of dividends against what you paid.', style: AppText.caption(c.textSecondary)),
              const SizedBox(height: 10),
              SurfaceCard(padding: EdgeInsets.zero, child: Column(children: [for (var i = 0; i < yoc.length; i++) ...[if (i > 0) const Divider(height: 1), ListTile(dense: true, title: Text(yoc[i].ticker, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)), subtitle: Text('${formatKes(yoc[i].annual)} on ${formatKes(yoc[i].cost)}', style: AppText.caption(c.textSecondary)), trailing: Text('${yoc[i].pct.toStringAsFixed(2)}%', style: AppText.metric(c.primary)))]])),
            ],
            const SizedBox(height: Gap.section),
            Text('History', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 10),
            for (final d in divs)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Dismissible(
                  key: ValueKey(d.id),
                  direction: DismissDirection.endToStart,
                  background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), decoration: BoxDecoration(color: c.loss, borderRadius: BorderRadius.circular(Gap.radiusCard)), child: const Icon(Icons.delete_rounded, color: Colors.white)),
                  confirmDismiss: (_) => runAction(context, () => ref.read(memberRepositoryProvider).deleteDividend(d.id), done: 'Dividend deleted.'),
                  onDismissed: (_) => refreshJournal(ref),
                  child: SurfaceCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)), Text('${formatDate(d.date)}${d.brokerName.isEmpty ? '' : ' · ${d.brokerName}'}', style: AppText.caption(c.textSecondary))])),
                      Text(formatKes(d.amount), style: AppText.metric(c.gain).copyWith(fontSize: 15)),
                    ]),
                  ),
                ),
              ),
            Text('Swipe a dividend left to delete it.', style: AppText.caption(c.textMuted)),
          ]),
        );
      },
    );
  }
}

// ---- realised gains

class _Gains extends ConsumerWidget {
  const _Gains();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<RealizedGains>(
      value: ref.watch(realizedProvider),
      onRetry: () => ref.invalidate(realizedProvider),
      builder: (g) {
        if (g.byTicker.isEmpty) return const SingleChildScrollView(child: EmptyState(icon: Icons.trending_up_rounded, title: 'No realised gains yet', body: 'When you record a sell, the profit or loss on it is worked out here.'));
        return RefreshIndicator(
          onRefresh: () async => refreshJournal(ref),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
            SurfaceCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('REALISED GAIN', style: AppText.caption(c.textSecondary).copyWith(letterSpacing: 0.6, fontWeight: FontWeight.w700)), const SizedBox(height: 6), GainText(g.total, style: AppText.price(c.textPrimary).copyWith(fontSize: 26))])),
            const SizedBox(height: Gap.section),
            Text('By stock', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 10),
            for (final r in g.byTicker)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SurfaceCard(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(r.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)), Text('${r.trades} ${r.trades == 1 ? 'sale' : 'sales'} · proceeds ${formatKes(r.proceeds)}', style: AppText.caption(c.textSecondary))])),
                    GainText(r.gain, bare: true, style: AppText.metric(c.textPrimary).copyWith(fontSize: 15)),
                  ]),
                ),
              ),
            Text('Costs are matched to sales with the average-cost method. Check with a tax adviser for tax treatment.', style: AppText.caption(c.textMuted)),
          ]),
        );
      },
    );
  }
}
