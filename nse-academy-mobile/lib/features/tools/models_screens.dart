import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/cards.dart';
import '../../widgets/common.dart';
import '../../widgets/markdown_view.dart';
import '../../widgets/member_widgets.dart';

String _risk(String? r) => switch (r) { 'conservative' => 'Conservative', 'moderate' => 'Moderate', 'aggressive' => 'Aggressive', 'dividend' => 'Dividend-focused', 'growth' => 'Growth', _ => 'Model' };

class ModelsScreen extends ConsumerWidget {
  const ModelsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Model portfolios', style: AppText.h3(c.textPrimary))),
      body: CachedAsync<ModelList>(
        value: ref.watch(modelsProvider),
        onRetry: () => ref.invalidate(modelsProvider),
        builder: (context, list, meta) => ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
          if (meta.fromCache) CachedBanner(fetchedAt: meta.fetchedAt),
          if (list.note.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(list.note, style: AppText.caption(c.textSecondary))),
          if (list.models.isEmpty) const EmptyState(icon: Icons.layers_outlined, title: 'No models yet', body: 'Example portfolios will appear here once they are published.'),
          for (final m in list.models)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Tappable(
                onTap: () => context.push('/tools/models/${m.slug}'),
                child: SurfaceCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(Gap.radiusPill)), child: Text(_risk(m.risk), style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700))), const Spacer(), Text('${m.holdings.length} stocks', style: AppText.caption(c.textMuted))]),
                    const SizedBox(height: 8),
                    Text(m.name, style: AppText.h3(c.textPrimary).copyWith(fontSize: 17)),
                    const SizedBox(height: 4),
                    Text(m.summary, style: AppText.bodySmall(c.textSecondary), maxLines: 3, overflow: TextOverflow.ellipsis),
                    if (m.sincePct != null) ...[const SizedBox(height: 10), Row(children: [Text('Since start  ', style: AppText.caption(c.textSecondary)), ChangeText(m.sincePct!), if (m.last30Pct != null) ...[const SizedBox(width: 14), Text('30 days  ', style: AppText.caption(c.textSecondary)), ChangeText(m.last30Pct!)]])],
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class ModelDetailScreen extends ConsumerWidget {
  const ModelDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final tier = ref.watch(tierProvider);
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    return Scaffold(
      appBar: AppBar(title: Text('Model portfolio', style: AppText.h3(c.textPrimary))),
      body: CachedAsync<ModelDetail>(
        value: ref.watch(modelProvider(slug)),
        onRetry: () => ref.invalidate(modelProvider(slug)),
        builder: (context, d, meta) {
          final m = d.model;
          return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
            if (meta.fromCache) CachedBanner(fetchedAt: meta.fetchedAt),
            Text(m.name, style: AppText.h1(c.textPrimary).copyWith(fontSize: 24)),
            const SizedBox(height: 4),
            Text(_risk(m.risk), style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (m.sincePct != null) MetricRow([MetricTile('Since start', signedPct(m.sincePct!), color: m.sincePct! >= 0 ? c.gain : c.loss), if (m.last30Pct != null) MetricTile('Last 30 days', signedPct(m.last30Pct!), color: m.last30Pct! >= 0 ? c.gain : c.loss)]),
            if (m.description.isNotEmpty) ...[const SizedBox(height: 14), MarkdownView(m.description)],
            const SizedBox(height: Gap.section),
            Text('Holdings', style: AppText.h3(c.textPrimary)),
            const SizedBox(height: 10),
            for (final h in m.holdings)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Tappable(
                  onTap: () => context.push('/stock/${h.ticker}'),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Expanded(child: Text(h.ticker, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700))), Text('${h.weight.toStringAsFixed(1)}%', style: AppText.metric(c.textPrimary).copyWith(fontSize: 14))]),
                    const SizedBox(height: 4),
                    AppProgressBar((h.weight / 100).clamp(0.0, 1.0), height: 6),
                    if (h.rationale != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(h.rationale!, style: AppText.caption(c.textSecondary))),
                  ]),
                ),
              ),
            const SizedBox(height: Gap.section),
            if (!signedIn || !tier.atLeast(Tier.intermediary))
              LockedFeature(required: Tier.intermediary, signedIn: signedIn, title: 'Compare with your portfolio', icon: Icons.compare_arrows_rounded, pitch: const ['See how your holdings line up with this model, stock by stock.'])
            else
              _Compare(slug: slug, name: m.name, premium: tier.atLeast(Tier.premium)),
            const SizedBox(height: 10),
            if (d.note.isNotEmpty) Text(d.note, style: AppText.caption(c.textMuted)),
          ]);
        },
      ),
    );
  }
}

class _Compare extends ConsumerWidget {
  const _Compare({required this.slug, required this.name, required this.premium});
  final String slug;
  final String name;
  final bool premium;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('How you compare', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      MemberAsync<ModelComparison>(
        value: ref.watch(comparisonProvider(slug)),
        onRetry: () => ref.invalidate(comparisonProvider(slug)),
        builder: (cmp) {
          if (!cmp.hasHoldings) return Text('Add trades to your portfolio journal and we compare them with this model.', style: AppText.bodySmall(c.textSecondary));
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${cmp.overlap.toStringAsFixed(0)}% of your portfolio overlaps with this model.', style: AppText.bodySmall(c.textPrimary)),
            const SizedBox(height: 8),
            SurfaceCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (var i = 0; i < cmp.rows.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(dense: true, title: Text(cmp.rows[i].ticker, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)), subtitle: Text('Model ${cmp.rows[i].model.toStringAsFixed(1)}%  ·  you ${cmp.rows[i].yours.toStringAsFixed(1)}%', style: AppText.caption(c.textSecondary)), trailing: Text(signedPct(cmp.rows[i].diff), style: AppText.metric(cmp.rows[i].diff.abs() < 1 ? c.textSecondary : (cmp.rows[i].diff > 0 ? c.gain : c.warning)).copyWith(fontSize: 14))),
                ],
              ]),
            ),
            if (cmp.notInModel.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Not in this model: ${cmp.notInModel.map((t) => '${t.ticker} (${t.weightPct.toStringAsFixed(0)}%)').join(', ')}', style: AppText.caption(c.textMuted))),
          ]);
        },
      ),
      const SizedBox(height: 14),
      if (premium)
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          icon: const Icon(Icons.tune_rounded, size: 18),
          label: const Text('Use as my target weights'),
          onPressed: () async {
            final yes = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Use this model as your targets?'),
                content: Text('Your current target weights are replaced with the weights in $name. Your holdings are not changed.'),
                actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Replace targets'))],
              ),
            );
            if (yes != true || !context.mounted) return;
            final ok = await runAction(context, () => ref.read(memberRepositoryProvider).adoptModel(slug), done: 'Targets set from $name.');
            if (ok) {
              ref.invalidate(allocationProvider);
              ref.invalidate(rebalanceProvider);
            }
          },
        )
      else
        Text('Premium members can copy a model into their target weights and get a rebalancing plan.', style: AppText.caption(c.textSecondary)),
    ]);
  }
}
