import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';
import 'billing_controller.dart';
import 'billing_gateway.dart';

const _features = {
  Tier.intermediary: [
    'Intermediary courses and lessons',
    'Portfolio journal: trades, dividends, realised gains',
    'Import your CDS statement',
    'Allocation by stock and sector',
    'Price alerts and notification inbox',
    'Compare model portfolios with your holdings',
  ],
  Tier.premium: [
    'Everything in Intermediary',
    'Premium courses and lessons',
    'Target weights and a rebalancing plan',
    'Use a model portfolio as your targets',
    'Daily Portfolio Watch on your holdings',
    'AI analysis on every stock page',
  ],
};

/// Subscriptions bought through Google Play Billing. Google owns the payment, the renewal and the cancellation; our
/// server checks each purchase with Google before it grants anything (see store/BILLING.md).
class PlansScreen extends ConsumerWidget {
  const PlansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    ref.listen(billingProvider.select((b) => b.message), (_, m) {
      if (m != null && m.isNotEmpty) {
        showMessage(context, m);
        ref.read(billingProvider.notifier).clearMessage();
      }
    });
    return Scaffold(
      appBar: AppBar(title: Text('Plans', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Plans',
        icon: Icons.workspace_premium_rounded,
        pitch: const ['Sign in with your free NSE Academy account to choose a plan.', 'Your plan works on the website too.'],
        child: MemberAsync<PlanStatus>(
          value: ref.watch(planStatusProvider),
          onRetry: () => ref.invalidate(planStatusProvider),
          builder: (s) => _Body(status: s),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.status});
  final PlanStatus status;
  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  final _months = <Tier, int>{};

  PlanOffer? _chosen(List<PlanOffer> offers, Tier t) {
    final mine = offers.where((o) => o.tier == t).toList();
    if (mine.isEmpty) return null;
    final want = _months[t];
    return mine.firstWhere((o) => o.months == want, orElse: () => mine.first);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = widget.status;
    final b = ref.watch(billingProvider);
    final canBuy = !s.viaWeb && !s.viaOrganisation && b.available;
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      _Current(status: s),
      const SizedBox(height: Gap.section),
      if (s.viaWeb)
        _Note(icon: Icons.info_outline_rounded, text: 'Your ${s.paidTier.label} plan was bought outside the app and is active until ${formatDate(s.periodEnd!)}. To avoid paying twice, plans can be bought here once it ends.')
      else if (s.viaOrganisation)
        const _Note(icon: Icons.apartment_rounded, text: 'Your plan comes with your organisation, so there is nothing to buy.')
      else if (!b.loaded)
        const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
      else if (!b.available)
        const _Note(icon: Icons.storefront_rounded, text: 'Plans are bought through Google Play, which is not available on this device.')
      else if (b.offers.isEmpty)
        _Note(icon: Icons.cloud_off_rounded, text: 'Google Play did not return any plans. Check your connection and try again.', action: TextButton(onPressed: () => ref.read(billingProvider.notifier).load(), child: const Text('Try again')))
      else
        for (final t in const [Tier.intermediary, Tier.premium]) ...[
          _PlanCard(
            tier: t,
            offers: b.offers.where((o) => o.tier == t).toList(),
            chosen: _chosen(b.offers, t),
            status: s,
            busy: b.busy,
            canBuy: canBuy,
            onMonths: (m) => setState(() => _months[t] = m),
            onBuy: (o) => ref.read(billingProvider.notifier).buy(o),
          ),
          const SizedBox(height: Gap.section),
        ],
      if (canBuy && b.offers.isNotEmpty) ...[
        Text(
          'Subscriptions renew automatically at the price shown, for the same length, until you cancel. Payment is charged to your Google Play account. '
          'You can cancel at any time in Google Play (Payments & subscriptions, then Subscriptions) and keep your plan until the end of the period you paid for.',
          style: AppText.caption(c.textSecondary),
        ),
        const SizedBox(height: 12),
        Wrap(spacing: 4, children: [
          if (s.viaPlay) TextButton.icon(onPressed: () => launchUrl(Uri.parse('https://play.google.com/store/account/subscriptions?package=net.vitaldigitalmedia.nse_academy'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.open_in_new_rounded, size: 16), label: const Text('Manage in Google Play')),
          TextButton.icon(onPressed: b.busy ? null : () => ref.read(billingProvider.notifier).restore(), icon: const Icon(Icons.restore_rounded, size: 16), label: const Text('Restore purchases')),
        ]),
      ],
      Wrap(spacing: 4, children: [
        TextButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/terms'), mode: LaunchMode.externalApplication), child: const Text('Terms')),
        TextButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/privacy'), mode: LaunchMode.externalApplication), child: const Text('Privacy')),
      ]),
    ]);
  }
}

class _Current extends StatelessWidget {
  const _Current({required this.status});
  final PlanStatus status;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final t = status.effective;
    final sub = t == Tier.free
        ? 'Free account'
        : status.live
            ? (status.viaPlay ? 'Renews through Google Play · paid until ${formatDate(status.periodEnd!)}' : 'Paid until ${formatDate(status.periodEnd!)}')
            : 'Included with your organisation';
    return SurfaceCard(
      child: Row(children: [
        Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.workspace_premium_rounded, color: c.primary)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${t.label} plan', style: AppText.h3(c.textPrimary).copyWith(fontSize: 17)),
            Text(sub, style: AppText.caption(c.textSecondary)),
          ]),
        ),
      ]),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text, this.action});
  final IconData icon;
  final String text;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, size: 20, color: c.textSecondary), const SizedBox(width: 10), Expanded(child: Text(text, style: AppText.bodySmall(c.textSecondary)))]),
        ?action,
      ]),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.tier, required this.offers, required this.chosen, required this.status, required this.busy, required this.canBuy, required this.onMonths, required this.onBuy});
  final Tier tier;
  final List<PlanOffer> offers;
  final PlanOffer? chosen;
  final PlanStatus status;
  final bool busy;
  final bool canBuy;
  final ValueChanged<int> onMonths;
  final ValueChanged<PlanOffer> onBuy;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final o = chosen;
    final owned = status.viaPlay && status.paidTier == tier;
    final lower = status.viaPlay && status.paidTier.index > tier.index;
    final upgrade = status.viaPlay && status.paidTier.index < tier.index;
    return SurfaceCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(tier.label, style: AppText.h3(c.textPrimary))),
          if (owned) Chip(label: const Text('Your plan'), visualDensity: VisualDensity.compact, backgroundColor: c.primarySurface, side: BorderSide.none),
        ]),
        if (o != null) ...[
          const SizedBox(height: 4),
          Text.rich(TextSpan(children: [TextSpan(text: o.price, style: AppText.price(c.primary)), TextSpan(text: ' / ${o.period}', style: AppText.bodySmall(c.textSecondary))])),
        ],
        const SizedBox(height: 12),
        for (final f in _features[tier] ?? const <String>[])
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.check_circle_rounded, size: 18, color: c.gain), const SizedBox(width: 10), Expanded(child: Text(f, style: AppText.bodySmall(c.textPrimary)))]),
          ),
        if (offers.length > 1) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            for (final x in offers)
              ChoiceChip(label: Text(x.months == 12 ? '1 year' : (x.months == 1 ? '1 month' : '${x.months} months')), selected: o?.months == x.months, onSelected: busy ? null : (_) => onMonths(x.months)),
          ]),
        ],
        const SizedBox(height: 14),
        if (o != null && canBuy && !owned && !lower)
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: busy ? null : () => onBuy(o),
            child: Text(busy ? 'Working…' : (upgrade ? 'Upgrade to ${tier.label}' : 'Subscribe to ${tier.label}')),
          )
        else if (owned)
          Text('You are on this plan. To change the length or stop renewing, use Manage in Google Play below.', style: AppText.caption(c.textSecondary))
        else if (lower)
          Text('You are on a higher plan. To move down, change it in Google Play after this period.', style: AppText.caption(c.textSecondary)),
      ]),
    );
  }
}
