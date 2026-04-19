"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-KE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ksh(n: number) {
  if (!isFinite(n)) return "—";
  return `KSh ${fmt(n)}`;
}

function pct(n: number) {
  if (!isFinite(n)) return "—";
  return `${fmt(n)}%`;
}

function num(s: string) {
  const v = parseFloat(s.replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}

// ---------------------------------------------------------------------------
// Sub-components: shared UI
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  prefix,
  suffix,
  placeholder = "0",
  min = "0",
  step = "any",
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors bg-white">
      {prefix && (
        <span className="px-3 text-sm text-gray-400 border-r border-gray-200 bg-gray-50 h-full flex items-center py-3">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
      />
      {suffix && (
        <span className="px-3 text-sm text-gray-400 border-l border-gray-200 bg-gray-50 flex items-center py-3">
          {suffix}
        </span>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-3 border-b border-gray-50 last:border-0 ${highlight ? "mt-2 pt-4 border-t-2 border-emerald-100" : ""}`}>
      <span className={`text-sm ${highlight ? "font-bold text-gray-900" : "text-gray-500"}`}>{label}</span>
      <span className={`font-bold tabular-nums ${highlight ? "text-xl text-emerald-700" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Results</p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Broker Fee Estimator
// ---------------------------------------------------------------------------

const BROKER_RATES = [
  { label: "Standard (1.8%)", value: 1.8 },
  { label: "Faida / SIB (2.1%)", value: 2.1 },
  { label: "Custom", value: 0 },
];

function BrokerFeeCalc() {
  const [tradeValue, setTradeValue] = useState("");
  const [rateIdx, setRateIdx] = useState(0);
  const [customRate, setCustomRate] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const tv = num(tradeValue);
  const brokerRate = rateIdx < BROKER_RATES.length - 1 ? BROKER_RATES[rateIdx].value : num(customRate);
  const brokerage = tv * (brokerRate / 100);
  const cds = tv * 0.0012;
  const nseLev = tv * 0.0012;
  const cmaLev = tv * 0.0006;
  const total = brokerage + cds + nseLev + cmaLev;
  const netPay = side === "buy" ? tv + total : tv - total;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <Field label="Trade Value" hint="total value of shares bought or sold">
          <Input value={tradeValue} onChange={setTradeValue} prefix="KSh" placeholder="50,000" />
        </Field>

        <Field label="Side">
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  side === s ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "buy" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Broker Commission Rate">
          <div className="space-y-2">
            {BROKER_RATES.map((r, i) => (
              <label key={r.label} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={rateIdx === i}
                  onChange={() => setRateIdx(i)}
                  className="accent-emerald-600"
                />
                <span className="text-sm text-gray-700">{r.label}</span>
              </label>
            ))}
          </div>
          {rateIdx === BROKER_RATES.length - 1 && (
            <div className="mt-2">
              <Input value={customRate} onChange={setCustomRate} suffix="%" placeholder="1.8" />
            </div>
          )}
        </Field>
      </div>

      <ResultCard>
        <ResultRow label="Brokerage Commission" value={ksh(brokerage)} />
        <ResultRow label="CDS Fee (0.12%)" value={ksh(cds)} />
        <ResultRow label="NSE Levy (0.12%)" value={ksh(nseLev)} />
        <ResultRow label="CMA Levy (0.06%)" value={ksh(cmaLev)} />
        <ResultRow label="Total Transaction Costs" value={ksh(total)} highlight />
        <ResultRow label={side === "buy" ? "Total you pay" : "Net proceeds"} value={ksh(netPay)} highlight />
        <p className="text-xs text-gray-400 mt-4">
          Effective cost rate: {tv > 0 ? pct((total / tv) * 100) : "—"}
        </p>
      </ResultCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Dividend Yield Calculator
// ---------------------------------------------------------------------------

function DividendYieldCalc() {
  const [sharePrice, setSharePrice] = useState("");
  const [dividendPerShare, setDividendPerShare] = useState("");
  const [shares, setShares] = useState("");

  const sp = num(sharePrice);
  const dps = num(dividendPerShare);
  const sh = num(shares);
  const yld = sp > 0 ? (dps / sp) * 100 : 0;
  const annualIncome = dps * sh;
  const investedCapital = sp * sh;
  const yieldOnCost = investedCapital > 0 ? (annualIncome / investedCapital) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <Field label="Current Share Price" hint="today's market price">
          <Input value={sharePrice} onChange={setSharePrice} prefix="KSh" placeholder="40.00" step="0.01" />
        </Field>
        <Field label="Annual Dividend per Share" hint="last declared annual DPS">
          <Input value={dividendPerShare} onChange={setDividendPerShare} prefix="KSh" placeholder="2.00" step="0.01" />
        </Field>
        <Field label="Number of Shares" hint="how many shares you own or plan to buy">
          <Input value={shares} onChange={setShares} placeholder="1,000" step="1" />
        </Field>
      </div>

      <ResultCard>
        <ResultRow label="Dividend Yield" value={pct(yld)} highlight />
        <ResultRow label="Annual Dividend Income" value={ksh(annualIncome)} />
        <ResultRow label="Monthly Dividend Income" value={ksh(annualIncome / 12)} />
        <ResultRow label="Capital Required" value={ksh(investedCapital)} />
        <ResultRow label="Yield on Cost" value={pct(yieldOnCost)} />
        <p className="text-xs text-gray-400 mt-4">
          NSE average yield: ~4–6%. Above 7% is considered high yield.
        </p>
      </ResultCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Compound Growth Calculator (Wealth Builder)
// ---------------------------------------------------------------------------

function CompoundGrowthCalc() {
  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [annualReturn, setAnnualReturn] = useState("12");
  const [years, setYears] = useState("10");

  const P = num(initial);
  const m = num(monthly);
  const r = num(annualReturn) / 100 / 12;
  const n = num(years) * 12;

  const futureValueLump = r > 0 ? P * Math.pow(1 + r, n) : P;
  const futureValueMonthly = r > 0 ? m * ((Math.pow(1 + r, n) - 1) / r) : m * n;
  const totalFutureValue = futureValueLump + futureValueMonthly;
  const totalContributed = P + m * n;
  const totalGrowth = totalFutureValue - totalContributed;
  const growthMultiple = totalContributed > 0 ? totalFutureValue / totalContributed : 0;

  // Milestones
  const milestones = [1, 3, 5, 10, 15, 20].filter((y) => y <= num(years)).map((y) => {
    const ni = y * 12;
    const fvl = r > 0 ? P * Math.pow(1 + r, ni) : P;
    const fvm = r > 0 ? m * ((Math.pow(1 + r, ni) - 1) / r) : m * ni;
    return { year: y, value: fvl + fvm };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <Field label="Initial Investment">
          <Input value={initial} onChange={setInitial} prefix="KSh" placeholder="100,000" />
        </Field>
        <Field label="Monthly Contribution" hint="optional">
          <Input value={monthly} onChange={setMonthly} prefix="KSh" placeholder="5,000" />
        </Field>
        <Field label="Expected Annual Return">
          <Input value={annualReturn} onChange={setAnnualReturn} suffix="%" placeholder="12" step="0.5" />
        </Field>
        <Field label="Time Horizon">
          <Input value={years} onChange={setYears} suffix="years" placeholder="10" min="1" step="1" />
        </Field>
        <p className="text-xs text-gray-400">
          NSE 10-year historical average: ~12–15%/yr. 2025 return was 52%.
        </p>
      </div>

      <div className="space-y-4">
        <ResultCard>
          <ResultRow label="Total Contributed" value={ksh(totalContributed)} />
          <ResultRow label="Investment Growth" value={ksh(totalGrowth)} />
          <ResultRow label="Portfolio Value" value={ksh(totalFutureValue)} highlight />
          <ResultRow label="Growth Multiple" value={`${fmt(growthMultiple)}×`} highlight />
        </ResultCard>

        {milestones.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Year-by-Year Milestones</p>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.year} className="flex justify-between text-sm">
                  <span className="text-gray-500">Year {m.year}</span>
                  <span className="font-semibold text-gray-900">{ksh(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. DCA Calculator
// ---------------------------------------------------------------------------

function DCACalc() {
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [months, setMonths] = useState("12");
  const [currentPrice, setCurrentPrice] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");

  const ma = num(monthlyAmount);
  const mo = num(months);
  const cp = num(currentPrice);
  const abp = num(avgBuyPrice);

  const totalInvested = ma * mo;
  const sharesIfLump = abp > 0 ? totalInvested / abp : 0;
  // DCA: approximate avg price between abp and cp (simplified)
  const dcaAvgPrice = abp > 0 && cp > 0 ? (abp + cp) / 2 : abp || cp;
  const sharesViaDCA = dcaAvgPrice > 0 ? totalInvested / dcaAvgPrice : 0;
  const currentValueDCA = sharesViaDCA * cp;
  const gainDCA = currentValueDCA - totalInvested;
  const gainPct = totalInvested > 0 ? (gainDCA / totalInvested) * 100 : 0;
  const currentValueLump = sharesIfLump * cp;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <Field label="Monthly Investment Amount">
          <Input value={monthlyAmount} onChange={setMonthlyAmount} prefix="KSh" placeholder="5,000" />
        </Field>
        <Field label="Duration">
          <Input value={months} onChange={setMonths} suffix="months" placeholder="12" min="1" step="1" />
        </Field>
        <Field label="Share Price at Start" hint="price when you began">
          <Input value={avgBuyPrice} onChange={setAvgBuyPrice} prefix="KSh" placeholder="30.00" step="0.01" />
        </Field>
        <Field label="Current Share Price">
          <Input value={currentPrice} onChange={setCurrentPrice} prefix="KSh" placeholder="35.00" step="0.01" />
        </Field>
        <p className="text-xs text-gray-400">
          DCA buys more shares when prices are low, lowering your average cost over time.
        </p>
      </div>

      <ResultCard>
        <ResultRow label="Total Invested" value={ksh(totalInvested)} />
        <ResultRow label="Avg. DCA Buy Price" value={ksh(dcaAvgPrice)} />
        <ResultRow label="Shares Acquired (DCA)" value={fmt(sharesViaDCA, 0)} />
        <ResultRow label="Current Portfolio Value" value={ksh(currentValueDCA)} highlight />
        <ResultRow label="Gain / Loss" value={`${gainDCA >= 0 ? "+" : ""}${ksh(gainDCA)} (${gainDCA >= 0 ? "+" : ""}${pct(gainPct)})`} highlight />
        {cp > 0 && abp > 0 && (
          <p className="text-xs text-gray-400 mt-4">
            vs. lump sum at start: {ksh(currentValueLump)} — DCA {currentValueDCA >= currentValueLump ? "outperformed" : "underperformed"} by {ksh(Math.abs(currentValueDCA - currentValueLump))}.
          </p>
        )}
      </ResultCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Dividend Income Target
// ---------------------------------------------------------------------------

const FREQ_OPTIONS = [
  { label: "Annual", value: 1 },
  { label: "Semi-Annual", value: 2 },
  { label: "Quarterly", value: 4 },
];

function DividendIncomeCalc() {
  const [targetMonthly, setTargetMonthly] = useState("");
  const [dps, setDps] = useState("");
  const [sharePrice, setSharePrice] = useState("");
  const [freqIdx, setFreqIdx] = useState(0);

  const target = num(targetMonthly);
  const dp = num(dps);
  const sp = num(sharePrice);
  const freq = FREQ_OPTIONS[freqIdx].value;

  const annualTarget = target * 12;
  const sharesNeeded = dp > 0 ? Math.ceil(annualTarget / dp) : 0;
  const capitalNeeded = sharesNeeded * sp;
  const dividendPerPayment = dp / freq;
  const paymentPerPeriod = sharesNeeded * dividendPerPayment;
  const yld = sp > 0 && dp > 0 ? (dp / sp) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <Field label="Target Monthly Income">
          <Input value={targetMonthly} onChange={setTargetMonthly} prefix="KSh" placeholder="10,000" />
        </Field>
        <Field label="Annual Dividend per Share">
          <Input value={dps} onChange={setDps} prefix="KSh" placeholder="2.50" step="0.01" />
        </Field>
        <Field label="Current Share Price">
          <Input value={sharePrice} onChange={setSharePrice} prefix="KSh" placeholder="40.00" step="0.01" />
        </Field>
        <Field label="Dividend Frequency">
          <div className="flex gap-2">
            {FREQ_OPTIONS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setFreqIdx(i)}
                className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-colors ${
                  freqIdx === i ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <ResultCard>
        <ResultRow label="Annual Income Target" value={ksh(annualTarget)} />
        <ResultRow label="Dividend Yield" value={pct(yld)} />
        <ResultRow label="Shares Needed" value={`${fmt(sharesNeeded, 0)} shares`} highlight />
        <ResultRow label="Capital Required" value={ksh(capitalNeeded)} highlight />
        <ResultRow
          label={`Income per ${FREQ_OPTIONS[freqIdx].label.replace("Annual", "Year").replace("Semi-Annual", "Payment").replace("Quarterly", "Quarter")}`}
          value={ksh(paymentPerPeriod)}
        />
        <p className="text-xs text-gray-400 mt-4">
          Capital needed assumes buying at today's price of KSh {fmt(sp)} per share.
        </p>
      </ResultCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

const TABS = [
  { id: "broker", label: "Broker Fees", icon: "🧾", component: BrokerFeeCalc },
  { id: "yield", label: "Dividend Yield", icon: "💰", component: DividendYieldCalc },
  { id: "compound", label: "Compound Growth", icon: "📈", component: CompoundGrowthCalc },
  { id: "dca", label: "DCA", icon: "🔄", component: DCACalc },
  { id: "income", label: "Income Target", icon: "🎯", component: DividendIncomeCalc },
];

const DESCRIPTIONS: Record<string, string> = {
  broker: "See the exact breakdown of NSE transaction costs before you trade — brokerage, CDS, NSE levy, and CMA levy.",
  yield: "Calculate the dividend yield for any NSE stock and project your annual income based on how many shares you hold.",
  compound: "See how your NSE investments grow over time with compound returns — including monthly contributions.",
  dca: "Model your Dollar-Cost Averaging (DCA) strategy: how many shares you accumulate and your current gain or loss.",
  income: "Find out exactly how many shares — and how much capital — you need to hit your passive income target.",
};

export default function CalculatorsClient() {
  const [active, setActive] = useState("broker");
  const ActiveCalc = TABS.find((t) => t.id === active)!.component;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              active === tab.id
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-200 hover:text-emerald-700"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calculator card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
        <p className="text-sm text-gray-500 mb-8">{DESCRIPTIONS[active]}</p>
        <ActiveCalc />
      </div>

      {/* Context notes */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 text-xs text-amber-800">
        <strong>Disclaimer:</strong> These calculators are for educational and estimation purposes only. Actual returns, fees, and dividend payments vary. Always verify transaction costs with your broker. Past NSE performance does not guarantee future results.
      </div>
    </div>
  );
}
