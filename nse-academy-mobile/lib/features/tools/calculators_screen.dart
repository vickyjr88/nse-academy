import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';

double _n(TextEditingController c) => double.tryParse(c.text.replaceAll(',', '').trim()) ?? 0;

/// Five planning calculators that run on the phone, with no sign-in. Results are estimates.
class CalculatorsScreen extends StatefulWidget {
  const CalculatorsScreen({super.key});
  @override
  State<CalculatorsScreen> createState() => _CalculatorsScreenState();
}

class _CalculatorsScreenState extends State<CalculatorsScreen> {
  int _i = 0;
  static const _names = ['Broker fees', 'Dividend yield', 'Compound growth', 'DCA', 'Income goal'];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Calculators', style: AppText.h3(c.textPrimary))),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
        SizedBox(
          height: 40,
          child: ListView(scrollDirection: Axis.horizontal, children: [for (var k = 0; k < _names.length; k++) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(_names[k]), selected: _i == k, onSelected: (_) => setState(() => _i = k)))]),
        ),
        const SizedBox(height: 14),
        switch (_i) { 0 => const _BrokerFees(), 1 => const _Yield(), 2 => const _Compound(), 3 => const _Dca(), _ => const _Income() },
        const SizedBox(height: 16),
        Text('Estimates for planning only. Real fees and returns differ; confirm fees with your broker.', style: AppText.caption(c.textMuted)),
      ]),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.ctrl, this.onChanged, {this.hint});
  final String label;
  final TextEditingController ctrl;
  final VoidCallback onChanged;
  final String? hint;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(controller: ctrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => onChanged(), decoration: InputDecoration(labelText: label, hintText: hint)),
      );
}

class _Result extends StatelessWidget {
  const _Result(this.rows, {this.note});
  final List<(String, String, {bool strong})> rows;
  final String? note;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      color: c.primarySurface,
      borderColor: c.primary.withValues(alpha: 0.25),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [Expanded(child: Text(r.$1, style: AppText.bodySmall(c.textSecondary))), Text(r.$2, style: AppText.metric(r.strong ? c.primary : c.textPrimary).copyWith(fontSize: r.strong ? 17 : 14))]),
          ),
        if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note!, style: AppText.caption(c.textSecondary))),
      ]),
    );
  }
}

// 1. Broker fees: brokerage plus the CDS, NSE and CMA levies.
class _BrokerFees extends StatefulWidget {
  const _BrokerFees();
  @override
  State<_BrokerFees> createState() => _BrokerFeesState();
}

class _BrokerFeesState extends State<_BrokerFees> {
  final _value = TextEditingController();
  final _custom = TextEditingController();
  bool _buy = true;
  int _rate = 0;
  static const _rates = [1.8, 2.1];

  @override
  void dispose() {
    _value.dispose();
    _custom.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tv = _n(_value);
    final rate = _rate < _rates.length ? _rates[_rate] : _n(_custom);
    final brokerage = tv * rate / 100;
    final cds = tv * 0.0012, nse = tv * 0.0012, cma = tv * 0.0006;
    final total = brokerage + cds + nse + cma;
    final net = _buy ? tv + total : tv - total;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SegmentedButton<bool>(segments: const [ButtonSegment(value: true, label: Text('Buy')), ButtonSegment(value: false, label: Text('Sell'))], selected: {_buy}, onSelectionChanged: (s) => setState(() => _buy = s.first)),
      const SizedBox(height: 12),
      _Field('Trade value (KES)', _value, () => setState(() {})),
      Wrap(spacing: 8, children: [for (final e in [(0, 'Standard 1.8%'), (1, 'Faida / SIB 2.1%'), (2, 'Custom')]) ChoiceChip(label: Text(e.$2), selected: _rate == e.$1, onSelected: (_) => setState(() => _rate = e.$1))]),
      const SizedBox(height: 12),
      if (_rate == 2) _Field('Brokerage rate (%)', _custom, () => setState(() {})),
      _Result([
        ('Brokerage', formatKes(brokerage), strong: false),
        ('CDS levy (0.12%)', formatKes(cds), strong: false),
        ('NSE levy (0.12%)', formatKes(nse), strong: false),
        ('CMA levy (0.06%)', formatKes(cma), strong: false),
        ('Total fees', formatKes(total), strong: true),
        (_buy ? 'You pay' : 'You receive', formatKes(net), strong: true),
      ], note: tv > 0 ? 'Effective cost: ${((total / tv) * 100).toStringAsFixed(2)}% of the trade.' : null),
    ]);
  }
}

// 2. Dividend yield and yield on cost.
class _Yield extends StatefulWidget {
  const _Yield();
  @override
  State<_Yield> createState() => _YieldState();
}

class _YieldState extends State<_Yield> {
  final _price = TextEditingController(), _dps = TextEditingController(), _shares = TextEditingController();
  @override
  void dispose() {
    for (final t in [_price, _dps, _shares]) {
      t.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = _n(_price), d = _n(_dps), s = _n(_shares);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _Field('Share price (KES)', _price, () => setState(() {})),
      _Field('Dividend per share per year (KES)', _dps, () => setState(() {})),
      _Field('Shares you own', _shares, () => setState(() {})),
      _Result([
        ('Dividend yield', p > 0 ? '${(d / p * 100).toStringAsFixed(2)}%' : '-', strong: true),
        ('Annual income', formatKes(d * s), strong: false),
        ('Capital invested', formatKes(p * s), strong: false),
      ], note: 'Yield on cost uses what you paid, not today\'s price, so it can differ from the quoted yield.'),
    ]);
  }
}

// 3. Compound growth with monthly contributions.
class _Compound extends StatefulWidget {
  const _Compound();
  @override
  State<_Compound> createState() => _CompoundState();
}

class _CompoundState extends State<_Compound> {
  final _init = TextEditingController(), _monthly = TextEditingController(), _ret = TextEditingController(text: '12'), _years = TextEditingController(text: '10');
  @override
  void dispose() {
    for (final t in [_init, _monthly, _ret, _years]) {
      t.dispose();
    }
    super.dispose();
  }

  double _fv(double p, double m, double r, double months) => (r > 0 ? p * math.pow(1 + r, months) + m * ((math.pow(1 + r, months) - 1) / r) : p + m * months).toDouble();

  @override
  Widget build(BuildContext context) {
    final p = _n(_init), m = _n(_monthly), r = _n(_ret) / 100 / 12, y = _n(_years);
    final total = _fv(p, m, r, y * 12);
    final put = p + m * y * 12;
    final marks = [1, 3, 5, 10, 15, 20].where((k) => k <= y).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _Field('Starting amount (KES)', _init, () => setState(() {})),
      _Field('Monthly contribution (KES)', _monthly, () => setState(() {})),
      _Field('Expected return per year (%)', _ret, () => setState(() {}), hint: '12'),
      _Field('Years', _years, () => setState(() {})),
      _Result([
        ('Future value', formatKes(total), strong: true),
        ('You put in', formatKes(put), strong: false),
        ('Growth', formatKes(total - put), strong: false),
        if (put > 0) ('Multiple of what you put in', '${(total / put).toStringAsFixed(2)}x', strong: false),
      ], note: 'A steady return is an assumption. Real returns rise and fall and are not guaranteed.'),
      if (marks.isNotEmpty) ...[
        const SizedBox(height: 14),
        const Eyebrow('Along the way'),
        const SizedBox(height: 6),
        for (final k in marks) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text('After $k ${k == 1 ? 'year' : 'years'}', style: AppText.bodySmall(context.c.textSecondary))), Text(formatKes(_fv(p, m, r, k * 12.0)), style: AppText.metric(context.c.textPrimary).copyWith(fontSize: 14))])),
      ],
    ]);
  }
}

// 4. Dollar-cost averaging against a lump sum.
class _Dca extends StatefulWidget {
  const _Dca();
  @override
  State<_Dca> createState() => _DcaState();
}

class _DcaState extends State<_Dca> {
  final _monthly = TextEditingController(), _months = TextEditingController(text: '12'), _now = TextEditingController(), _avg = TextEditingController();
  @override
  void dispose() {
    for (final t in [_monthly, _months, _now, _avg]) {
      t.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ma = _n(_monthly), mo = _n(_months), cp = _n(_now), abp = _n(_avg);
    final invested = ma * mo;
    final lumpShares = abp > 0 ? invested / abp : 0;
    final dcaAvg = abp > 0 && cp > 0 ? (abp + cp) / 2 : (abp > 0 ? abp : cp);
    final dcaShares = dcaAvg > 0 ? invested / dcaAvg : 0;
    final dcaValue = dcaShares * cp;
    final lumpValue = lumpShares * cp;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _Field('Amount invested each month (KES)', _monthly, () => setState(() {})),
      _Field('Months', _months, () => setState(() {})),
      _Field('Current share price (KES)', _now, () => setState(() {})),
      _Field('Average price you bought at (KES)', _avg, () => setState(() {})),
      _Result([
        ('Total invested', formatKes(invested), strong: false),
        ('Shares bought by DCA', dcaShares.toStringAsFixed(0), strong: false),
        ('Value today', formatKes(dcaValue), strong: true),
        ('Gain', invested > 0 ? '${formatKes(dcaValue - invested)} (${((dcaValue - invested) / invested * 100).toStringAsFixed(1)}%)' : '-', strong: false),
      ], note: cp > 0 && abp > 0 ? 'A lump sum at the start would be worth ${formatKes(lumpValue)} now. DCA ${dcaValue >= lumpValue ? 'did better' : 'did worse'} by ${formatKes((dcaValue - lumpValue).abs())}. This is a simplified estimate.' : 'DCA buys more shares when prices are low and fewer when they are high, which smooths your average cost.'),
    ]);
  }
}

// 5. How much to own to reach a monthly dividend income.
class _Income extends StatefulWidget {
  const _Income();
  @override
  State<_Income> createState() => _IncomeState();
}

class _IncomeState extends State<_Income> {
  final _target = TextEditingController(), _dps = TextEditingController(), _price = TextEditingController();
  int _freq = 0;
  static const _freqs = [(1, 'Annual'), (2, 'Semi-annual'), (4, 'Quarterly')];
  @override
  void dispose() {
    for (final t in [_target, _dps, _price]) {
      t.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final target = _n(_target), dps = _n(_dps), price = _n(_price);
    final freq = _freqs[_freq].$1;
    final shares = dps > 0 ? (target * 12 / dps).ceil() : 0;
    final capital = shares * price;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _Field('Monthly income you want (KES)', _target, () => setState(() {})),
      _Field('Dividend per share per year (KES)', _dps, () => setState(() {})),
      _Field('Share price (KES)', _price, () => setState(() {})),
      Wrap(spacing: 8, children: [for (var i = 0; i < _freqs.length; i++) ChoiceChip(label: Text(_freqs[i].$2), selected: _freq == i, onSelected: (_) => setState(() => _freq = i))]),
      const SizedBox(height: 12),
      _Result([
        ('Shares needed', formatInt(shares), strong: true),
        ('Capital needed', formatKes(capital), strong: true),
        ('Paid each ${_freqs[_freq].$2.toLowerCase() == 'annual' ? 'year' : 'payment'}', formatKes(shares * dps / freq), strong: false),
        ('Dividend yield', price > 0 && dps > 0 ? '${(dps / price * 100).toStringAsFixed(2)}%' : '-', strong: false),
      ], note: 'Assumes you buy at today\'s price and the dividend stays the same. Dividends can be cut.'),
    ]);
  }
}
