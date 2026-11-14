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
import 'advisers_screen.dart';

/// For members who are advisers: who wants to connect, the questions clients have asked, and the insights they publish.
/// Applying to become an adviser, the client list and buy/sell alerts stay on the website.
class AdviserWorkspaceScreen extends ConsumerWidget {
  const AdviserWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Adviser workspace', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Adviser workspace',
        icon: Icons.badge_rounded,
        pitch: const ['For advisers listed on NSE Academy.', 'Answer client questions and publish insights.'],
        child: MemberAsync<AdviserSelf?>(
          value: ref.watch(adviserSelfProvider),
          onRetry: () => ref.invalidate(adviserSelfProvider),
          builder: (me) {
            if (me == null) return const EmptyState(icon: Icons.badge_outlined, title: 'No adviser profile', body: 'This account is not registered as an adviser. Advisers apply on the NSE Academy website.');
            if (!me.approved) return EmptyState(icon: Icons.hourglass_top_rounded, title: me.approval == 'suspended' ? 'Profile suspended' : 'Waiting for approval', body: me.approval == 'suspended' ? 'Your adviser profile is not active. Contact NSE Academy for details.' : 'Your adviser profile is being reviewed. You can use the workspace as soon as it is approved.');
            return const _Tabs();
          },
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs();
  @override
  Widget build(BuildContext context) => const DefaultTabController(
        length: 3,
        child: Column(children: [
          TabBar(tabs: [Tab(text: 'Requests'), Tab(text: 'Questions'), Tab(text: 'Insights')]),
          Expanded(child: TabBarView(children: [_Requests(), _Questions(), _Insights()])),
        ]),
      );
}

class _Requests extends ConsumerWidget {
  const _Requests();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<List<ClientRequest>>(
      value: ref.watch(clientRequestsProvider),
      onRetry: () => ref.invalidate(clientRequestsProvider),
      builder: (list) => list.isEmpty
          ? const EmptyState(icon: Icons.person_add_alt_1_rounded, title: 'No pending requests', body: 'People who ask to connect with you appear here.')
          : ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 12, Gap.screen, 32), children: [
              for (final r in list)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SurfaceCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.name, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
                      Text('Asked ${formatDate(r.at)}', style: AppText.caption(c.textSecondary)),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: OutlinedButton(onPressed: () => _respond(context, ref, r, false), child: const Text('Decline'))),
                        const SizedBox(width: 10),
                        Expanded(child: FilledButton(onPressed: () => _respond(context, ref, r, true), child: const Text('Accept'))),
                      ]),
                    ]),
                  ),
                ),
            ]),
    );
  }

  Future<void> _respond(BuildContext context, WidgetRef ref, ClientRequest r, bool accept) async {
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).respondToRequest(r.id, accept), done: accept ? '${r.name} is now your client.' : 'Request declined.');
    if (ok) ref.invalidate(clientRequestsProvider);
  }
}

class _Questions extends ConsumerWidget {
  const _Questions();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<List<AdviserQuestion>>(
      value: ref.watch(clientQuestionsProvider),
      onRetry: () => ref.invalidate(clientQuestionsProvider),
      builder: (list) => list.isEmpty
          ? const EmptyState(icon: Icons.forum_outlined, title: 'No questions yet', body: 'Questions from your clients appear here.')
          : RefreshIndicator(
              onRefresh: () async => ref.refresh(clientQuestionsProvider.future),
              child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 12, Gap.screen, 32), children: [
                for (final q in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: SurfaceCard(
                      padding: EdgeInsets.zero,
                      child: ListTile(
                        title: Text(q.subject, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.body(c.textPrimary)),
                        subtitle: Text('${q.withName} · ${formatDate(q.updated)}', style: AppText.caption(c.textSecondary)),
                        trailing: Chip(label: Text(q.answered ? 'Answered' : 'Needs answer'), visualDensity: VisualDensity.compact, backgroundColor: q.answered ? null : c.primarySurface, side: BorderSide.none),
                        onTap: () => context.push('/advisers/questions/${q.id}?as=adviser'),
                      ),
                    ),
                  ),
              ]),
            ),
    );
  }
}

class _Insights extends ConsumerWidget {
  const _Insights();
  @override
  Widget build(BuildContext context, WidgetRef ref) => Stack(children: [
        MemberAsync<List<AdviserInsight>>(
          value: ref.watch(myInsightsProvider),
          onRetry: () => ref.invalidate(myInsightsProvider),
          builder: (list) => list.isEmpty
              ? const EmptyState(icon: Icons.lightbulb_outline_rounded, title: 'No insights yet', body: 'Publish a note and every connected client is told about it.')
              : ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 12, Gap.screen, 96), children: [for (final i in list) InsightCard(i)]),
        ),
        Positioned(right: 16, bottom: 16, child: FloatingActionButton.extended(onPressed: () => _publish(context, ref), icon: const Icon(Icons.add_rounded), label: const Text('Publish'))),
      ]);

  Future<void> _publish(BuildContext context, WidgetRef ref) async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: const _PublishForm()),
    );
    if (done == true) {
      ref.invalidate(myInsightsProvider);
      if (context.mounted) showMessage(context, 'Insight published. Your connected clients have been told.');
    }
  }
}

class _PublishForm extends ConsumerStatefulWidget {
  const _PublishForm();
  @override
  ConsumerState<_PublishForm> createState() => _PublishFormState();
}

class _PublishFormState extends ConsumerState<_PublishForm> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _tickers = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _tickers.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    if (_title.text.trim().length < 3 || _body.text.trim().length < 10) return showMessage(context, 'Add a title and a few sentences.');
    setState(() => _busy = true);
    final tickers = _tickers.text.split(RegExp(r'[,\s]+')).map((t) => t.trim().toUpperCase()).where((t) => t.isNotEmpty).toList();
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).publishInsight(title: _title.text.trim(), body: _body.text.trim(), tickers: tickers));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Publish an insight', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 4),
        Text('Sent to every connected client, in the app and by email. Keep it educational.', style: AppText.caption(c.textSecondary)),
        const SizedBox(height: 12),
        TextField(controller: _title, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Title')),
        const SizedBox(height: 12),
        TextField(controller: _body, minLines: 4, maxLines: 8, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Insight', alignLabelWithHint: true)),
        const SizedBox(height: 12),
        TextField(controller: _tickers, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Tickers (optional)', hintText: 'SCOM, KCB')),
        const SizedBox(height: 16),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : _go, child: Text(_busy ? 'Publishing…' : 'Publish to clients')),
      ]),
    );
  }
}
