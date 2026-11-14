import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../data/models/course.dart';
import '../state/providers.dart';
import 'common.dart';
import 'upgrade_card.dart';

/// Wraps a member feature. A signed-out or under-plan member sees what the feature does and what unlocks it (the same
/// wording as everywhere else in the app, with no purchase link: see AppConfig.webUpgradeLinks) instead of a blank screen.
class PlanGate extends ConsumerWidget {
  const PlanGate({super.key, required this.required, required this.title, required this.icon, required this.pitch, required this.child});
  final Tier required;
  final String title;
  final IconData icon;
  final List<String> pitch;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final tier = ref.watch(tierProvider);
    final signedIn = auth.value?.signedIn ?? false;
    if (auth.isLoading && !auth.hasValue) return const Center(child: CircularProgressIndicator());
    if (signedIn && tier.atLeast(required)) return child;
    return LockedFeature(required: required, signedIn: signedIn, title: title, icon: icon, pitch: pitch);
  }
}

class LockedFeature extends StatelessWidget {
  const LockedFeature({super.key, required this.required, required this.signedIn, required this.title, required this.icon, required this.pitch});
  final Tier required;
  final bool signedIn;
  final String title;
  final IconData icon;
  final List<String> pitch;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 12, Gap.screen, 32), children: [
      Container(
        width: 56,
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(16)),
        child: Icon(icon, color: c.primary, size: 28),
      ),
      const SizedBox(height: 14),
      Text(title, style: AppText.h2(c.textPrimary)),
      const SizedBox(height: 6),
      Text(required == Tier.free ? 'Free with your NSE Academy account' : '${required.label} plan', style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.4)),
      const SizedBox(height: 16),
      for (final p in pitch)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.check_circle_rounded, size: 18, color: c.gain),
            const SizedBox(width: 10),
            Expanded(child: Text(p, style: AppText.bodySmall(c.textPrimary))),
          ]),
        ),
      const SizedBox(height: 10),
      UpgradeCard(required: required, signedIn: signedIn, title: signedIn ? 'Included in ${required.label}' : 'Sign in to use this'),
    ]);
  }
}

/// Shows an [AsyncValue] from a member endpoint. A 403 means the plan does not include it, so it shows the lock rather
/// than an error; a 401 asks the member to sign in again.
class MemberAsync<T> extends StatelessWidget {
  const MemberAsync({super.key, required this.value, required this.builder, required this.onRetry, this.loading});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;
  final Widget? loading;

  @override
  Widget build(BuildContext context) => value.when(
        data: builder,
        loading: () => loading ?? const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator())),
        error: (e, _) {
          if (e is ApiException && (e.statusCode == 401 || e.statusCode == 403)) {
            return Padding(padding: const EdgeInsets.all(Gap.screen), child: UpgradeCard(required: e.statusCode == 403 ? Tier.premium : Tier.free, signedIn: e.statusCode == 403, title: e.statusCode == 403 ? 'Not included in your plan' : 'Please sign in again'));
          }
          return ErrorState(error: e, onRetry: onRetry);
        },
      );
}

/// A money figure that is green when up and red when down.
class GainText extends StatelessWidget {
  const GainText(this.value, {super.key, this.pct, this.style, this.bare = false});
  final double value;
  final double? pct;
  final TextStyle? style;

  /// Without the "KES" prefix, for tight rows.
  final bool bare;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = value > 0 ? c.gain : (value < 0 ? c.loss : c.textSecondary);
    final sign = value > 0 ? '+' : (value < 0 ? '-' : '');
    final money = '$sign${bare ? '' : 'KES '}${formatPrice(value.abs())}';
    return Text(pct == null ? money : '$money (${signedPct(pct!)})', maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: false, style: (style ?? AppText.metric(c.textPrimary)).copyWith(color: color));
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.body, this.action});
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 40, color: c.textMuted),
        const SizedBox(height: 12),
        Text(title, style: AppText.h3(c.textPrimary), textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(body, style: AppText.bodySmall(c.textSecondary), textAlign: TextAlign.center),
        if (action != null) ...[const SizedBox(height: 16), action!],
      ]),
    );
  }
}

void showMessage(BuildContext context, String text) {
  final m = ScaffoldMessenger.of(context);
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(content: Text(text)));
}

/// Runs a write, then reports. Returns whether it worked. Failures are said in words, never swallowed.
Future<bool> runAction(BuildContext context, Future<void> Function() action, {String? done}) async {
  try {
    await action();
    if (context.mounted && done != null) showMessage(context, done);
    return true;
  } on ApiException catch (e) {
    if (context.mounted) showMessage(context, e.message);
    return false;
  }
}

/// A small label above a block of form fields or figures.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: AppText.caption(context.c.textSecondary).copyWith(letterSpacing: 0.6, fontWeight: FontWeight.w700));
}

/// Two-up grid of metric tiles that never overflows on a narrow phone.
class MetricRow extends StatelessWidget {
  const MetricRow(this.tiles, {super.key});
  final List<Widget> tiles;
  @override
  Widget build(BuildContext context) => Row(children: [for (var i = 0; i < tiles.length; i++) ...[if (i > 0) const SizedBox(width: 10), Expanded(child: tiles[i])]]);
}
