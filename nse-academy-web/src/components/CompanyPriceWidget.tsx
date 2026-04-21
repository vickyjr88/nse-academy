"use client";

import { useEffect, useState } from "react";

interface PriceData {
  ticker: string;
  name: string;
  price: number;
  change: string;
  volume: string;
  updatedAt?: string;
}

export default function CompanyPriceWidget({ ticker }: { ticker: string }) {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPrice = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/market-data/${ticker.toUpperCase()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Widget Fetch Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [ticker]);

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-32 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading market status...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <div className="text-rose-400 text-sm font-medium">Market Data Unavailable</div>
        <p className="text-slate-500 text-xs mt-1">This counter might be suspended or closed for the day.</p>
      </div>
    );
  }

  const isPositive = data.change.startsWith("+");
  const isNegative = data.change.startsWith("-");

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex justify-between items-end mb-4">
        <div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Live Market Price</h3>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold text-white">
              {data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-slate-400 text-sm font-medium">KES</span>
          </div>
        </div>
        
        <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${
          isPositive ? "bg-emerald-500/10 text-emerald-400" : 
          isNegative ? "bg-rose-500/10 text-rose-400" : 
          "bg-slate-800 text-slate-400"
        }`}>
          <span className="mr-1">{isPositive ? "▲" : isNegative ? "▼" : ""}</span>
          {data.change}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
        <div>
          <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">24h Volume</span>
          <span className="text-sm text-slate-200 font-medium">{data.volume}</span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Last Update</span>
          <span className="text-xs text-slate-400">
            {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : 'Just now'}
          </span>
        </div>
      </div>
    </div>
  );
}
