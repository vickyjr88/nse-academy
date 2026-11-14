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
import 'portfolio_screen.dart';

/// Add or edit one trade. Pass [edit] to change an existing trade.
class TradeFormScreen extends ConsumerStatefulWidget {
  const TradeFormScreen({super.key, this.edit, this.ticker, this.price});
  final Trade? edit;
  final String? ticker;
  final double? price;
  @override
  ConsumerState<TradeFormScreen> createState() => _TradeFormScreenState();
}

class _TradeFormScreenState extends ConsumerState<TradeFormScreen> {
  late final TextEditingController _ticker = TextEditingController(text: widget.edit?.ticker ?? widget.ticker ?? '');
  late final TextEditingController _qty = TextEditingController(text: widget.edit == null ? '' : '${widget.edit!.quantity}');
  late final TextEditingController _price = TextEditingController(text: widget.edit != null ? widget.edit!.price.toString() : (widget.price?.toStringAsFixed(2) ?? ''));
  late final TextEditingController _fees = TextEditingController(text: widget.edit == null ? '' : widget.edit!.fees.toString());
  late final TextEditingController _notes = TextEditingController(text: widget.edit?.notes ?? '');
  late bool _buy = widget.edit?.isBuy ?? true;
  late DateTime _date = widget.edit?.date.toLocal() ?? DateTime.now();
  String? _brokerId;
  bool _busy = false;

  @override
  void dispose() {
    for (final t in [_ticker, _qty, _price, _fees, _notes]) {
      t.dispose();
    }
    super.dispose();
  }

  Future<void> _save(List<Broker> brokers) async {
    final ticker = _ticker.text.trim().toUpperCase();
    final qty = int.tryParse(_qty.text.trim());
    final price = double.tryParse(_price.text.trim());
    final fees = _fees.text.trim().isEmpty ? null : double.tryParse(_fees.text.trim());
    final broker = _brokerId ?? widget.edit?.brokerId ?? (brokers.isNotEmpty ? brokers.first.id : null);
    if (ticker.isEmpty || qty == null || qty <= 0 || price == null || price <= 0) return showMessage(context, 'Enter a ticker, a whole number of shares and a price above zero.');
    if (broker == null) return showMessage(context, 'Choose your broker.');
    final body = {'brokerId': broker, 'ticker': ticker, 'side': _buy ? 'BUY' : 'SELL', 'quantity': qty, 'pricePerShare': price, 'feesKes': ?fees, 'tradeDate': yyyyMmDd(_date), if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim()};
    setState(() => _busy = true);
    final repo = ref.read(memberRepositoryProvider);
    final ok = await runAction(context, () => widget.edit == null ? repo.addTrade(body) : repo.updateTrade(widget.edit!.id, body), done: widget.edit == null ? 'Trade added.' : 'Trade updated.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      refreshJournal(ref);
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final brokers = ref.watch(brokersProvider);
    final tickers = (ref.watch(stocksProvider).value?.value ?? const []).map((s) => s.ticker).toList()..sort();
    return Scaffold(
      appBar: AppBar(title: Text(widget.edit == null ? 'Add trade' : 'Edit trade', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.intermediary,
        title: 'Portfolio journal',
        icon: Icons.account_balance_wallet_rounded,
        pitch: const ['Log your buys and sells.', 'Holdings, gains and allocation are worked out for you.'],
        child: brokers.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(brokersProvider)),
          data: (b) {
            final list = b.value;
            final selected = _brokerId ?? widget.edit?.brokerId ?? (list.isNotEmpty ? list.first.id : null);
            return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
              SegmentedButton<bool>(
                segments: const [ButtonSegment(value: true, label: Text('Buy')), ButtonSegment(value: false, label: Text('Sell'))],
                selected: {_buy},
                onSelectionChanged: (s) => setState(() => _buy = s.first),
              ),
              const SizedBox(height: 16),
              Autocomplete<String>(
                initialValue: TextEditingValue(text: _ticker.text),
                optionsBuilder: (v) => v.text.isEmpty ? const Iterable<String>.empty() : tickers.where((t) => t.startsWith(v.text.toUpperCase())).take(6),
                onSelected: (v) => _ticker.text = v,
                fieldViewBuilder: (context, ctrl, focus, _) => TextField(controller: ctrl, focusNode: focus, textCapitalization: TextCapitalization.characters, onChanged: (v) => _ticker.text = v, decoration: const InputDecoration(labelText: 'Ticker', hintText: 'e.g. SCOM')),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Shares'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Price per share'))),
              ]),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: list.any((x) => x.id == selected) ? selected : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Broker'),
                items: [for (final x in list) DropdownMenuItem(value: x.id, child: Text('${x.name} (${x.feePercent.toStringAsFixed(2)}%)', overflow: TextOverflow.ellipsis))],
                onChanged: (v) => setState(() => _brokerId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: _fees, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Fees (optional)', helperText: 'Leave blank to work it out from the broker\'s rate.')),
              const SizedBox(height: 12),
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2000), lastDate: DateTime.now());
                  if (d != null) setState(() => _date = d);
                },
                child: InputDecorator(decoration: const InputDecoration(labelText: 'Trade date', suffixIcon: Icon(Icons.calendar_today_rounded, size: 18)), child: Text(formatDate(_date), style: AppText.body(c.textPrimary))),
              ),
              const SizedBox(height: 12),
              TextField(controller: _notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Notes (optional)')),
              const SizedBox(height: 22),
              FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)), onPressed: _busy ? null : () => _save(list), child: Text(_busy ? 'Saving…' : (widget.edit == null ? 'Save trade' : 'Save changes'))),
            ]);
          },
        ),
      ),
    );
  }
}
