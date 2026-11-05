"use client";

import { useState } from "react";

interface Props {
  url: string;
  whatsapp: string;
  xPost: string;
  caption: string;
  hashtags: string[];
  cardUrls: string[];
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-emerald-600 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed - select the text above" : label}
    </button>
  );
}

const linkClass =
  "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export default function ShareBar({ url, whatsapp, xPost, caption, hashtags, cardUrls }: Props) {
  const enc = encodeURIComponent;
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-900">Share this report</p>
        <div className="flex flex-wrap gap-3">
          <a href={`https://wa.me/?text=${enc(whatsapp)}`} target="_blank" rel="noopener noreferrer" className={`${linkClass} bg-[#128C7E] focus-visible:ring-[#128C7E]`}>
            WhatsApp
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${enc(xPost)}`} target="_blank" rel="noopener noreferrer" className={`${linkClass} bg-black focus-visible:ring-black`}>
            Post on X
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" className={`${linkClass} bg-[#1877F2] focus-visible:ring-[#1877F2]`}>
            Facebook
          </a>
          <a href={`https://t.me/share/url?url=${enc(url)}&text=${enc(caption)}`} target="_blank" rel="noopener noreferrer" className={`${linkClass} bg-[#229ED9] focus-visible:ring-[#229ED9]`}>
            Telegram
          </a>
          <CopyButton text={url} label="Copy link" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">For a WhatsApp channel or group</p>
          <pre className="mb-3 whitespace-pre-wrap break-words rounded-2xl bg-gray-50 p-4 font-sans text-sm leading-relaxed text-gray-700">{whatsapp}</pre>
          <CopyButton text={whatsapp} label="Copy WhatsApp message" />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">For Instagram, TikTok and YouTube Shorts</p>
          <pre className="mb-3 whitespace-pre-wrap break-words rounded-2xl bg-gray-50 p-4 font-sans text-sm leading-relaxed text-gray-700">{`${caption}\n\n${hashtags.join(" ")}`}</pre>
          <CopyButton text={`${caption}\n\n${hashtags.join(" ")}`} label="Copy caption and hashtags" />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-gray-900">Story and reel cards</p>
        <p className="mb-3 text-sm text-gray-500">Vertical 1080 x 1920 images for Reels, Shorts, TikTok and WhatsApp Status. Save them and post in order.</p>
        <div className="flex flex-wrap gap-2">
          {cardUrls.map((href, i) => (
            <a
              key={href}
              href={href}
              download={`nse-report-card-${i + 1}.png`}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-emerald-600 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Card {i + 1}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
