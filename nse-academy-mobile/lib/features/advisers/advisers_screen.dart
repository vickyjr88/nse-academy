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
import '../billing/billing_gateway.dart';

class _Avatar extends StatelessWidget {
  const _Avatar(this.adviser, {this.size = 44});
  final Adviser adviser;
  final double size;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: c.primarySurface,
      foregroundImage: adviser.photoUrl == null ? null : NetworkImage(adviser.photoUrl!),
      onForegroundImageError: adviser.photoUrl == null ? null : (_, _) {},
      child: Text(adviser.initials, style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w700)),
    );
  }
}

/// The directory of approved advisers. Reading it needs no account; connecting and asking do.
class AdvisersScreen extends ConsumerStatefulWidget {
  const AdvisersScreen({super.key});
  @override
  ConsumerState<AdvisersScreen> createState() => _AdvisersScreenState();
}

class _AdvisersScreenState extends ConsumerState<AdvisersScreen> {
  int _pages = 1;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    final self = ref.watch(adviserSelfProvider).value;
    final last = ref.watch(adviserDirectoryProvider(_pages));
    return Scaffold(
      appBar: AppBar(title: Text('Financial advisers', style: AppText.h3(c.textPrimary))),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
        if (signedIn)
          SurfaceCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              ListTile(leading: Icon(Icons.forum_rounded, color: c.primary), title: Text('My questions', style: AppText.body(c.textPrimary)), subtitle: Text('Conversations with your advisers', style: AppText.caption(c.textSecondary)), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/advisers/questions')),
              const Divider(height: 1),
              ListTile(leading: Icon(Icons.lightbulb_rounded, color: c.primary), title: Text('Insights', style: AppText.body(c.textPrimary)), subtitle: Text('Notes your advisers have published', style: AppText.caption(c.textSecondary)), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/advisers/insights')),
              if (self != null) ...[
                const Divider(height: 1),
                ListTile(leading: Icon(Icons.badge_rounded, color: c.primary), title: Text('Adviser workspace', style: AppText.body(c.textPrimary)), subtitle: Text('Requests, client questions and insights', style: AppText.caption(c.textSecondary)), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/advisers/workspace')),
              ],
            ]),
          ),
        if (signedIn) const SizedBox(height: Gap.section),
        Text('Independent advisers introduced through NSE Academy. NSE Academy does not give investment advice itself, and what an adviser tells you is theirs, not ours.', style: AppText.caption(c.textSecondary)),
        const SizedBox(height: 14),
        for (var p = 1; p <= _pages; p++)
          ref.watch(adviserDirectoryProvider(p)).when(
                loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator())),
                error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(adviserDirectoryProvider(p))),
                data: (page) => Column(children: [
                  if (p == 1 && page.data.isEmpty) const EmptyState(icon: Icons.groups_rounded, title: 'No advisers listed yet', body: 'Advisers appear here once they have been approved.'),
                  for (final a in page.data) _AdviserTile(a),
                ]),
              ),
        if (last.value?.hasMore ?? false) Center(child: TextButton(onPressed: () => setState(() => _pages++), child: const Text('Show more advisers'))),
      ]),
    );
  }
}

class _AdviserTile extends StatelessWidget {
  const _AdviserTile(this.a);
  final Adviser a;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SurfaceCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          leading: _Avatar(a),
          title: Text(a.name, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
          subtitle: Text(a.headline, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.caption(c.textSecondary)),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/advisers/${a.id}'),
        ),
      ),
    );
  }
}

class AdviserDetailScreen extends ConsumerWidget {
  const AdviserDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final signedIn = ref.watch(authProvider).value?.signedIn ?? false;
    return Scaffold(
      appBar: AppBar(title: Text('Adviser', style: AppText.h3(c.textPrimary))),
      body: ref.watch(adviserProvider(id)).when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(adviserProvider(id))),
            data: (a) => ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
              Row(children: [
                _Avatar(a, size: 64),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(a.name, style: AppText.h2(c.textPrimary)), Text(a.headline, style: AppText.bodySmall(c.textSecondary))])),
              ]),
              if (a.specialties.isNotEmpty) ...[const SizedBox(height: 14), Wrap(spacing: 8, runSpacing: 6, children: [for (final s in a.specialties) Chip(label: Text(s), visualDensity: VisualDensity.compact)])],
              if (a.credentials != null) ...[const SizedBox(height: 14), const Eyebrow('Credentials'), const SizedBox(height: 4), Text(a.credentials!, style: AppText.body(c.textPrimary))],
              const SizedBox(height: 14),
              const Eyebrow('About'),
              const SizedBox(height: 4),
              Text(a.bio, style: AppText.body(c.textPrimary)),
              const SizedBox(height: 20),
              if (!signedIn)
                SignInPrompt()
              else
                _Connect(adviser: a),
            ]),
          ),
    );
  }
}

/// Signed-out members are asked to sign in before connecting (the account is free).
class SignInPrompt extends StatelessWidget {
  const SignInPrompt({super.key});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      color: c.primarySurface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Sign in to connect', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)),
        const SizedBox(height: 6),
        Text('Connecting and asking questions need your free NSE Academy account.', style: AppText.bodySmall(c.textSecondary)),
        const SizedBox(height: 12),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => context.push('/signin'), child: const Text('Sign in')),
      ]),
    );
  }
}

class _Connect extends ConsumerStatefulWidget {
  const _Connect({required this.adviser});
  final Adviser adviser;
  @override
  ConsumerState<_Connect> createState() => _ConnectState();
}

class _ConnectState extends ConsumerState<_Connect> {
  bool _busy = false;

  Future<void> _connect() async {
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).connectToAdviser(widget.adviser.id), done: 'Request sent. You can ask a question once ${widget.adviser.name} accepts.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) ref.invalidate(adviserConnectionsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return MemberAsync<List<AdviserConnection>>(
      value: ref.watch(adviserConnectionsProvider),
      onRetry: () => ref.invalidate(adviserConnectionsProvider),
      builder: (all) {
        final mine = all.where((x) => x.adviser.id == widget.adviser.id).firstOrNull;
        return switch (mine?.status) {
          null => FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : _connect, child: Text(_busy ? 'Sending…' : 'Request to connect')),
          ConnectionStatus.pending => SurfaceCard(child: Row(children: [Icon(Icons.hourglass_top_rounded, color: c.textSecondary), const SizedBox(width: 12), Expanded(child: Text('Request sent. ${widget.adviser.name} has not answered yet.', style: AppText.bodySmall(c.textSecondary)))])),
          ConnectionStatus.declined => SurfaceCard(child: Row(children: [Icon(Icons.info_outline_rounded, color: c.textSecondary), const SizedBox(width: 12), Expanded(child: Text('${widget.adviser.name} did not accept your request.', style: AppText.bodySmall(c.textSecondary)))])),
          ConnectionStatus.accepted => FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: () => showAskSheet(context, ref, widget.adviser), icon: const Icon(Icons.edit_rounded, size: 18), label: const Text('Ask a question')),
        };
      },
    );
  }
}

/// The "ask a question" sheet. Shows how many questions are left this month on the member's plan.
Future<void> showAskSheet(BuildContext context, WidgetRef ref, Adviser adviser) async {
  final id = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: _AskForm(adviser: adviser)),
  );
  if (id != null && context.mounted) {
    ref
      ..invalidate(myQuestionsProvider)
      ..invalidate(questionAllowanceProvider);
    if (id.isNotEmpty) context.push('/advisers/questions/$id');
  }
}

class _AskForm extends ConsumerStatefulWidget {
  const _AskForm({required this.adviser});
  final Adviser adviser;
  @override
  ConsumerState<_AskForm> createState() => _AskFormState();
}

class _AskFormState extends ConsumerState<_AskForm> {
  final _q = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _q.text.trim();
    if (text.length < 5) return showMessage(context, 'Write your question (at least a few words).');
    setState(() => _busy = true);
    String? id;
    final ok = await runAction(context, () async => id = await ref.read(memberRepositoryProvider).askAdviser(widget.adviser.id, text));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, id ?? '');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final allowance = ref.watch(questionAllowanceProvider).value;
    final exhausted = allowance?.exhausted ?? false;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Ask ${widget.adviser.name}', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 4),
        if (allowance != null)
          Text(
            allowance.unlimited ? 'Your firm covers your questions, so there is no monthly limit.' : '${allowance.remaining} of ${allowance.limit} question${allowance.limit == 1 ? '' : 's'} left this month on your ${allowance.tier} plan.${allowance.resetsOn == null ? '' : ' Resets ${formatDate(allowance.resetsOn!)}.'}',
            style: AppText.caption(exhausted ? c.loss : c.textSecondary),
          ),
        const SizedBox(height: 12),
        TextField(controller: _q, minLines: 4, maxLines: 8, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Your question', alignLabelWithHint: true)),
        const SizedBox(height: 6),
        Text('Do not include passwords or account numbers. Advisers reply in the app and by email.', style: AppText.caption(c.textMuted)),
        const SizedBox(height: 14),
        if (exhausted && PlayBillingGateway.supported && (allowance?.tier != 'premium'))
          Padding(padding: const EdgeInsets.only(bottom: 10), child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () { Navigator.pop(context); context.push('/profile/plan'); }, child: const Text('See plans for more questions'))),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy || exhausted ? null : _send, child: Text(_busy ? 'Sending…' : 'Send question')),
      ]),
    );
  }
}

class MyQuestionsScreen extends ConsumerWidget {
  const MyQuestionsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('My questions', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Your questions',
        icon: Icons.forum_rounded,
        pitch: const ['Ask the advisers you are connected to.', 'Read their replies in one place.'],
        child: MemberAsync<List<AdviserQuestion>>(
          value: ref.watch(myQuestionsProvider),
          onRetry: () => ref.invalidate(myQuestionsProvider),
          builder: (list) => list.isEmpty
              ? EmptyState(icon: Icons.forum_outlined, title: 'No questions yet', body: 'Connect with an adviser, then ask them anything about investing on the NSE.', action: FilledButton(onPressed: () => context.push('/advisers'), child: const Text('Find an adviser')))
              : RefreshIndicator(
                  onRefresh: () async => ref.refresh(myQuestionsProvider.future),
                  child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [for (final q in list) _QuestionTile(q, route: '/advisers/questions/${q.id}')]),
                ),
        ),
      ),
    );
  }
}

class _QuestionTile extends StatelessWidget {
  const _QuestionTile(this.q, {required this.route});
  final AdviserQuestion q;
  final String route;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SurfaceCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          title: Text(q.subject, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.body(c.textPrimary)),
          subtitle: Text('${q.withName} · ${formatDate(q.updated)}', style: AppText.caption(c.textSecondary)),
          trailing: Chip(label: Text(q.answered ? 'Replied' : 'Waiting'), visualDensity: VisualDensity.compact, backgroundColor: q.answered ? c.primarySurface : null, side: BorderSide.none),
          onTap: () => context.push(route),
        ),
      ),
    );
  }
}

/// One conversation. A member replies as the client; an adviser answers from the workspace (`asAdviser`).
class QuestionThreadScreen extends ConsumerStatefulWidget {
  const QuestionThreadScreen({super.key, required this.id, this.asAdviser = false});
  final String id;
  final bool asAdviser;
  @override
  ConsumerState<QuestionThreadScreen> createState() => _QuestionThreadState();
}

class _QuestionThreadState extends ConsumerState<QuestionThreadScreen> {
  final _msg = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _msg.text.trim();
    if (text.length < 2) return;
    setState(() => _busy = true);
    final repo = ref.read(memberRepositoryProvider);
    final ok = await runAction(context, () => widget.asAdviser ? repo.answerQuestion(widget.id, text) : repo.replyToQuestion(widget.id, text));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _msg.clear();
      ref
        ..invalidate(questionThreadProvider(widget.id))
        ..invalidate(myQuestionsProvider)
        ..invalidate(clientQuestionsProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final thread = ref.watch(questionThreadProvider(widget.id));
    return Scaffold(
      appBar: AppBar(title: Text(thread.value == null ? 'Conversation' : (widget.asAdviser ? thread.value!.clientName : thread.value!.adviserName), style: AppText.h3(c.textPrimary))),
      body: thread.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => MemberAsync<void>(value: AsyncError(e, StackTrace.empty), builder: (_) => const SizedBox(), onRetry: () => ref.invalidate(questionThreadProvider(widget.id))),
        data: (t) => Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 16), children: [
              for (final m in t.messages)
                Align(
                  alignment: m.fromAdviser == widget.asAdviser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: m.fromAdviser == widget.asAdviser ? c.primarySurface : c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.border)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.fromAdviser ? t.adviserName : t.clientName, style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(m.body, style: AppText.body(c.textPrimary)),
                      const SizedBox(height: 4),
                      Text(formatDate(m.at), style: AppText.caption(c.textMuted)),
                    ]),
                  ),
                ),
            ]),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(Gap.screen, 6, Gap.screen, 10 + MediaQuery.of(context).viewInsets.bottom),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(child: TextField(controller: _msg, minLines: 1, maxLines: 5, textCapitalization: TextCapitalization.sentences, decoration: InputDecoration(hintText: widget.asAdviser ? 'Write your answer' : 'Write a reply'))),
                const SizedBox(width: 8),
                IconButton.filled(onPressed: _busy ? null : _send, icon: const Icon(Icons.send_rounded), tooltip: 'Send'),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Adviser insights', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Adviser insights',
        icon: Icons.lightbulb_rounded,
        pitch: const ['Read notes your connected advisers publish.', 'Each one is for education and information, not a personal recommendation.'],
        child: MemberAsync<List<AdviserInsight>>(
          value: ref.watch(insightsFeedProvider),
          onRetry: () => ref.invalidate(insightsFeedProvider),
          builder: (list) => list.isEmpty
              ? const EmptyState(icon: Icons.lightbulb_outline_rounded, title: 'Nothing yet', body: 'Insights from the advisers you are connected to show up here.')
              : ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [for (final i in list) InsightCard(i)]),
        ),
      ),
    );
  }
}

class InsightCard extends StatelessWidget {
  const InsightCard(this.i, {super.key});
  final AdviserInsight i;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(i.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)),
          const SizedBox(height: 2),
          Text([if (i.adviserName.isNotEmpty) i.adviserName, formatDate(i.at)].join(' · '), style: AppText.caption(c.textSecondary)),
          const SizedBox(height: 8),
          Text(i.body, style: AppText.body(c.textPrimary)),
          if (i.tickers.isNotEmpty) ...[const SizedBox(height: 8), Wrap(spacing: 6, children: [for (final t in i.tickers) ActionChip(label: Text(t), visualDensity: VisualDensity.compact, onPressed: () => context.push('/stock/$t'))])],
        ]),
      ),
    );
  }
}
