import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';
import '../push/push_controller.dart';

/// The signed-in member's own details. Free for every account. Plan and renewal date are shown for information only:
/// the app never sells or links to buying a plan (see AppConfig.webUpgradeLinks).
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('My account', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Your account',
        icon: Icons.person_rounded,
        pitch: const ['Your details, your plan and your investor profile in one place.', 'Turn the evening market digest on or off.', 'Invite friends with your referral link.'],
        child: MemberAsync<Account>(
          value: ref.watch(accountProvider),
          onRetry: () => ref.invalidate(accountProvider),
          builder: (a) => _Body(account: a),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.account});
  final Account account;
  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  late final TextEditingController _name = TextEditingController(text: widget.account.name);
  late final TextEditingController _phone = TextEditingController(text: widget.account.phone ?? '');
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return showMessage(context, 'Your name cannot be empty.');
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).updateAccount(name: _name.text.trim(), phone: _phone.text.trim()), done: 'Details saved.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) ref.invalidate(accountProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final a = widget.account;
    final tier = Tier.parse(a.tier);
    ref.listen(pushProvider.select((p) => p.message), (_, m) {
      if (m != null && m.isNotEmpty) {
        showMessage(context, m);
        ref.read(pushProvider.notifier).clearMessage();
      }
    });
    final digest = ref.watch(digestProvider);
    final refs = ref.watch(referralsProvider);
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      SurfaceCard(
        child: Row(children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.workspace_premium_rounded, color: c.primary)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${tier.label} plan', style: AppText.h3(c.textPrimary).copyWith(fontSize: 17)),
              Text(tier == Tier.free ? 'Free account' : (a.renews == null ? 'Active' : 'Paid until ${formatDate(a.renews!)}'), style: AppText.caption(c.textSecondary)),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: Gap.section),
      Text('Your details', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Name')),
      const SizedBox(height: 12),
      TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone (optional)')),
      const SizedBox(height: 12),
      InputDecorator(decoration: const InputDecoration(labelText: 'Email'), child: Text(a.email, style: AppText.body(c.textSecondary))),
      const SizedBox(height: 14),
      FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save details')),
      const SizedBox(height: Gap.section),
      Text('Investor profile', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      SurfaceCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          leading: Icon(Icons.psychology_alt_rounded, color: c.primary),
          title: Text(a.profile?.type.label ?? 'Not taken yet', style: AppText.body(c.textPrimary)),
          subtitle: Text(a.profile == null ? 'Take the 10-question quiz to find your type.' : 'Risk score ${a.profile!.riskScore}/100', style: AppText.caption(c.textSecondary)),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/tools/profiler'),
        ),
      ),
      const SizedBox(height: Gap.section),
      Text('Email', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      SurfaceCard(
        padding: EdgeInsets.zero,
        child: digest.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
          error: (e, _) => ListTile(title: Text('Could not load your email setting.', style: AppText.bodySmall(c.textSecondary)), trailing: TextButton(onPressed: () => ref.invalidate(digestProvider), child: const Text('Retry'))),
          data: (on) => SwitchListTile(
            title: Text('Evening market digest', style: AppText.body(c.textPrimary)),
            subtitle: Text('A short summary of the NSE close, by email. Off until you turn it on.', style: AppText.caption(c.textSecondary)),
            value: on,
            onChanged: (v) async {
              final ok = await runAction(context, () => ref.read(memberRepositoryProvider).setDigest(v), done: v ? 'Digest is on.' : 'Digest is off.');
              if (ok) ref.invalidate(digestProvider);
            },
          ),
        ),
      ),
      if (ref.watch(pushProvider.select((p) => p.supported))) ...[
        const SizedBox(height: Gap.section),
        Text('Notifications', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 10),
        SurfaceCard(
          padding: EdgeInsets.zero,
          child: SwitchListTile(
            title: Text('Notifications on this phone', style: AppText.body(c.textPrimary)),
            subtitle: Text('Price alerts, adviser replies and Portfolio Watch. Turn them off here at any time.', style: AppText.caption(c.textSecondary)),
            value: ref.watch(pushProvider.select((p) => p.enabled)),
            onChanged: ref.watch(pushProvider.select((p) => p.busy)) ? null : (v) => v ? ref.read(pushProvider.notifier).enable() : ref.read(pushProvider.notifier).disable(),
          ),
        ),
      ],
      const SizedBox(height: Gap.section),
      Text('Invite friends', style: AppText.h3(c.textPrimary)),
      const SizedBox(height: 10),
      refs.when(
        loading: () => const Skeleton(height: 90),
        error: (e, _) => const SizedBox.shrink(),
        data: (r) {
          if (r.code.isEmpty) return const SizedBox.shrink();
          final link = '${AppConfig.siteBase}/auth/register?ref=${r.code}';
          return SurfaceCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Your code', style: AppText.caption(c.textSecondary)),
              Text(r.code, style: AppText.price(c.primary)),
              const SizedBox(height: 10),
              MetricRow([MetricTile('Joined', '${r.total}'), MetricTile('Completed', '${r.completed}'), MetricTile('Free months', '${r.freeMonths}')]),
              const SizedBox(height: 12),
              OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => SharePlus.instance.share(ShareParams(text: 'Learn the Nairobi Securities Exchange with NSE Academy: $link')), icon: const Icon(Icons.share_rounded, size: 18), label: const Text('Share your link')),
            ]),
          );
        },
      ),
    ]);
  }
}
