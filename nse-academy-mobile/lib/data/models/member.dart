/// Models for the member features: investor profile, portfolio journal, allocation, alerts, research and model
/// portfolios. They read the same API the website does. Parsing is forgiving: a missing or null field becomes a
/// sensible default rather than an exception, so one odd record never blanks a whole screen.
library;

import 'course.dart';

double _d(dynamic v, [double or = 0]) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? or : or);
double? _dn(dynamic v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
int _i(dynamic v, [int or = 0]) => v is num ? v.toInt() : (v is String ? int.tryParse(v) ?? or : or);
String _s(dynamic v, [String or = '']) => v is String ? v : (v == null ? or : v.toString());
String? _sn(dynamic v) => v is String && v.isNotEmpty ? v : null;
DateTime _t(dynamic v) => DateTime.tryParse(_s(v)) ?? DateTime.fromMillisecondsSinceEpoch(0);
DateTime? _tn(dynamic v) => v is String ? DateTime.tryParse(v) : null;
List<Map<String, dynamic>> _list(dynamic v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];
Map<String, dynamic> _map(dynamic v) => v is Map ? v.cast<String, dynamic>() : const {};

// ---- investor profile

class ProfilerQuestion {
  const ProfilerQuestion({required this.id, required this.text, required this.options});
  final int id;
  final String text;
  final List<String> options;

  factory ProfilerQuestion.fromJson(Map<String, dynamic> j) => ProfilerQuestion(
        id: _i(j['id']),
        text: _s(j['question'] ?? j['text']),
        options: _list(j['options']).map((o) => _s(o['label'] ?? o['text'])).toList(),
      );
}

/// The five investor types the quiz can produce.
enum InvestorKind {
  conservative('Conservative Investor', 'You protect your capital first. Steady, lower-risk NSE names and dividends suit you.'),
  dividend('Dividend Seeker', 'You want regular income. High-yield, established companies are your natural fit.'),
  moderate('Moderate Investor', 'You balance growth and safety, with a mix of blue chips and some growth.'),
  aggressive('Aggressive Investor', 'You accept larger swings for higher growth and look beyond the blue chips.'),
  growth('Growth Investor', 'You are chasing long-term capital growth and can ride out volatility.');

  const InvestorKind(this.label, this.blurb);
  final String label;
  final String blurb;

  static InvestorKind parse(String? s) => InvestorKind.values.firstWhere((k) => k.name == s, orElse: () => InvestorKind.moderate);
}

class InvestorProfile {
  const InvestorProfile({required this.type, required this.riskScore, required this.horizonYears, required this.capitalRange, this.isPublic = false, this.publicSlug});
  final InvestorKind type;
  final int riskScore;
  final int horizonYears;
  final String capitalRange;
  final bool isPublic;
  final String? publicSlug;

  factory InvestorProfile.fromJson(Map<String, dynamic> j) => InvestorProfile(
        type: InvestorKind.parse(_sn(j['type'])),
        riskScore: _i(j['riskScore']),
        horizonYears: _i(j['horizonYears'], 1),
        capitalRange: _s(j['capitalRange']),
        isPublic: j['isPublic'] == true,
        publicSlug: _sn(j['publicSlug']),
      );

  /// The five axes of the radar the website draws, 0 to 100.
  Map<String, double> get radar => {
        'Safety': (100 - riskScore).toDouble(),
        'Income': (80 - riskScore * 0.6).clamp(10, 100).toDouble(),
        'Growth': riskScore.toDouble(),
        'Liquidity': (50 + riskScore * 0.2).clamp(0, 100).toDouble(),
        'Experience': (riskScore * 0.9).toDouble(),
      };
}

// ---- stock picks and advice

class PickedStock {
  const PickedStock({required this.ticker, required this.name, required this.sector, required this.dividendYield, required this.risk});
  final String ticker;
  final String name;
  final String sector;
  final double? dividendYield;
  final String risk;

  factory PickedStock.fromJson(Map<String, dynamic> j) => PickedStock(
        ticker: _s(j['ticker']).toUpperCase(),
        name: _s(j['company_name']),
        sector: _s(j['sector']),
        dividendYield: _dn(j['dividend_yield']),
        risk: _s(j['risk_level'], 'medium'),
      );
}

class Recommendations {
  const Recommendations({this.type, required this.stocks, this.message});
  final InvestorKind? type;
  final List<PickedStock> stocks;
  final String? message;

  factory Recommendations.fromJson(dynamic json) {
    final j = _map(json);
    return Recommendations(
      type: _sn(j['investorType']) == null ? null : InvestorKind.parse(_sn(j['investorType'])),
      stocks: _list(j['stocks']).map(PickedStock.fromJson).where((p) => p.ticker.isNotEmpty).toList(),
      message: _sn(j['message']),
    );
  }
}

class TypeFit {
  const TypeFit({required this.kind, required this.rating, required this.reasons});
  final InvestorKind kind;
  final String rating; // excellent | good | neutral | caution
  final List<String> reasons;
}

class CompanyFit {
  const CompanyFit({required this.fits, this.verdict, this.reason, this.score});
  final List<TypeFit> fits;
  final String? verdict;
  final String? reason;
  final int? score;

  factory CompanyFit.fromJson(dynamic json) {
    final j = _map(json);
    final fit = j['userFit'] is Map ? _map(j['userFit']) : null;
    return CompanyFit(
      fits: _list(j['investorTypeAnalysis']).map((e) => TypeFit(kind: InvestorKind.parse(_sn(e['type'])), rating: _s(e['rating'], 'neutral'), reasons: (e['reasons'] is List ? (e['reasons'] as List).map((r) => r.toString()).toList() : <String>[]))).toList(),
      verdict: fit == null ? null : _sn(fit['verdict']),
      reason: fit == null ? null : _sn(fit['reason']),
      score: fit == null ? null : _i(fit['score']),
    );
  }
}

class Advice {
  const Advice({required this.recommendation, required this.situation, required this.rationale, required this.reasons, required this.risks, required this.outlook, required this.keyMetrics, required this.disclaimer, required this.aiGenerated, this.dataAsOf, this.note});
  final String recommendation;
  final String situation;
  final String rationale;
  final List<String> reasons;
  final List<String> risks;
  final String outlook;
  final List<String> keyMetrics;
  final String disclaimer;
  final bool aiGenerated;
  final String? dataAsOf;
  final String? note;

  factory Advice.fromJson(dynamic json) {
    final j = _map(json);
    List<String> strs(dynamic v) => v is List ? v.map((e) => e.toString()).toList() : const [];
    return Advice(
      recommendation: _s(j['recommendation'], 'HOLD'),
      situation: _s(j['situation']),
      rationale: _s(j['recommendationRationale']),
      reasons: strs(j['reasons']),
      risks: strs(j['risks']),
      outlook: _s(j['outlook']),
      keyMetrics: strs(j['keyMetrics']),
      disclaimer: _s(j['disclaimer'], 'Educational only. Not financial advice.'),
      aiGenerated: j['aiGenerated'] == true,
      dataAsOf: _sn(j['dataAsOf']),
      note: _sn(j['note']),
    );
  }
}

// ---- brokers, trades, holdings

class Broker {
  const Broker({required this.id, required this.name, required this.feePercent, required this.cdsRequired, this.cdaCode});
  final String id;
  final String name;
  final double feePercent;
  final bool cdsRequired;
  final String? cdaCode;

  factory Broker.fromJson(Map<String, dynamic> j) => Broker(id: _s(j['id']), name: _s(j['name']), feePercent: _d(j['feePercent']), cdsRequired: j['cdsRequired'] == true, cdaCode: _sn(j['cdaCode']));
}

List<Broker> parseBrokers(dynamic json) => _list(json).map(Broker.fromJson).where((b) => b.id.isNotEmpty).toList();

class Trade {
  const Trade({required this.id, required this.brokerId, required this.brokerName, required this.ticker, required this.isBuy, required this.quantity, required this.price, required this.fees, required this.total, required this.date, this.notes, this.imported = false});
  final String id;
  final String brokerId;
  final String brokerName;
  final String ticker;
  final bool isBuy;
  final int quantity;
  final double price;
  final double fees;
  final double total;
  final DateTime date;
  final String? notes;
  final bool imported;

  factory Trade.fromJson(Map<String, dynamic> j) => Trade(
        id: _s(j['id']),
        brokerId: _s(j['brokerId']),
        brokerName: _s(_map(j['broker'])['name']),
        ticker: _s(j['ticker']).toUpperCase(),
        isBuy: _s(j['side']).toUpperCase() != 'SELL',
        quantity: _i(j['quantity']),
        price: _d(j['pricePerShare']),
        fees: _d(j['feesKes']),
        total: _d(j['totalKes']),
        date: _t(j['tradeDate']),
        notes: _sn(j['notes']),
        imported: _s(j['source']) == 'CDSC_IMPORT',
      );
}

class TradePage {
  const TradePage(this.trades, this.total);
  final List<Trade> trades;
  final int total;
  factory TradePage.fromJson(dynamic json) {
    final j = _map(json);
    final list = _list(j['data']).map(Trade.fromJson).toList();
    return TradePage(list, _i(j['total'], list.length));
  }
}

class Position {
  const Position({required this.ticker, required this.name, required this.quantity, this.avgCost, this.costEstimated = false, this.costBasis, this.price, this.value, this.gain, this.holdingId, this.brokerName});
  final String ticker;
  final String? name;
  final int quantity;
  final double? avgCost;
  final bool costEstimated;
  final double? costBasis;
  final double? price;
  final double? value;
  final double? gain;
  final String? holdingId;
  final String? brokerName;

  double? get gainPct => (gain != null && costBasis != null && costBasis! > 0) ? gain! / costBasis! * 100 : null;
}

class Portfolio {
  const Portfolio({required this.positions, required this.byBroker, required this.cost, required this.value, required this.gain});
  final List<Position> positions;
  final List<Position> byBroker;
  final double cost;
  final double value;
  final double gain;

  double? get gainPct => cost > 0 ? gain / cost * 100 : null;
  bool get isEmpty => positions.isEmpty;

  factory Portfolio.fromJson(dynamic json) {
    final j = _map(json);
    return Portfolio(
      positions: _list(j['consolidated'])
          .map((p) => Position(ticker: _s(p['ticker']).toUpperCase(), name: _sn(p['companyName']), quantity: _i(p['quantity']), avgCost: _dn(p['avgCost']), costEstimated: p['costEstimated'] == true, costBasis: _dn(p['costBasisKes']), price: _dn(p['currentPrice']), value: _dn(p['marketValueKes']), gain: _dn(p['unrealizedGainKes'])))
          .toList(),
      byBroker: _list(j['positions'])
          .map((p) => Position(ticker: _s(p['ticker']).toUpperCase(), name: _sn(p['companyName']), quantity: _i(p['quantity']), avgCost: _dn(p['avgCost']), costEstimated: _s(p['costSource']) == 'IMPORT_PRICE', costBasis: _dn(p['costBasisKes']), price: _dn(p['currentPrice']), value: _dn(p['marketValueKes']), gain: _dn(p['unrealizedGainKes']), holdingId: _sn(p['id']), brokerName: _sn(_map(p['broker'])['name'])))
          .toList(),
      cost: _d(j['totalCostBasisKes']),
      value: _d(j['totalMarketValueKes']),
      gain: _d(j['totalUnrealizedGainKes']),
    );
  }
}

class RealizedByTicker {
  const RealizedByTicker({required this.ticker, required this.gain, required this.proceeds, required this.cost, required this.trades});
  final String ticker;
  final double gain;
  final double proceeds;
  final double cost;
  final int trades;
}

class RealizedGains {
  const RealizedGains({required this.total, required this.byTicker});
  final double total;
  final List<RealizedByTicker> byTicker;
  factory RealizedGains.fromJson(dynamic json) {
    final j = _map(json);
    return RealizedGains(
      total: _d(j['totalRealizedGainKes']),
      byTicker: _list(j['byTicker']).map((r) => RealizedByTicker(ticker: _s(r['ticker']).toUpperCase(), gain: _d(r['realizedGainKes']), proceeds: _d(r['proceedsKes']), cost: _d(r['costBasisKes']), trades: _i(r['tradeCount']))).toList(),
    );
  }
}

class Dividend {
  const Dividend({required this.id, required this.brokerId, required this.brokerName, required this.ticker, required this.amount, required this.date, this.notes});
  final String id;
  final String brokerId;
  final String brokerName;
  final String ticker;
  final double amount;
  final DateTime date;
  final String? notes;
  factory Dividend.fromJson(Map<String, dynamic> j) => Dividend(id: _s(j['id']), brokerId: _s(j['brokerId']), brokerName: _s(_map(j['broker'])['name']), ticker: _s(j['ticker']).toUpperCase(), amount: _d(j['amountKes']), date: _t(j['paymentDate']), notes: _sn(j['notes']));
}

List<Dividend> parseDividends(dynamic json) => _list(json).map(Dividend.fromJson).toList();

class YieldOnCost {
  const YieldOnCost({required this.ticker, required this.annual, required this.cost, required this.pct});
  final String ticker;
  final double annual;
  final double cost;
  final double pct;
}

List<YieldOnCost> parseYieldOnCost(dynamic json) => _list(json).map((j) => YieldOnCost(ticker: _s(j['ticker']).toUpperCase(), annual: _d(j['annualDividendsKes']), cost: _d(j['costBasisKes']), pct: _d(j['yieldOnCostPct']))).toList();

// ---- allocation and rebalancing

class AllocationRow {
  const AllocationRow({required this.ticker, required this.sector, required this.quantity, required this.price, required this.value, required this.weight});
  final String ticker;
  final String? sector;
  final int quantity;
  final double price;
  final double value;
  final double weight;
}

class SectorRow {
  const SectorRow({required this.sector, required this.value, required this.weight, required this.tickers});
  final String sector;
  final double value;
  final double weight;
  final List<String> tickers;
}

class TargetWeight {
  const TargetWeight(this.ticker, this.weightPct);
  final String ticker;
  final double weightPct;
  Map<String, dynamic> toJson() => {'ticker': ticker, 'weightPct': weightPct};
}

class Allocation {
  const Allocation({required this.value, required this.rows, required this.sectors, required this.unpriced, required this.notes, required this.targets});
  final double value;
  final List<AllocationRow> rows;
  final List<SectorRow> sectors;
  final List<String> unpriced;
  final List<String> notes;
  final List<TargetWeight> targets;

  factory Allocation.fromJson(dynamic json) {
    final j = _map(json);
    return Allocation(
      value: _d(j['valueKes']),
      rows: _list(j['rows']).map((r) => AllocationRow(ticker: _s(r['ticker']).toUpperCase(), sector: _sn(r['sector']), quantity: _i(r['quantity']), price: _d(r['price']), value: _d(r['valueKes']), weight: _d(r['weightPct']))).toList(),
      sectors: _list(j['sectors']).map((r) => SectorRow(sector: _s(r['sector'], 'Other'), value: _d(r['valueKes']), weight: _d(r['weightPct']), tickers: r['tickers'] is List ? (r['tickers'] as List).map((e) => e.toString()).toList() : const [])).toList(),
      unpriced: j['unpriced'] is List ? (j['unpriced'] as List).map((e) => e.toString()).toList() : const [],
      notes: j['notes'] is List ? (j['notes'] as List).map((e) => e.toString()).toList() : const [],
      targets: parseTargets(j['targets']),
    );
  }
}

List<TargetWeight> parseTargets(dynamic json) => _list(json).map((t) => TargetWeight(_s(t['ticker']).toUpperCase(), _d(t['weightPct']))).toList();

class DriftRow {
  const DriftRow({required this.ticker, required this.current, required this.target, required this.drift, required this.value});
  final String ticker;
  final double current;
  final double target;
  final double drift;
  final double value;
}

class RebalanceTrade {
  const RebalanceTrade({required this.ticker, required this.isBuy, required this.shares, required this.price, required this.value, this.fee, this.broker});
  final String ticker;
  final bool isBuy;
  final int shares;
  final double price;
  final double value;
  final double? fee;
  final String? broker;
}

class RebalancePlan {
  const RebalancePlan({required this.base, required this.drift, required this.trades, required this.netCash, required this.totalFees, required this.warnings});
  final double base;
  final List<DriftRow> drift;
  final List<RebalanceTrade> trades;
  final double netCash;
  final double totalFees;
  final List<String> warnings;

  factory RebalancePlan.fromJson(dynamic json) {
    final j = _map(json);
    return RebalancePlan(
      base: _d(j['baseKes']),
      drift: _list(j['drift']).map((r) => DriftRow(ticker: _s(r['ticker']).toUpperCase(), current: _d(r['currentPct']), target: _d(r['targetPct']), drift: _d(r['driftPct']), value: _d(r['valueKes']))).toList(),
      trades: _list(j['trades']).map((r) => RebalanceTrade(ticker: _s(r['ticker']).toUpperCase(), isBuy: _s(r['action']).toUpperCase() != 'SELL', shares: _i(r['shares']), price: _d(r['priceKes']), value: _d(r['valueKes']), fee: _dn(r['feeKes']), broker: _sn(r['brokerName']))).toList(),
      netCash: _d(j['netCashKes']),
      totalFees: _d(j['totalFeesKes']),
      warnings: j['warnings'] is List ? (j['warnings'] as List).map((e) => e.toString()).toList() : const [],
    );
  }
}

// ---- model portfolios

class ModelHolding {
  const ModelHolding({required this.ticker, required this.weight, this.rationale});
  final String ticker;
  final double weight;
  final String? rationale;
}

class ModelPortfolio {
  const ModelPortfolio({required this.slug, required this.name, required this.summary, required this.description, required this.holdings, this.risk, this.sincePct, this.last30Pct});
  final String slug;
  final String name;
  final String summary;
  final String description;
  final String? risk;
  final List<ModelHolding> holdings;
  final double? sincePct;
  final double? last30Pct;

  factory ModelPortfolio.fromJson(Map<String, dynamic> j) {
    final perf = j['performance'] is Map ? _map(j['performance']) : null;
    return ModelPortfolio(
      slug: _s(j['slug']),
      name: _s(j['name']),
      summary: _s(j['summary']),
      description: _s(j['description']),
      risk: _sn(j['riskProfile']),
      holdings: _list(j['holdings']).map((h) => ModelHolding(ticker: _s(h['ticker']).toUpperCase(), weight: _d(h['weightPct']), rationale: _sn(h['rationale']))).toList(),
      sincePct: perf == null ? null : _dn(perf['sincePct']),
      last30Pct: perf == null ? null : _dn(perf['last30Pct']),
    );
  }
}

class ModelList {
  const ModelList(this.note, this.models);
  final String note;
  final List<ModelPortfolio> models;
  factory ModelList.fromJson(dynamic json) {
    final j = _map(json);
    return ModelList(_s(j['note']), _list(j['data']).map(ModelPortfolio.fromJson).toList());
  }
}

class ModelDetail {
  const ModelDetail(this.note, this.model);
  final String note;
  final ModelPortfolio model;
  factory ModelDetail.fromJson(dynamic json) {
    final j = _map(json);
    return ModelDetail(_s(j['note']), ModelPortfolio.fromJson(_map(j['model'])));
  }
}

class ModelCompareRow {
  const ModelCompareRow({required this.ticker, required this.model, required this.yours, required this.diff});
  final String ticker;
  final double model;
  final double yours;
  final double diff;
}

class ModelComparison {
  const ModelComparison({required this.hasHoldings, required this.overlap, required this.rows, required this.notInModel});
  final bool hasHoldings;
  final double overlap;
  final List<ModelCompareRow> rows;
  final List<TargetWeight> notInModel;
  factory ModelComparison.fromJson(dynamic json) {
    final j = _map(json);
    return ModelComparison(
      hasHoldings: j['hasHoldings'] == true,
      overlap: _d(j['overlapPct']),
      rows: _list(j['rows']).map((r) => ModelCompareRow(ticker: _s(r['ticker']).toUpperCase(), model: _d(r['modelPct']), yours: _d(r['yourPct']), diff: _d(r['diffPct']))).toList(),
      notInModel: _list(j['notInModel']).map((r) => TargetWeight(_s(r['ticker']).toUpperCase(), _d(r['weightPct']))).toList(),
    );
  }
}

// ---- research

class ResearchSummary {
  const ResearchSummary({required this.slug, required this.title, required this.summary, required this.isBrief, required this.tickers, this.period, this.publishedAt});
  final String slug;
  final String title;
  final String summary;
  final bool isBrief;
  final List<String> tickers;
  final String? period;
  final DateTime? publishedAt;

  factory ResearchSummary.fromJson(Map<String, dynamic> j) => ResearchSummary(
        slug: _s(j['slug']),
        title: _s(j['title']),
        summary: _s(j['summary']),
        isBrief: _s(j['kind']) == 'BRIEF',
        tickers: j['tickers'] is List ? (j['tickers'] as List).map((e) => e.toString()).toList() : const [],
        period: _sn(j['period']),
        publishedAt: _tn(j['publishedAt']),
      );
}

List<ResearchSummary> parseResearchList(dynamic json) => _list(json).map(ResearchSummary.fromJson).where((r) => r.slug.isNotEmpty).toList();

class ResearchNote {
  const ResearchNote({required this.summary, required this.body});
  final ResearchSummary summary;
  final String body;
  factory ResearchNote.fromJson(dynamic json) {
    final j = _map(json);
    return ResearchNote(summary: ResearchSummary.fromJson(j), body: _s(j['body']));
  }
}

// ---- alerts and notifications

class PriceAlert {
  const PriceAlert({required this.id, required this.ticker, required this.target, required this.above, required this.status, this.triggeredAt});
  final String id;
  final String ticker;
  final double target;
  final bool above;
  final String status; // pending | triggered | cancelled
  final DateTime? triggeredAt;
  factory PriceAlert.fromJson(Map<String, dynamic> j) => PriceAlert(id: _s(j['id']), ticker: _s(j['ticker']).toUpperCase(), target: _d(j['targetPrice']), above: _s(j['direction']).toUpperCase() != 'BELOW', status: _s(j['status'], 'pending'), triggeredAt: _tn(j['triggeredAt']));
}

List<PriceAlert> parseAlerts(dynamic json) => _list(json).map(PriceAlert.fromJson).toList();

class AppNotification {
  const AppNotification({required this.id, required this.title, required this.body, required this.read, required this.at});
  final String id;
  final String title;
  final String body;
  final bool read;
  final DateTime at;
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(id: _s(j['id']), title: _s(j['title']), body: _s(j['body']), read: j['read'] == true, at: _t(j['createdAt']));
}

List<AppNotification> parseNotifications(dynamic json) => _list(json).map(AppNotification.fromJson).toList();

// ---- portfolio watch, referrals, account

class WatchItem {
  const WatchItem({required this.kind, required this.ticker, required this.text});
  final String kind;
  final String ticker;
  final String text;
}

class PortfolioWatch {
  const PortfolioWatch({required this.enabled, required this.items, this.value, this.dayChange, this.dayChangePct, this.asOf});
  final bool enabled;
  final List<WatchItem> items;
  final double? value;
  final double? dayChange;
  final double? dayChangePct;
  final String? asOf;

  factory PortfolioWatch.fromJson(dynamic json) {
    final j = _map(json);
    final r = j['result'] is Map ? _map(j['result']) : null;
    return PortfolioWatch(
      enabled: j['enabled'] == true,
      items: _list(j['fresh']).map((w) => WatchItem(kind: _s(w['kind']), ticker: _s(w['ticker']).toUpperCase(), text: _s(w['text']))).toList(),
      value: r == null ? null : _dn(r['valueKes']),
      dayChange: r == null ? null : _dn(r['dayChangeKes']),
      dayChangePct: r == null ? null : _dn(r['dayChangePct']),
      asOf: r == null ? null : _sn(r['asOf']),
    );
  }
}

class ReferralStats {
  const ReferralStats({required this.code, required this.total, required this.completed, required this.freeMonths});
  final String code;
  final int total;
  final int completed;
  final int freeMonths;
  factory ReferralStats.fromJson(dynamic json) {
    final j = _map(json);
    return ReferralStats(code: _s(j['referralCode']), total: _i(j['totalReferrals']), completed: _i(j['completedReferrals']), freeMonths: _i(j['freeMonthsEarned']));
  }
}

class Account {
  const Account({required this.name, required this.email, this.phone, this.profile, this.tier = 'free', this.renews});
  final String name;
  final String email;
  final String? phone;
  final InvestorProfile? profile;
  final String tier;
  final DateTime? renews;

  factory Account.fromJson(dynamic json) {
    final j = _map(json);
    final sub = j['subscription'] is Map ? _map(j['subscription']) : null;
    return Account(
      name: _s(j['name']),
      email: _s(j['email']),
      phone: _sn(j['phone']),
      profile: j['investorProfile'] is Map ? InvestorProfile.fromJson(_map(j['investorProfile'])) : null,
      tier: _s(j['effectiveTier'] ?? sub?['tier'], 'free'),
      renews: sub == null ? null : _tn(sub['currentPeriodEnd']),
    );
  }
}


/// What the server knows about the member's plan: the tier they get (including a firm's licence), and where a paid
/// period came from, so the app never offers to buy on top of time already paid for elsewhere.
class PlanStatus {
  const PlanStatus({required this.effective, required this.paidTier, required this.live, this.source = 'paystack', this.periodEnd});
  final Tier effective;

  /// The tier of the member's own paid subscription (Free when none or ended).
  final Tier paidTier;

  /// Whether that subscription is active and has not run out.
  final bool live;
  final String source;
  final DateTime? periodEnd;

  bool get viaPlay => live && source == 'play';

  /// Paid and live, but not through Google Play: the website owns it.
  bool get viaWeb => live && source != 'play';

  /// Premium that comes from a firm's licence rather than the member's own subscription.
  bool get viaOrganisation => effective != Tier.free && !live;

  factory PlanStatus.fromJson(dynamic json, {DateTime? now}) {
    final j = _map(json);
    final end = _tn(j['currentPeriodEnd']);
    final paid = Tier.parse(_sn(j['tier']));
    final live = _s(j['status']) == 'active' && paid != Tier.free && end != null && end.isAfter(now ?? DateTime.now());
    return PlanStatus(effective: Tier.parse(_sn(j['effectiveTier']) ?? _sn(j['tier'])), paidTier: live ? paid : Tier.free, live: live, source: _s(j['source'], 'paystack'), periodEnd: end);
  }
}

// ---- financial advisers

class Adviser {
  const Adviser({required this.id, required this.name, required this.headline, required this.bio, this.specialties = const [], this.credentials, this.photoUrl});
  final String id;
  final String name;
  final String headline;
  final String bio;
  final List<String> specialties;
  final String? credentials;
  final String? photoUrl;

  /// "Jane Doe" -> "JD", for the avatar.
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
  }

  factory Adviser.fromJson(dynamic json) {
    final j = _map(json);
    return Adviser(
      id: _s(j['id']),
      name: _s(_map(j['user'])['name'], 'Adviser'),
      headline: _s(j['headline']),
      bio: _s(j['bio']),
      specialties: j['specialties'] is List ? [for (final x in j['specialties'] as List) if (x is String && x.isNotEmpty) x] : const [],
      credentials: _sn(j['credentials']),
      photoUrl: _sn(j['photoUrl']),
    );
  }
}

class AdviserPage {
  const AdviserPage({required this.data, required this.page, required this.totalPages});
  final List<Adviser> data;
  final int page;
  final int totalPages;
  bool get hasMore => page < totalPages;
  factory AdviserPage.fromJson(dynamic json) {
    final j = _map(json);
    return AdviserPage(data: _list(j['data']).map(Adviser.fromJson).toList(), page: _i(j['page'], 1), totalPages: _i(j['totalPages'], 1));
  }
}

enum ConnectionStatus {
  pending,
  accepted,
  declined;

  static ConnectionStatus parse(String? s) => switch (s) { 'accepted' => accepted, 'declined' => declined, _ => pending };
}

/// The member's link to an adviser: asked, accepted or declined.
class AdviserConnection {
  const AdviserConnection({required this.id, required this.status, required this.adviser, this.viaFirm = false});
  final String id;
  final ConnectionStatus status;
  final Adviser adviser;

  /// Joined through a firm (a SACCO or company plan): the firm pays, so questions are not rationed.
  final bool viaFirm;
  factory AdviserConnection.fromJson(dynamic json) {
    final j = _map(json);
    return AdviserConnection(id: _s(j['id']), status: ConnectionStatus.parse(_sn(j['status'])), adviser: Adviser.fromJson(j['advisor']), viaFirm: _s(j['source']) == 'org_member');
  }
}

/// How many questions the member may still put to advisers this month.
class QuestionAllowance {
  const QuestionAllowance({required this.tier, required this.limit, required this.used, this.remaining, this.unlimited = false, this.resetsOn});
  final String tier;
  final int limit;
  final int used;

  /// Null when unlimited.
  final int? remaining;
  final bool unlimited;
  final DateTime? resetsOn;
  bool get exhausted => !unlimited && (remaining ?? 0) <= 0;
  factory QuestionAllowance.fromJson(dynamic json) {
    final j = _map(json);
    final unlimited = j['unlimited'] == true;
    return QuestionAllowance(tier: _s(j['tier'], 'free'), limit: _i(j['limit']), used: _i(j['used']), remaining: unlimited || j['remaining'] == null ? null : _i(j['remaining']), unlimited: unlimited, resetsOn: _tn(j['resetsOn']));
  }
}

class AdviserQuestion {
  const AdviserQuestion({required this.id, required this.subject, required this.answered, required this.withName, required this.updated, this.messages = 0});
  final String id;
  final String subject;

  /// The adviser has replied last (otherwise the member, or the adviser, is waiting on the other).
  final bool answered;

  /// The other party: the adviser for a member, the client for an adviser.
  final String withName;
  final DateTime updated;
  final int messages;
  factory AdviserQuestion.fromJson(dynamic json, {bool asAdviser = false}) {
    final j = _map(json);
    final other = asAdviser ? _map(j['user']) : _map(_map(j['advisor'])['user']);
    return AdviserQuestion(id: _s(j['id']), subject: _s(j['subject']), answered: _s(j['status']) == 'answered', withName: _s(other['name'], asAdviser ? 'Client' : 'Adviser'), updated: _t(j['updatedAt'] ?? j['createdAt']), messages: _i(_map(j['_count'])['messages']));
  }
}

class ThreadMessage {
  const ThreadMessage({required this.id, required this.fromAdviser, required this.body, required this.at});
  final String id;
  final bool fromAdviser;
  final String body;
  final DateTime at;
}

class QuestionThread {
  const QuestionThread({required this.id, required this.subject, required this.adviserName, required this.clientName, required this.messages});
  final String id;
  final String subject;
  final String adviserName;
  final String clientName;
  final List<ThreadMessage> messages;
  factory QuestionThread.fromJson(dynamic json) {
    final j = _map(json);
    return QuestionThread(
      id: _s(j['id']),
      subject: _s(j['subject']),
      adviserName: _s(_map(_map(j['advisor'])['user'])['name'], 'Adviser'),
      clientName: _s(_map(j['user'])['name'], 'Client'),
      messages: [for (final m in _list(j['messages'])) ThreadMessage(id: _s(m['id']), fromAdviser: _s(m['senderRole']) == 'advisor', body: _s(m['body']), at: _t(m['createdAt']))],
    );
  }
}

class AdviserInsight {
  const AdviserInsight({required this.id, required this.title, required this.body, required this.tickers, required this.adviserName, required this.at});
  final String id;
  final String title;
  final String body;
  final List<String> tickers;
  final String adviserName;
  final DateTime at;
  factory AdviserInsight.fromJson(dynamic json) {
    final j = _map(json);
    return AdviserInsight(
      id: _s(j['id']),
      title: _s(j['title']),
      body: _s(j['body']),
      tickers: j['tickers'] is List ? [for (final x in j['tickers'] as List) if (x is String) x] : const [],
      adviserName: _s(_map(_map(j['advisor'])['user'])['name']),
      at: _t(j['createdAt']),
    );
  }
}

/// The signed-in member's own adviser profile, if they are an adviser.
class AdviserSelf {
  const AdviserSelf({required this.id, required this.headline, required this.approval, required this.active});
  final String id;
  final String headline;

  /// pending | approved | suspended
  final String approval;
  final bool active;
  bool get approved => approval == 'approved' && active;
  static AdviserSelf? fromJson(dynamic json) {
    if (json is! Map) return null;
    final j = _map(json);
    if (_s(j['id']).isEmpty) return null;
    return AdviserSelf(id: _s(j['id']), headline: _s(j['headline']), approval: _s(j['approvalStatus'], 'pending'), active: j['isActive'] != false);
  }
}

/// A person who asked to connect to the member as their adviser.
class ClientRequest {
  const ClientRequest({required this.id, required this.name, required this.status, required this.at});
  final String id;
  final String name;
  final ConnectionStatus status;
  final DateTime at;
  factory ClientRequest.fromJson(dynamic json) {
    final j = _map(json);
    return ClientRequest(id: _s(j['id']), name: _s(_map(j['user'])['name'], 'Client'), status: ConnectionStatus.parse(_sn(j['status'])), at: _t(j['requestedAt']));
  }
}

// ---- organisation (corporate seats)

class OrgLicense {
  const OrgLicense({required this.tier, required this.seats, required this.seatsUsed, required this.active, this.periodEnd});
  final Tier tier;
  final int seats;
  final int seatsUsed;

  /// Status is active and the period has not run out.
  final bool active;
  final DateTime? periodEnd;
  int get seatsFree => (seats - seatsUsed).clamp(0, seats);
  static OrgLicense? fromJson(dynamic json, {DateTime? now}) {
    if (json is! Map) return null;
    final j = _map(json);
    final end = _tn(j['currentPeriodEnd']);
    return OrgLicense(tier: Tier.parse(_sn(j['tier'])), seats: _i(j['seats']), seatsUsed: _i(j['seatsUsed']), active: _s(j['status']) == 'active' && end != null && end.isAfter(now ?? DateTime.now()), periodEnd: end);
  }
}

/// The member's place in an organisation: an invitation waiting to be accepted, or a seat they hold.
class OrgMembership {
  const OrgMembership({required this.orgName, required this.role, required this.accepted, this.inviteToken, this.license});
  final String orgName;
  final String role;
  final bool accepted;
  final String? inviteToken;
  final OrgLicense? license;
  bool get isAdmin => role == 'admin' && accepted;
  bool get invited => !accepted && inviteToken != null;
  static OrgMembership? fromJson(dynamic json) {
    if (json is! Map) return null;
    final j = _map(json);
    final org = _map(j['org']);
    return OrgMembership(orgName: _s(org['name'], 'Your organisation'), role: _s(j['role'], 'member'), accepted: j['inviteAccepted'] == true, inviteToken: _sn(j['inviteToken']), license: OrgLicense.fromJson(org['license']));
  }
}

class OrgPerson {
  const OrgPerson({required this.id, required this.name, required this.email, required this.admin, required this.accepted});
  final String id;
  final String name;
  final String email;
  final bool admin;
  final bool accepted;
}

class OrgDashboard {
  const OrgDashboard({required this.name, required this.license, required this.people});
  final String name;
  final OrgLicense? license;
  final List<OrgPerson> people;
  factory OrgDashboard.fromJson(dynamic json) {
    final j = _map(json);
    return OrgDashboard(
      name: _s(j['name'], 'Your organisation'),
      license: OrgLicense.fromJson(j['license']),
      people: [for (final m in _list(j['members'])) OrgPerson(id: _s(m['id']), name: _s(_map(m['user'])['name'], 'Member'), email: _s(_map(m['user'])['email']), admin: _s(m['role']) == 'admin', accepted: m['inviteAccepted'] == true)],
    );
  }
}
