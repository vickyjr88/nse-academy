"use client";

import { useState } from "react";
import { createAlert } from "@/lib/alerts";

interface SetAlertModalProps {
  ticker: string;
  onClose: () => void;
  onCreated?: () => void;
}

export function SetAlertModal({ ticker, onClose, onCreated }: SetAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const price = Number(targetPrice);
    if (!price || price <= 0) {
      setError("Enter a valid target price.");
      return;
    }
    setSaving(true);
    try {
      await createAlert({ ticker, targetPrice: price, direction });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-1">Set a price alert</h3>
        <p className="text-sm text-gray-500 mb-5">
          We&apos;ll email you and notify you in-app when <span className="font-semibold">{ticker}</span> hits your target.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Alert me when price is</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("ABOVE")}
                className={`flex-1 h-11 rounded-lg text-sm font-semibold border transition-colors ${
                  direction === "ABOVE"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Above ↑
              </button>
              <button
                type="button"
                onClick={() => setDirection("BELOW")}
                className={`flex-1 h-11 rounded-lg text-sm font-semibold border transition-colors ${
                  direction === "BELOW"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Below ↓
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Target price (KES)</label>
            <input
              autoFocus
              type="number"
              min={0.01}
              step={0.01}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g. 18.50"
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Set alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
