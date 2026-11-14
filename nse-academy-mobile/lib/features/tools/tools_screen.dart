import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

class _Tool {
  const _Tool(this.title, this.blurb, this.icon, this.route, this.tier);
  final String title;
  final String blurb;
  final IconData icon;
  final String route;
  final Tier tier;
}

const _myMoney = [
  _Tool('Investor profile', 'A 10-question quiz that finds your investor type.', Icons.psychology_alt_rounded, '/tools/profiler', Tier.free),
  _Tool('Picks for you', 'NSE stocks that fit your investor type.', Icons.auto_awesome_rounded, '/tools/picks', Tier.free),
  _Tool('Portfolio journal', 'Holdings, trades, dividends and realised gains.', Icons.account_balance_wallet_rounded, '/tools/portfolio', Tier.intermediary),
  _Tool('Allocation', 'See your mix by stock and sector, set targets, plan a rebalance.', Icons.pie_chart_rounded, '/tools/allocation', Tier.intermediary),
  _Tool('Price alerts', 'Get a note in your inbox when a stock crosses your price.', Icons.notifications_active_rounded, '/tools/alerts', Tier.intermediary),
];

const _research = [
  _Tool('Glossary', 'Plain-English definitions of market terms.', Icons.menu_book_rounded, '/glossary', Tier.free),
  _Tool('Research', 'Focus lists and company briefs from the NSE Academy desk.', Icons.science_rounded, '/tools/research', Tier.free),
  _Tool('Model portfolios', 'Example portfolios, how they have done, and how yours compares.', Icons.layers_rounded, '/tools/models', Tier.free),
  _Tool('Stockbrokers', 'Compare brokerage fees and CDS requirements.', Icons.account_balance_rounded, '/tools/brokers', Tier.free),
  _Tool('Calculators', 'Fees, dividend yield, compound growth, DCA and income goals.', Icons.calculate_rounded, '/tools/calculators', Tier.free),
];

/// Everything beyond reading and prices: the member tools. A tool the member's plan does not include stays visible with
/// its plan, and opening it explains what it does and what unlocks it.
class ToolsScreen extends ConsumerWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final tier = ref.watch(tierProvider);
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    final unread = ref.watch(unreadProvider).value ?? 0;
    return Scaffold(
      appBar: AppBar(title: Text('Tools', style: AppText.h2(c.textPrimary))),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
        if (!signedIn)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: SurfaceCard(
              color: c.primarySurface,
              borderColor: c.primary.withValues(alpha: 0.3),
              child: Row(children: [
                Icon(Icons.lock_open_rounded, color: c.primary),
                const SizedBox(width: 12),
                Expanded(child: Text('Sign in with your NSE Academy account to use your profile, portfolio and alerts.', style: AppText.bodySmall(c.textPrimary))),
                const SizedBox(width: 8),
                FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(0, 40)), onPressed: () => context.push('/signin'), child: const Text('Sign in')),
              ]),
            ),
          ),
        Text('My money', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 10),
        for (final t in _myMoney) _ToolTile(t, tier: tier, signedIn: signedIn, badge: t.route == '/tools/alerts' ? unread : 0),
        const SizedBox(height: Gap.section),
        Text('Research and learning', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 10),
        for (final t in _research) _ToolTile(t, tier: tier, signedIn: signedIn),
        const SizedBox(height: 8),
        Text('Educational content only, not investment advice.', style: AppText.caption(c.textMuted)),
      ]),
    );
  }
}

class _ToolTile extends StatelessWidget {
  const _ToolTile(this.tool, {required this.tier, required this.signedIn, this.badge = 0});
  final _Tool tool;
  final Tier tier;
  final bool signedIn;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Free tools still need an account when they save something about the member.
    final needsAccount = tool.route == '/tools/profiler' || tool.route == '/tools/picks';
    final locked = !tier.atLeast(tool.tier) || (needsAccount && !signedIn);
    final tag = tool.tier == Tier.free ? (needsAccount ? (signedIn ? 'Free' : 'Sign in') : null) : tool.tier.label;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Tappable(
        onTap: () => context.push(tool.route),
        child: SurfaceCard(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: locked ? c.surfaceElevated : c.primarySurface, borderRadius: BorderRadius.circular(12), border: locked ? Border.all(color: c.border) : null),
              child: Icon(tool.icon, color: locked ? c.textMuted : c.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(tool.title, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (tag != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: locked ? c.surfaceElevated : c.primarySurface, borderRadius: BorderRadius.circular(Gap.radiusPill), border: Border.all(color: locked ? c.border : c.primary.withValues(alpha: 0.3))),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [if (locked) ...[Icon(Icons.lock_rounded, size: 10, color: c.textMuted), const SizedBox(width: 3)], Text(tag, style: AppText.caption(locked ? c.textSecondary : c.primary).copyWith(fontSize: 10, fontWeight: FontWeight.w700))]),
                    ),
                  ],
                ]),
                const SizedBox(height: 2),
                Text(tool.blurb, style: AppText.caption(c.textSecondary).copyWith(height: 1.3)),
              ]),
            ),
            if (badge > 0) ...[
              const SizedBox(width: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: c.loss, borderRadius: BorderRadius.circular(10)), child: Text('$badge', style: AppText.caption(Colors.white).copyWith(fontWeight: FontWeight.w700))),
            ],
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: c.textMuted),
          ]),
        ),
      ),
    );
  }
}
