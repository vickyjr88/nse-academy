import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';

/// Opens the "new alert" sheet. `price` pre-fills the target with the current price.
Future<void> showAlertSheet(BuildContext context, WidgetRef ref, {String? ticker, double? price}) async {
  final created = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: _AlertForm(ticker: ticker, price: price)),
  );
  if (created == true) {
    ref.invalidate(alertsProvider);
    if (context.mounted) showMessage(context, 'Alert set. It will appear in your inbox when it triggers.');
  }
}

class _AlertForm extends ConsumerStatefulWidget {
  const _AlertForm({this.ticker, this.price});
  final String? ticker;
  final double? price;
  @override
  ConsumerState<_AlertForm> createState() => _AlertFormState();
}

class _AlertFormState extends ConsumerState<_AlertForm> {
  late final TextEditingController _ticker = TextEditingController(text: widget.ticker ?? '');
  late final TextEditingController _target = TextEditingController(text: widget.price == null ? '' : widget.price!.toStringAsFixed(2));
  bool _above = true;
  bool _busy = false;

  @override
  void dispose() {
    _ticker.dispose();
    _target.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final t = _ticker.text.trim().toUpperCase();
    final p = double.tryParse(_target.text.trim());
    if (t.isEmpty || p == null || p <= 0) {
      showMessage(context, 'Enter a ticker and a price above zero.');
      return;
    }
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).addAlert(ticker: t, target: p, above: _above));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tickers = (ref.watch(stocksProvider).value?.value ?? const []).map((s) => s.ticker).toList()..sort();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('New price alert', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 14),
        Autocomplete<String>(
          initialValue: TextEditingValue(text: _ticker.text),
          optionsBuilder: (v) => v.text.isEmpty ? const Iterable<String>.empty() : tickers.where((t) => t.startsWith(v.text.toUpperCase())).take(6),
          onSelected: (v) => _ticker.text = v,
          fieldViewBuilder: (context, ctrl, focus, _) => TextField(
            controller: ctrl,
            focusNode: focus,
            textCapitalization: TextCapitalization.characters,
            onChanged: (v) => _ticker.text = v,
            decoration: const InputDecoration(labelText: 'Ticker', hintText: 'e.g. SCOM'),
          ),
        ),
        const SizedBox(height: 12),
        SegmentedButton<bool>(
          segments: const [ButtonSegment(value: true, label: Text('Rises to'), icon: Icon(Icons.trending_up_rounded)), ButtonSegment(value: false, label: Text('Falls to'), icon: Icon(Icons.trending_down_rounded))],
          selected: {_above},
          onSelectionChanged: (s) => setState(() => _above = s.first),
        ),
        const SizedBox(height: 12),
        TextField(controller: _target, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Price (KES)')),
        const SizedBox(height: 18),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Set alert')),
      ]),
    );
  }
}

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Price alerts', style: AppText.h3(c.textPrimary)),
          bottom: const TabBar(tabs: [Tab(text: 'Alerts'), Tab(text: 'Inbox')]),
        ),
        floatingActionButton: ref.watch(tierProvider).atLeast(Tier.intermediary) ? FloatingActionButton.extended(onPressed: () => showAlertSheet(context, ref), icon: const Icon(Icons.add_alert_rounded), label: const Text('New alert')) : null,
        body: PlanGate(
          required: Tier.intermediary,
          title: 'Price alerts',
          icon: Icons.notifications_active_rounded,
          pitch: const ['Pick a stock and a price. We note it in your inbox the moment the price crosses it.', 'Works for rises and falls.', 'Your inbox keeps every alert so you can catch up later.'],
          child: const TabBarView(children: [_AlertList(), _Inbox()]),
        ),
      ),
    );
  }
}

class _AlertList extends ConsumerWidget {
  const _AlertList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return MemberAsync<List<PriceAlert>>(
      value: ref.watch(alertsProvider),
      onRetry: () => ref.invalidate(alertsProvider),
      builder: (alerts) {
        final live = alerts.where((a) => a.status != 'cancelled').toList();
        if (live.isEmpty) return const SingleChildScrollView(child: EmptyState(icon: Icons.notifications_none_rounded, title: 'No alerts yet', body: 'Tap New alert, or open a stock and tap Price alert.'));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(alertsProvider),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 96), children: [
            for (final a in live)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SurfaceCard(
                  padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
                  child: Row(children: [
                    Icon(a.above ? Icons.trending_up_rounded : Icons.trending_down_rounded, color: a.above ? c.gain : c.loss),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(a.ticker, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w700)),
                        Text('${a.above ? 'Rises to' : 'Falls to'} KES ${formatPrice(a.target)}', style: AppText.bodySmall(c.textSecondary)),
                        if (a.status == 'triggered') Text('Triggered${a.triggeredAt == null ? '' : ' ${formatShortDate(a.triggeredAt!)}'}', style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700)),
                      ]),
                    ),
                    IconButton(
                      tooltip: 'Delete alert',
                      icon: Icon(Icons.delete_outline_rounded, color: c.textMuted),
                      onPressed: () async {
                        final ok = await runAction(context, () => ref.read(memberRepositoryProvider).deleteAlert(a.id), done: 'Alert deleted.');
                        if (ok) ref.invalidate(alertsProvider);
                      },
                    ),
                  ]),
                ),
              ),
          ]),
        );
      },
    );
  }
}

class _Inbox extends ConsumerWidget {
  const _Inbox();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    void refresh() {
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadProvider);
    }

    return MemberAsync<List<AppNotification>>(
      value: ref.watch(notificationsProvider),
      onRetry: refresh,
      builder: (items) {
        if (items.isEmpty) return const SingleChildScrollView(child: EmptyState(icon: Icons.inbox_rounded, title: 'Your inbox is empty', body: 'Alerts and portfolio notes land here.'));
        final unread = items.where((n) => !n.read).length;
        return RefreshIndicator(
          onRefresh: () async => refresh(),
          child: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
            if (unread > 0)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () async {
                    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).markAllRead());
                    if (ok) refresh();
                  },
                  child: Text('Mark all $unread as read'),
                ),
              ),
            for (final n in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Tappable(
                  onTap: () async {
                    if (n.read) return;
                    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).markRead(n.id));
                    if (ok) refresh();
                  },
                  child: SurfaceCard(
                    color: n.read ? null : c.primarySurface,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        if (!n.read) Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 8), decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle)),
                        Expanded(child: Text(n.title, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700))),
                        Text(formatShortDate(n.at), style: AppText.caption(c.textMuted)),
                      ]),
                      if (n.body.isNotEmpty) ...[const SizedBox(height: 4), Text(n.body, style: AppText.bodySmall(c.textSecondary))],
                    ]),
                  ),
                ),
              ),
          ]),
        );
      },
    );
  }
}
