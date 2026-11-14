import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/member_widgets.dart';
import 'portfolio_screen.dart';

Future<void> showDividendSheet(BuildContext context, WidgetRef ref) async {
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: const _DividendForm()),
  );
  if (done == true) {
    refreshJournal(ref);
    if (context.mounted) showMessage(context, 'Dividend added.');
  }
}

class _DividendForm extends ConsumerStatefulWidget {
  const _DividendForm();
  @override
  ConsumerState<_DividendForm> createState() => _DividendFormState();
}

class _DividendFormState extends ConsumerState<_DividendForm> {
  final _ticker = TextEditingController();
  final _amount = TextEditingController();
  DateTime _date = DateTime.now();
  String? _brokerId;
  bool _busy = false;

  @override
  void dispose() {
    _ticker.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save(List<Broker> brokers) async {
    final ticker = _ticker.text.trim().toUpperCase();
    final amount = double.tryParse(_amount.text.trim());
    final broker = _brokerId ?? (brokers.isNotEmpty ? brokers.first.id : null);
    if (ticker.isEmpty || amount == null || amount <= 0) return showMessage(context, 'Enter a ticker and the amount received.');
    if (broker == null) return showMessage(context, 'Choose your broker.');
    setState(() => _busy = true);
    final ok = await runAction(context, () => ref.read(memberRepositoryProvider).addDividend({'brokerId': broker, 'ticker': ticker, 'amountKes': amount, 'paymentDate': yyyyMmDd(_date)}));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final brokers = ref.watch(brokersProvider).value?.value ?? const <Broker>[];
    final tickers = (ref.watch(stocksProvider).value?.value ?? const []).map((s) => s.ticker).toList()..sort();
    final selected = _brokerId ?? (brokers.isNotEmpty ? brokers.first.id : null);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Add a dividend', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 14),
        Autocomplete<String>(
          optionsBuilder: (v) => v.text.isEmpty ? const Iterable<String>.empty() : tickers.where((t) => t.startsWith(v.text.toUpperCase())).take(6),
          onSelected: (v) => _ticker.text = v,
          fieldViewBuilder: (context, ctrl, focus, _) => TextField(controller: ctrl, focusNode: focus, textCapitalization: TextCapitalization.characters, onChanged: (v) => _ticker.text = v, decoration: const InputDecoration(labelText: 'Ticker', hintText: 'e.g. SCOM')),
        ),
        const SizedBox(height: 12),
        TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount received (KES)')),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: brokers.any((x) => x.id == selected) ? selected : null,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Broker'),
          items: [for (final x in brokers) DropdownMenuItem(value: x.id, child: Text(x.name, overflow: TextOverflow.ellipsis))],
          onChanged: (v) => setState(() => _brokerId = v),
        ),
        const SizedBox(height: 12),
        InkWell(
          onTap: () async {
            final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2000), lastDate: DateTime.now());
            if (d != null) setState(() => _date = d);
          },
          child: InputDecorator(decoration: const InputDecoration(labelText: 'Payment date', suffixIcon: Icon(Icons.calendar_today_rounded, size: 18)), child: Text(formatDate(_date), style: AppText.body(c.textPrimary))),
        ),
        const SizedBox(height: 18),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: _busy ? null : () => _save(brokers), child: Text(_busy ? 'Saving…' : 'Save dividend')),
      ]),
    );
  }
}
