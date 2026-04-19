"use client";

import { useState, useMemo } from "react";

export interface GlossaryTerm {
  id: number;
  term: string;
  definition: string;
  example?: string;
}

interface Props {
  terms: GlossaryTerm[];
}

export default function GlossaryClient({ terms }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
    );
  }, [query, terms]);

  // Group by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const term of filtered) {
      const letter = term.term[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(term);
    }
    // Sort alphabetically
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [filtered]);

  const letters = Array.from(grouped.keys());

  function highlightMatch(text: string) {
    if (!query.trim()) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div className="mb-8">
        <div className="relative max-w-xl">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms or definitions…"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <p className="text-sm text-gray-400 mt-2">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* A-Z jump links */}
      {letters.length > 4 && (
        <div className="flex flex-wrap gap-1.5 mb-8">
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
            >
              {letter}
            </a>
          ))}
        </div>
      )}

      {/* Term list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No terms found</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {letters.map((letter) => {
            const letterTerms = grouped.get(letter)!;
            return (
              <section key={letter} id={`letter-${letter}`}>
                <h2 className="text-xl font-bold text-emerald-700 mb-4 border-b border-emerald-100 pb-2">
                  {letter}
                </h2>
                <dl className="space-y-5">
                  {letterTerms.map((t) => (
                    <div key={t.id} className="bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm">
                      <dt className="font-semibold text-gray-900 text-sm mb-1">
                        {highlightMatch(t.term)}
                      </dt>
                      <dd className="text-sm text-gray-600 leading-relaxed">
                        {highlightMatch(t.definition)}
                      </dd>
                      {t.example && (
                        <dd className="mt-2 text-xs text-gray-400 italic border-l-2 border-emerald-200 pl-3">
                          Example: {t.example}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
