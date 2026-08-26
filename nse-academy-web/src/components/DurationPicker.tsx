"use client";

import { useState } from "react";
import {
  type SubscriptionPlan,
  type BillingMonths,
  BILLING_MONTHS_OPTIONS,
  PLAN_PRICES_KES,
  DISCOUNT_BY_MONTHS,
  computeTotalKes,
  computeFullPriceKes,
} from "@/lib/pricing";

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  intermediary: "Intermediary",
  premium: "Premium",
};

const MONTHS_LABEL: Record<BillingMonths, string> = {
  1: "1 month",
  3: "3 months",
  6: "6 months",
  12: "12 months",
};

function kes(n: number): string {
  return `KSh ${n.toLocaleString()}`;
}

export default function DurationPicker({
  plan,
  onSelect,
  loadingMonths,
}: {
  plan: SubscriptionPlan;
  onSelect: (months: BillingMonths) => void;
  loadingMonths?: BillingMonths | null;
}) {
  const [selected, setSelected] = useState<BillingMonths>(1);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {BILLING_MONTHS_OPTIONS.map((months) => {
          const total = computeTotalKes(plan, months);
          const fullPrice = computeFullPriceKes(plan, months);
          const discount = DISCOUNT_BY_MONTHS[months];
          const monthlyEquivalent = Math.round(total / months);
          const isSelected = selected === months;

          return (
            <button
              key={months}
              type="button"
              onClick={() => setSelected(months)}
              className={`relative text-left border rounded-2xl p-4 transition-colors ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {discount > 0 && (
                <span className="absolute -top-2 right-3 text-xs font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-full">
                  Save {Math.round(discount * 100)}%
                </span>
              )}
              <p className="font-bold text-gray-900">{MONTHS_LABEL[months]}</p>
              <p className="text-lg font-black text-gray-900 mt-1">{kes(total)}</p>
              {discount > 0 ? (
                <p className="text-xs text-gray-400">
                  <span className="line-through">{kes(fullPrice)}</span> · {kes(monthlyEquivalent)}/mo
                </p>
              ) : (
                <p className="text-xs text-gray-400">{kes(PLAN_PRICES_KES[plan])}/mo</p>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(selected)}
        disabled={loadingMonths != null}
        className="w-full bg-emerald-700 text-white font-bold py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
      >
        {loadingMonths != null
          ? "Redirecting…"
          : `Pay ${kes(computeTotalKes(plan, selected))} for ${PLAN_LABEL[plan]} - ${MONTHS_LABEL[selected]}`}
      </button>
    </div>
  );
}
