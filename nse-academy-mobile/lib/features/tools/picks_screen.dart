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
import '../../widgets/member_widgets.dart';

/// Stocks matched to the member's investor type, with today's price beside each.
class PicksScreen extends ConsumerWidget {
  const PicksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final prices = {for (final s in ref.watch(stocksProvider).value?.value ?? const []) s.ticker: s};
    return Scaffold(
      appBar: AppBar(title: Text('Picks for you', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Stock picks for you',
        icon: Icons.auto_awesome_rounded,
        pitch: const ['NSE stocks chosen to match your investor type.', 'Dividend seekers see the highest yields; conservative investors see lower-risk names.', 'Tap any pick for its chart and how it fits you.'],
        child: MemberAsync<Recommendations>(
          value: ref.watch(recommendationsProvider),
          onRetry: () => ref.invalidate(recommendationsProvider),
          builder: (r) {
            if (r.type == null) {
              return EmptyState(icon: Icons.psychology_alt_rounded, title: 'Take the quiz first', body: r.message ?? 'Your picks depend on your investor type.', action: FilledButton(onPressed: () => context.push('/tools/profiler'), child: const Text('Take the quiz')));
            }
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(recommendationsProvider),
              child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
                Text('For a ${r.type!.label}', style: AppText.h2(c.textPrimary)),
                const SizedBox(height: 4),
                Text('${r.stocks.length} stocks that match. Educational only, not advice to buy.', style: AppText.bodySmall(c.textSecondary)),
                const SizedBox(height: 14),
                if (r.stocks.isEmpty) const EmptyState(icon: Icons.search_off_rounded, title: 'No matches yet', body: 'We could not find stocks for your type right now. Check back soon.'),
                for (final p in r.stocks)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Tappable(
                      onTap: () => context.push('/stock/${p.ticker}'),
                      child: SurfaceCard(
                        padding: const EdgeInsets.all(14),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(p.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
                              Text(p.name, style: AppText.caption(c.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                              const SizedBox(height: 6),
                              Wrap(spacing: 8, children: [
                                _Tag(p.sector.isEmpty ? 'NSE' : p.sector),
                                _Tag('${p.risk[0].toUpperCase()}${p.risk.substring(1)} risk'),
                                if (p.dividendYield != null) _Tag('${p.dividendYield!.toStringAsFixed(1)}% yield'),
                              ]),
                            ]),
                          ),
                          if (prices[p.ticker] != null)
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text(formatPrice(prices[p.ticker]!.price), style: AppText.metric(c.textPrimary)),
                              ChangeText(prices[p.ticker]!.changePct),
                            ]),
                        ]),
                      ),
                    ),
                  ),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: c.surfaceElevated, borderRadius: BorderRadius.circular(Gap.radiusPill), border: Border.all(color: c.border)), child: Text(text, style: AppText.caption(c.textSecondary)));
  }
}
