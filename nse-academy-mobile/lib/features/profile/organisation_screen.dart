import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';

/// A member's organisation: a SACCO or company that pays for seats. Members see where their plan comes from and can
/// accept an invitation; an organisation's admin also sees seats and people, and can invite or remove them. Setting an
/// organisation up and paying for its licence happen with NSE Academy directly, not in the app.
class OrganisationScreen extends ConsumerWidget {
  const OrganisationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('My organisation', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Your organisation',
        icon: Icons.apartment_rounded,
        pitch: const ['If a SACCO or company gave you a seat, your plan comes through it.', 'Accept an invitation and see your seat here.'],
        child: MemberAsync<OrgMembership?>(
          value: ref.watch(organisationProvider),
          onRetry: () => ref.invalidate(organisationProvider),
          builder: (m) {
            if (m == null) return const EmptyState(icon: Icons.apartment_outlined, title: 'No organisation', body: 'You are not part of an organisation. If your SACCO or employer set up NSE Academy seats, ask them to invite the email on this account.');
            if (m.invited) return _Invite(m: m);
            return m.isAdmin ? _Admin(m: m) : _Seat(m: m);
          },
        ),
      ),
    );
  }
}

void _refreshAll(WidgetRef ref) {
  ref
    ..invalidate(organisationProvider)
    ..invalidate(organisationDashboardProvider)
    ..invalidate(planStatusProvider)
    ..invalidate(accountProvider);
  ref.read(authProvider.notifier).refreshPlan().catchError((_) {});
}

class _Invite extends ConsumerWidget {
  const _Invite({required this.m});
  final OrgMembership m;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      SurfaceCard(
        color: c.primarySurface,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${m.orgName} invited you', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 6),
          Text('Accept to take a seat. Your plan then comes with ${m.orgName}.', style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 14),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: () async {
              final ok = await runAction(context, () => ref.read(memberRepositoryProvider).acceptInvite(m.inviteToken!), done: 'You have joined ${m.orgName}.');
              if (ok) _refreshAll(ref);
            },
            child: const Text('Accept invitation'),
          ),
        ]),
      ),
    ]);
  }
}

class _Seat extends StatelessWidget {
  const _Seat({required this.m});
  final OrgMembership m;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final l = m.license;
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      SurfaceCard(
        child: Row(children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.apartment_rounded, color: c.primary)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m.orgName, style: AppText.h3(c.textPrimary).copyWith(fontSize: 17)),
              Text(l == null ? 'No licence yet' : (l.active ? '${l.tier.label} plan through your organisation until ${formatDate(l.periodEnd!)}' : 'Your organisation\'s licence is not active'), style: AppText.caption(c.textSecondary)),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Text('You hold a seat. If you leave the organisation your plan goes back to whatever you have yourself.', style: AppText.caption(c.textSecondary)),
    ]);
  }
}

class _Admin extends ConsumerStatefulWidget {
  const _Admin({required this.m});
  final OrgMembership m;
  @override
  ConsumerState<_Admin> createState() => _AdminState();
}

class _AdminState extends ConsumerState<_Admin> {
  final _email = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _invite() async {
    final e = _email.text.trim().toLowerCase();
    if (!e.contains('@')) return showMessage(context, 'Enter the email address of their NSE Academy account.');
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).inviteToOrganisation(e), done: 'Invitation sent to $e.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _email.clear();
      ref.invalidate(organisationDashboardProvider);
    }
  }

  Future<void> _remove(OrgPerson p) async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove ${p.name}?'),
        content: const Text('They lose the plan that comes with the organisation. You can invite them again later.'),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove'))],
      ),
    );
    if (sure != true || !mounted) return;
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).removeOrgMember(p.id), done: '${p.name} was removed.');
    if (ok) ref.invalidate(organisationDashboardProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return MemberAsync<OrgDashboard>(
      value: ref.watch(organisationDashboardProvider),
      onRetry: () => ref.invalidate(organisationDashboardProvider),
      builder: (d) {
        final l = d.license;
        final canInvite = l != null && l.active && l.seatsFree > 0;
        return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
          SurfaceCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.name, style: AppText.h3(c.textPrimary)),
              const SizedBox(height: 10),
              if (l == null)
                Text('No licence yet. Licences are arranged with NSE Academy directly.', style: AppText.bodySmall(c.textSecondary))
              else
                MetricRow([MetricTile('Plan', l.tier.label), MetricTile('Seats used', '${l.seatsUsed} of ${l.seats}'), MetricTile(l.active ? 'Paid until' : 'Ended', l.periodEnd == null ? '-' : formatDate(l.periodEnd!))]),
            ]),
          ),
          const SizedBox(height: Gap.section),
          Text('Invite someone', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 4),
          Text('They need an NSE Academy account first. Use the email address it was created with.', style: AppText.caption(c.textSecondary)),
          const SizedBox(height: 10),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: 10),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy || !canInvite ? null : _invite, child: Text(_busy ? 'Sending…' : (canInvite ? 'Send invitation' : 'No free seats'))),
          const SizedBox(height: Gap.section),
          Text('People (${d.people.length})', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 10),
          for (final p in d.people)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SurfaceCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  title: Text(p.name, style: AppText.body(c.textPrimary)),
                  subtitle: Text('${p.email}\n${p.admin ? 'Admin' : (p.accepted ? 'Member' : 'Invitation pending')}', style: AppText.caption(c.textSecondary)),
                  isThreeLine: true,
                  trailing: p.admin
                      ? null
                      : PopupMenuButton<String>(
                          onSelected: (v) async {
                            if (v == 'resend') {
                              await runAction(context, () => ref.read(memberRepositoryProvider).resendOrgInvite(p.id), done: 'Invitation sent again.');
                            } else {
                              await _remove(p);
                            }
                          },
                          itemBuilder: (_) => [if (!p.accepted) const PopupMenuItem(value: 'resend', child: Text('Resend invitation')), const PopupMenuItem(value: 'remove', child: Text('Remove'))],
                        ),
                ),
              ),
            ),
        ]);
      },
    );
  }
}
