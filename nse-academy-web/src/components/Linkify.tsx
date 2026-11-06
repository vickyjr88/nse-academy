import { Fragment, type ReactNode } from "react";

// Turns web addresses inside plain text into links, without ever treating the text as HTML: the text is split into
// pieces and rendered as React nodes, so an author cannot inject markup. Only http(s) addresses (and bare "www.")
// become links, which rules out javascript: and similar schemes.

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?'"\]}]+$/;

/** Splits a matched address from the punctuation that belongs to the sentence around it. */
export function splitUrl(raw: string): { url: string; rest: string } {
  let url = raw;
  let rest = "";
  for (;;) {
    const stripped = url.replace(TRAILING, "");
    // A closing bracket belongs to the address only when it balances an opening one inside it.
    const unbalanced = stripped.endsWith(")") && (stripped.match(/\(/g) ?? []).length < (stripped.match(/\)/g) ?? []).length;
    const next = unbalanced ? stripped.slice(0, -1) : stripped;
    if (next === url) break;
    rest = url.slice(next.length) + rest;
    url = next;
  }
  return { url, rest };
}

export function linkifyParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const start = m.index ?? 0;
    const { url, rest } = splitUrl(m[0]);
    if (!/^(?:https?:\/\/|www\.)[^./]/i.test(url)) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: /^www\./i.test(url) ? `https://${url}` : url });
    last = start + url.length;
    if (rest) {
      parts.push({ text: rest });
      last = start + url.length + rest.length;
    }
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export default function Linkify({ text, className = "" }: { text: string; className?: string }): ReactNode {
  return (
    <>
      {linkifyParts(text).map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className={`text-emerald-700 underline underline-offset-2 hover:text-emerald-800 break-all ${className}`}
          >
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
