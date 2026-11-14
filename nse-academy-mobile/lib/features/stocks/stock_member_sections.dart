import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../tools/alerts_screen.dart';

/// What a signed-in member gets on a company page: how it fits their investor type, quick actions, and (Premium) an
/// AI read of the stock. Signed out, it explains what signing in adds.
class MemberStockSections extends ConsumerWidget {
  const MemberStockSections({super.key, required this.ticker, required this.price});
  final String ticker;
  final double price;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    final tier = ref.watch(tierProvider);
    if (!signedIn) {
      return SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(Icons.person_pin_rounded, color: c.primary, size: 20), const SizedBox(width: 8), Text('Make it personal', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16))]),
          const SizedBox(height: 6),
          Text('Sign in to see how $ticker fits your investor type, set a price alert and track it in your portfolio.', style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 12),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => context.push('/signin'), child: const Text('Sign in')),
        ]),
      );
    }
    final canAlert = tier.atLeast(Tier.intermediary);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FitCard(ticker: ticker),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: canAlert ? () => showAlertSheet(context, ref, ticker: ticker, price: price) : () => context.push('/tools/alerts'),
            icon: Icon(canAlert ? Icons.notifications_active_outlined : Icons.lock_outline_rounded, size: 18),
            label: const Text('Price alert'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: canAlert ? () => context.push('/tools/trade?ticker=$ticker&price=$price') : () => context.push('/tools/portfolio'),
            icon: Icon(canAlert ? Icons.add_chart_rounded : Icons.lock_outline_rounded, size: 18),
            label: const Text('Add trade'),
          ),
        ),
      ]),
      const SizedBox(height: 12),
      _AiCard(ticker: ticker, premium: tier.atLeast(Tier.premium)),
    ]);
  }
}

class _FitCard extends ConsumerWidget {
  const _FitCard({required this.ticker});
  final String ticker;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final fit = ref.watch(companyFitProvider(ticker));
    return fit.when(
      loading: () => const Skeleton(height: 90),
      // The company may not have a profile in the CMS yet. Nothing to say, so say nothing.
      error: (e, _) => e is ApiException && e.statusCode == 404 ? const SizedBox.shrink() : const SizedBox.shrink(),
      data: (f) {
        if (f.fits.isEmpty) return const SizedBox.shrink();
        Color tone(String r) => switch (r) { 'excellent' => c.gain, 'good' => c.primary, 'caution' => c.loss, _ => c.textMuted };
        String word(String r) => switch (r) { 'excellent' => 'Strong fit', 'good' => 'Good fit', 'caution' => 'Poor fit', _ => 'Neutral' };
        return SurfaceCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Icon(Icons.psychology_alt_rounded, color: c.primary, size: 20), const SizedBox(width: 8), Expanded(child: Text(f.verdict != null ? 'For you: ${f.verdict}' : 'Fit by investor type', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)))]),
            if (f.reason != null) ...[const SizedBox(height: 6), Text(f.reason!, style: AppText.bodySmall(c.textSecondary))],
            const SizedBox(height: 10),
            for (final t in f.fits)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(children: [
                  Expanded(child: Text(t.kind.label, style: AppText.bodySmall(c.textPrimary))),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: tone(t.rating).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(Gap.radiusPill)), child: Text(word(t.rating), style: AppText.caption(tone(t.rating)).copyWith(fontWeight: FontWeight.w700))),
                ]),
              ),
          ]),
        );
      },
    );
  }
}

class _AiCard extends ConsumerStatefulWidget {
  const _AiCard({required this.ticker, required this.premium});
  final String ticker;
  final bool premium;
  @override
  ConsumerState<_AiCard> createState() => _AiCardState();
}

class _AiCardState extends ConsumerState<_AiCard> {
  Future<Advice>? _advice;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.auto_awesome_rounded, color: c.primary, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text('AI analysis', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16))),
          if (!widget.premium) Text('Premium', style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        if (!widget.premium)
          Text('A plain-English read of ${widget.ticker} built from our recorded prices, your holding and recent news, with the risks spelled out. Included in the Premium plan.', style: AppText.bodySmall(c.textSecondary))
        else if (_advice == null) ...[
          Text('Built from our recorded prices, your holding and recent news. It can take up to half a minute.', style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 12),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => setState(() => _advice = ref.read(memberRepositoryProvider).aiAdvice(widget.ticker)), child: Text('Analyse ${widget.ticker}')),
        ] else
          FutureBuilder<Advice>(
            future: _advice,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: CircularProgressIndicator()));
              if (snap.hasError) {
                final e = snap.error;
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e is ApiException ? e.message : 'The analysis could not be made right now.', style: AppText.bodySmall(c.loss)),
                  TextButton(onPressed: () => setState(() => _advice = null), child: const Text('Try again')),
                ]);
              }
              return _AdviceView(snap.data!);
            },
          ),
      ]),
    );
  }
}

class _AdviceView extends StatelessWidget {
  const _AdviceView(this.a);
  final Advice a;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final rec = a.recommendation.toUpperCase();
    final tone = switch (rec) { 'BUY' || 'ACCUMULATE' => c.gain, 'SELL' || 'AVOID' || 'REDUCE' => c.loss, _ => c.warning };
    Widget bullets(String title, List<String> items) => items.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              for (final i in items) Padding(padding: const EdgeInsets.only(bottom: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('•  ', style: AppText.bodySmall(c.textSecondary)), Expanded(child: Text(i, style: AppText.bodySmall(c.textSecondary)))])),
            ]),
          );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5), decoration: BoxDecoration(color: tone.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(Gap.radiusPill)), child: Text(rec, style: AppText.caption(tone).copyWith(fontWeight: FontWeight.w800, fontSize: 13))),
        const SizedBox(width: 10),
        if (!a.aiGenerated) Expanded(child: Text('Plain read, not AI-written', style: AppText.caption(c.textMuted))),
      ]),
      if (a.note != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(a.note!, style: AppText.caption(c.warning))),
      if (a.situation.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(a.situation, style: AppText.bodySmall(c.textPrimary))),
      if (a.rationale.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(a.rationale, style: AppText.bodySmall(c.textSecondary))),
      bullets('Key numbers', a.keyMetrics),
      bullets('Why', a.reasons),
      bullets('Risks', a.risks),
      if (a.outlook.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(a.outlook, style: AppText.bodySmall(c.textSecondary))),
      const SizedBox(height: 12),
      Text(a.disclaimer, style: AppText.caption(c.textMuted)),
    ]);
  }
}
