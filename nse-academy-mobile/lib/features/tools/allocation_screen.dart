import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';

const _palette = [Color(0xFF059669), Color(0xFF2563EB), Color(0xFFEA580C), Color(0xFF7C3AED), Color(0xFFCA8A04), Color(0xFFDB2777), Color(0xFF0891B2), Color(0xFF65A30D)];

class AllocationScreen extends ConsumerWidget {
  const AllocationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(title: Text('Allocation', style: AppText.h3(c.textPrimary)), bottom: const TabBar(tabs: [Tab(text: 'Mix'), Tab(text: 'Targets'), Tab(text: 'Rebalance')])),
        body: PlanGate(
          required: Tier.intermediary,
          title: 'Portfolio allocation',
          icon: Icons.pie_chart_rounded,
          pitch: const ['See your portfolio by stock and by sector.', 'Premium: set target weights and get a rebalancing plan with broker fees.', 'Works from the holdings in your portfolio journal.'],
          child: const TabBarView(children: [_Mix(), _Targets(), _Rebalance()]),
        ),
      ),
    );
  }
}

class _Mix extends ConsumerWidget {
  const _Mix();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<Allocation>(
      value: ref.watch(allocationProvider),
      onRetry: () => ref.invalidate(allocationProvider),
      builder: (a) {
        if (a.rows.isEmpty) return SingleChildScrollView(child: EmptyState(icon: Icons.pie_chart_outline_rounded, title: 'Nothing to allocate yet', body: 'Add trades to your portfolio journal and your mix appears here.', action: FilledButton(onPressed: () => context.push('/tools/portfolio'), child: const Text('Open portfolio'))));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(allocationProvider),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
            Text('By sector', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 4),
            Text('${formatKes(a.value)} across ${a.rows.length} ${a.rows.length == 1 ? 'stock' : 'stocks'}', style: AppText.caption(c.textSecondary)),
            const SizedBox(height: 12),
            SizedBox(
              height: 190,
              child: PieChart(PieChartData(sectionsSpace: 2, centerSpaceRadius: 46, sections: [for (var i = 0; i < a.sectors.length; i++) PieChartSectionData(value: a.sectors[i].weight, color: _palette[i % _palette.length], radius: 34, showTitle: false)])),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < a.sectors.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: _palette[i % _palette.length], borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 10),
                  Expanded(child: Text(a.sectors[i].sector, style: AppText.bodySmall(c.textPrimary))),
                  Text('${a.sectors[i].weight.toStringAsFixed(1)}%', style: AppText.metric(c.textPrimary).copyWith(fontSize: 14)),
                ]),
              ),
            const SizedBox(height: Gap.section),
            Text('By stock', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 10),
            for (final r in a.rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [Expanded(child: Text(r.ticker, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700))), Text('${formatKes(r.value)}  ·  ${r.weight.toStringAsFixed(1)}%', style: AppText.caption(c.textSecondary))]),
                  const SizedBox(height: 5),
                  AppProgressBar((r.weight / 100).clamp(0.0, 1.0), height: 6),
                ]),
              ),
            for (final n in a.notes) Padding(padding: const EdgeInsets.only(top: 4), child: Text(n, style: AppText.caption(c.warning))),
            if (a.unpriced.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('No recent price for ${a.unpriced.join(', ')}, so ${a.unpriced.length == 1 ? 'it is' : 'they are'} left out.', style: AppText.caption(c.textMuted))),
          ]),
        );
      },
    );
  }
}

class _Targets extends ConsumerStatefulWidget {
  const _Targets();
  @override
  ConsumerState<_Targets> createState() => _TargetsState();
}

class _TargetsState extends ConsumerState<_Targets> {
  List<({TextEditingController ticker, TextEditingController weight})>? _rows;
  bool _busy = false;

  void _load(List<TargetWeight> t) {
    _rows = [for (final x in t) (ticker: TextEditingController(text: x.ticker), weight: TextEditingController(text: _fmt(x.weightPct)))];
  }

  String _fmt(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);

  @override
  void dispose() {
    for (final r in _rows ?? const []) {
      r.ticker.dispose();
      r.weight.dispose();
    }
    super.dispose();
  }

  double get _sum => (_rows ?? const []).fold(0.0, (a, r) => a + (double.tryParse(r.weight.text.trim()) ?? 0));

  Future<void> _save() async {
    final targets = <TargetWeight>[];
    for (final r in _rows!) {
      final t = r.ticker.text.trim().toUpperCase();
      final w = double.tryParse(r.weight.text.trim());
      if (t.isEmpty && r.weight.text.trim().isEmpty) continue;
      if (t.isEmpty || w == null || w <= 0) return showMessage(context, 'Each row needs a ticker and a weight above zero.');
      targets.add(TargetWeight(t, w));
    }
    if (targets.isEmpty) return showMessage(context, 'Add at least one target.');
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).saveTargets(targets), done: 'Targets saved.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      ref.invalidate(allocationProvider);
      ref.invalidate(rebalanceProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (!ref.watch(tierProvider).atLeast(Tier.premium)) {
      return const LockedFeature(required: Tier.premium, signedIn: true, title: 'Target weights', icon: Icons.tune_rounded, pitch: ['Decide how much of your portfolio each stock should be.', 'See how far you have drifted, then get a rebalancing plan with broker fees.', 'Start from one of our model portfolios.']);
    }
    return MemberAsync<Allocation>(
      value: ref.watch(allocationProvider),
      onRetry: () => ref.invalidate(allocationProvider),
      builder: (a) {
        if (_rows == null) _load(a.targets);
        final sum = _sum;
        final ok = (sum - 100).abs() < 0.5;
        return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
          Text('Target weights', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 4),
          Text('Say how much of your portfolio each stock should be. They should add up to 100%.', style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 12),
          for (var i = 0; i < _rows!.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Expanded(flex: 3, child: TextField(controller: _rows![i].ticker, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Ticker'))),
                const SizedBox(width: 10),
                Expanded(flex: 2, child: TextField(controller: _rows![i].weight, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: '%'))),
                IconButton(tooltip: 'Remove', onPressed: () => setState(() {
                  _rows![i].ticker.dispose();
                  _rows![i].weight.dispose();
                  _rows!.removeAt(i);
                }), icon: Icon(Icons.close_rounded, color: c.textMuted)),
              ]),
            ),
          Wrap(spacing: 8, children: [
            OutlinedButton.icon(onPressed: () => setState(() => _rows!.add((ticker: TextEditingController(), weight: TextEditingController()))), icon: const Icon(Icons.add_rounded, size: 18), label: const Text('Add stock')),
            if (a.rows.isNotEmpty)
              OutlinedButton(
                onPressed: () => setState(() {
                  for (final r in _rows!) {
                    r.ticker.dispose();
                    r.weight.dispose();
                  }
                  _rows = [for (final r in a.rows) (ticker: TextEditingController(text: r.ticker), weight: TextEditingController(text: r.weight.toStringAsFixed(1)))];
                }),
                child: const Text('Use my current weights'),
              ),
            OutlinedButton(onPressed: () => context.push('/tools/models'), child: const Text('Start from a model')),
          ]),
          const SizedBox(height: 14),
          Row(children: [Text('Total ', style: AppText.bodySmall(c.textSecondary)), Text('${sum.toStringAsFixed(1)}%', style: AppText.metric(ok ? c.gain : c.warning)), if (!ok) Text('   should be 100%', style: AppText.caption(c.warning))]),
          const SizedBox(height: 14),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save targets')),
        ]);
      },
    );
  }
}

class _Rebalance extends ConsumerStatefulWidget {
  const _Rebalance();
  @override
  ConsumerState<_Rebalance> createState() => _RebalanceState();
}

class _RebalanceState extends ConsumerState<_Rebalance> {
  final _cash = TextEditingController();
  double? _asked;

  @override
  void dispose() {
    _cash.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (!ref.watch(tierProvider).atLeast(Tier.premium)) {
      return const LockedFeature(required: Tier.premium, signedIn: true, title: 'Rebalancing plan', icon: Icons.balance_rounded, pitch: ['The exact buys and sells that bring you back to your targets.', 'Includes each broker\'s fees, so you see the real cost.', 'Add new cash and it tells you where to put it.']);
    }
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      Text('Rebalancing plan', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 4),
      Text('Bring your portfolio back to your target weights. Add cash if you are investing more.', style: AppText.bodySmall(c.textSecondary)),
      const SizedBox(height: 12),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: TextField(controller: _cash, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'New cash to invest (KES)', hintText: '0'))),
        const SizedBox(width: 10),
        Padding(padding: const EdgeInsets.only(top: 4), child: FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(0, 52)), onPressed: () => setState(() => _asked = double.tryParse(_cash.text.trim()) ?? 0), child: const Text('Plan'))),
      ]),
      const SizedBox(height: 16),
      if (_asked != null)
        MemberAsync<RebalancePlan>(
          value: ref.watch(rebalanceProvider(_asked!)),
          onRetry: () => ref.invalidate(rebalanceProvider(_asked!)),
          builder: (p) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final w in p.warnings) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(w, style: AppText.caption(c.warning))),
            if (p.drift.isNotEmpty) ...[
              Text('Drift from target', style: AppText.h3(c.textPrimary)),
              const SizedBox(height: 8),
              SurfaceCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (var i = 0; i < p.drift.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      dense: true,
                      title: Text(p.drift[i].ticker, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
                      subtitle: Text('Now ${p.drift[i].current.toStringAsFixed(1)}%  ·  target ${p.drift[i].target.toStringAsFixed(1)}%', style: AppText.caption(c.textSecondary)),
                      trailing: Text(signedPct(p.drift[i].drift), style: AppText.metric(p.drift[i].drift.abs() < 1 ? c.textSecondary : (p.drift[i].drift > 0 ? c.warning : c.primary)).copyWith(fontSize: 14)),
                    ),
                  ],
                ]),
              ),
              const SizedBox(height: Gap.section),
            ],
            Text('Trades to make', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 8),
            if (p.trades.isEmpty) Text('You are already on target. No trades needed.', style: AppText.bodySmall(c.textSecondary)),
            for (final t in p.trades)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SurfaceCard(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Container(width: 44, padding: const EdgeInsets.symmetric(vertical: 4), alignment: Alignment.center, decoration: BoxDecoration(color: (t.isBuy ? c.gain : c.loss).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text(t.isBuy ? 'BUY' : 'SELL', style: AppText.caption(t.isBuy ? c.gain : c.loss).copyWith(fontWeight: FontWeight.w800, fontSize: 11))),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${formatInt(t.shares)} ${t.ticker}', style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)), Text('at about ${formatPrice(t.price)}${t.broker == null ? '' : ' · ${t.broker}'}', style: AppText.caption(c.textSecondary))])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(formatKes(t.value), style: AppText.metric(c.textPrimary).copyWith(fontSize: 14)), if (t.fee != null) Text('fee ${formatPrice(t.fee!)}', style: AppText.caption(c.textMuted))]),
                  ]),
                ),
              ),
            if (p.trades.isNotEmpty) ...[
              const SizedBox(height: 4),
              MetricRow([MetricTile('Net cash', formatKes(p.netCash)), MetricTile('Broker fees', formatKes(p.totalFees))]),
            ],
            const SizedBox(height: 10),
            Text('A plan to consider, not advice. Prices move before you trade.', style: AppText.caption(c.textMuted)),
          ]),
        ),
    ]);
  }
}
