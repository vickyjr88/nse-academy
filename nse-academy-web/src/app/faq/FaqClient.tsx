"use client";

import { useState, useMemo } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  icon: string;
  items: FaqItem[];
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{part}</mark>
    ) : part
  );
}

function Accordion({ item, query }: { item: FaqItem; query: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${open ? "shadow-sm" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-900 text-sm leading-relaxed">
          {highlight(item.q, query)}
        </span>
        <span className={`shrink-0 mt-0.5 text-emerald-600 text-lg font-bold transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 bg-white">
          <div className="text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4 whitespace-pre-line">
            {highlight(item.a, query)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FaqClient({ categories }: { categories: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) =>
        (!activeCategory || cat.id === activeCategory) && cat.items.length > 0
      );
  }, [query, activeCategory, categories]);

  const totalResults = filtered.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Search */}
      <div className="relative mb-8">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm focus-within:border-emerald-400 transition-colors">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
          )}
        </div>
        {query && (
          <p className="text-xs text-gray-400 mt-2 px-1">
            {totalResults} result{totalResults !== 1 ? "s" : ""} for "{query}"
          </p>
        )}
      </div>

      {/* Category filter pills */}
      {!query && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !activeCategory ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* FAQ sections */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🤷</p>
          <p className="font-medium">No results for "{query}"</p>
          <button onClick={() => setQuery("")} className="mt-3 text-sm text-emerald-700 hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        filtered.map((cat) => (
          <section key={cat.id} id={cat.id} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{cat.icon}</span>
              <h2 className="text-lg font-bold text-gray-900">{cat.label}</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">
                {cat.items.length}
              </span>
            </div>
            <div className="space-y-2">
              {cat.items.map((item, i) => (
                <Accordion key={i} item={item} query={query} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
