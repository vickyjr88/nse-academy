"use client";

import { useEffect, useState } from "react";
import { type AdvisorInsight, listInsightsFeed } from "@/lib/advisor";

export default function InsightsFeedPage() {
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    listInsightsFeed()
      .then(setInsights)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading…</div>;

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't load insights</h2>
        <p className="text-sm text-gray-500">Something went wrong. Please refresh the page to try again.</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-4">💡</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">No insights yet</h2>
        <p className="text-sm text-gray-500">
          Once you connect with a financial advisor and they publish an insight, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {insights.map((insight) => (
        <div key={insight.id} className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">{insight.advisor?.user?.name}</p>
            <p className="text-xs text-gray-400">{new Date(insight.createdAt).toLocaleDateString()}</p>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">{insight.title}</h3>
          <p className="text-gray-700 whitespace-pre-line">{insight.body}</p>
          {insight.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {insight.tickers.map((t) => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
