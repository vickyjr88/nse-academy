"use client";

import { useEffect, useState } from "react";

interface StockPrice {
  ticker: string;
  name: string;
  price: number;
  change: string;
  volume: string;
}

export default function MarketTicker() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/market-data/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          // Filter out missing or invalid data if any
          const validData = Array.isArray(data) ? data.filter(s => s.ticker && s.price) : [];
          setStocks(validData);
        }
      } catch (error) {
        console.error("Failed to fetch market ticker data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();

    // Optionally set up a polling interval for the frontend ticker
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-10 bg-emerald-900 border-b border-emerald-950 flex items-center justify-center text-emerald-200/50 text-xs tracking-widest uppercase">
        Loading Market Data...
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="h-10 bg-emerald-900 border-b border-emerald-950 flex items-center justify-center text-emerald-300 text-xs">
        Market data unavailable
      </div>
    );
  }

  return (
    <div className="h-10 bg-emerald-950 flex items-center overflow-hidden border-b border-emerald-900/50 relative">
      <div className="absolute left-0 z-10 w-16 h-full bg-gradient-to-r from-emerald-950 to-transparent pointer-events-none" />

      {/* Ticker Flex Container */}
      <div className="flex animate-ticker whitespace-nowrap will-change-transform">
        {/* Render the array twice to create a seamless loop */}
        {[...stocks, ...stocks].map((stock, i) => {
          const isPositive = stock.change.startsWith("+");
          const isNegative = stock.change.startsWith("-");

          return (
            <div
              key={`${stock.ticker}-${i}`}
              className="flex items-center space-x-2 px-6 border-r border-emerald-800/30 font-medium text-sm"
            >
              <span className="text-emerald-50 bg-emerald-900 px-1.5 py-0.5 rounded text-xs">
                {stock.ticker}
              </span>
              <span className="text-gray-300 ml-2">
                {stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span
                className={`text-xs ml-2 ${isPositive
                    ? "text-green-400"
                    : isNegative
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
              >
                {isPositive ? "▲" : isNegative ? "▼" : "—"} {stock.change}
              </span>
            </div>
          );
        })}
      </div>

      <div className="absolute right-0 z-10 w-16 h-full bg-gradient-to-l from-emerald-950 to-transparent pointer-events-none" />

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-ticker {
          display: inline-flex;
          animation: ticker ${stocks.length * 2}s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}} />
    </div>
  );
}
