import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// NSE-licensed stockbrokers and what they charge, so a member can compare before opening an account.
class BrokersScreen extends ConsumerWidget {
  const BrokersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Stockbrokers', style: AppText.h3(c.textPrimary))),
      body: CachedAsync<List<Broker>>(
        value: ref.watch(brokersProvider),
        onRetry: () => ref.invalidate(brokersProvider),
        builder: (context, brokers, meta) {
          final sorted = [...brokers]..sort((a, b) => a.feePercent.compareTo(b.feePercent));
          return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
            if (meta.fromCache) CachedBanner(fetchedAt: meta.fetchedAt),
            Text('Cheapest first. Brokerage is charged on the value of each trade, on top of the NSE, CMA and CDS levies.', style: AppText.bodySmall(c.textSecondary)),
            const SizedBox(height: 12),
            if (sorted.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No brokers to show right now.'))),
            for (final b in sorted)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SurfaceCard(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(b.name, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(b.cdsRequired ? 'Needs a CDS account' : 'CDS account not required', style: AppText.caption(c.textSecondary)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('${b.feePercent.toStringAsFixed(2)}%', style: AppText.metric(c.primary)), Text('brokerage', style: AppText.caption(c.textMuted))]),
                  ]),
                ),
              ),
            Text('Check the current rate with the broker before you open an account.', style: AppText.caption(c.textMuted)),
          ]);
        },
      ),
    );
  }
}
