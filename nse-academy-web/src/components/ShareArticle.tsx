'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';

interface ShareArticleProps {
  url: string;
  title: string;
  excerpt?: string;
  slug: string;
  category?: string;
  variant?: 'inline' | 'card' | 'compact';
}

type Network = 'twitter' | 'whatsapp' | 'linkedin' | 'facebook' | 'telegram' | 'email';

export default function ShareArticle({
  url,
  title,
  excerpt,
  slug,
  category,
  variant = 'inline',
}: ShareArticleProps) {
  const [copied, setCopied] = useState(false);
  const [supportsWebShare, setSupportsWebShare] = useState(false);

  useEffect(() => {
    setSupportsWebShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const shareText = excerpt ? `${title} - ${excerpt}` : title;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent('article_share_link_copied', { article_slug: slug, article_category: category });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked (insecure context or permission denied) - ignore silently.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: shareText, url });
      trackEvent('article_share_native', { article_slug: slug, article_category: category });
    } catch {
      // user cancelled - ignore
    }
  }

  function openIntent(network: Network) {
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareText);
    const encodedTitle = encodeURIComponent(title);
    const urls: Record<Network, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
    };
    if (network === 'email') {
      window.location.href = urls.email;
    } else {
      window.open(urls[network], '_blank', 'noopener,noreferrer,width=600,height=600');
    }
    trackEvent('article_share_network', { network, article_slug: slug, article_category: category });
  }

  const buttons: { network: Network; label: string; className: string; icon: React.ReactNode }[] = [
    {
      network: 'twitter',
      label: 'X',
      className: 'hover:border-gray-900 hover:bg-gray-900 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.86l-5.37-6.99L4.06 22H.8l8.02-9.17L0 2h7.02l4.86 6.43L18.244 2Zm-2.4 18h1.9L7.26 4H5.24l10.6 16Z" />
        </svg>
      ),
    },
    {
      network: 'whatsapp',
      label: 'WhatsApp',
      className: 'hover:border-emerald-500 hover:bg-emerald-500 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.92 11.92 0 0 0 12.05 0C5.5 0 .18 5.31.18 11.86c0 2.09.55 4.13 1.6 5.92L0 24l6.4-1.68a11.86 11.86 0 0 0 5.65 1.44h.01c6.55 0 11.87-5.32 11.87-11.86 0-3.17-1.23-6.15-3.41-8.42ZM12.06 21.8h-.01a9.94 9.94 0 0 1-5.06-1.38l-.36-.21-3.79.99 1.01-3.7-.24-.38a9.92 9.92 0 1 1 18.4-5.26c0 5.45-4.44 9.94-9.95 9.94Zm5.45-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.95 1.17c-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.03 1-1.03 2.45s1.05 2.85 1.2 3.04c.15.2 2.07 3.17 5.02 4.45.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>
      ),
    },
    {
      network: 'linkedin',
      label: 'LinkedIn',
      className: 'hover:border-blue-600 hover:bg-blue-600 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
        </svg>
      ),
    },
    {
      network: 'facebook',
      label: 'Facebook',
      className: 'hover:border-blue-700 hover:bg-blue-700 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
      ),
    },
    {
      network: 'telegram',
      label: 'Telegram',
      className: 'hover:border-sky-500 hover:bg-sky-500 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.1.56l.4-5.56 10.13-9.16c.44-.39-.1-.61-.68-.22L6.27 13.5.99 11.84c-1.15-.36-1.17-1.15.24-1.7L22.43 2.05c.96-.36 1.8.22 1.48 1.74Z" />
        </svg>
      ),
    },
    {
      network: 'email',
      label: 'Email',
      className: 'hover:border-gray-700 hover:bg-gray-700 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
  ];

  if (variant === 'compact') {
    const compact = buttons.filter((b) =>
      (['twitter', 'whatsapp', 'linkedin'] as Network[]).includes(b.network)
    );
    return (
      <div className="flex items-center gap-1.5">
        {compact.map((b) => (
          <button
            key={b.network}
            onClick={() => openIntent(b.network)}
            aria-label={`Share on ${b.label}`}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full border border-gray-200 text-gray-500 transition-colors ${b.className}`}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5">
              {b.icon}
            </span>
          </button>
        ))}
        <button
          onClick={copyLink}
          aria-label="Copy link"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-gray-200 text-gray-500 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  const wrapperClass =
    variant === 'card'
      ? 'rounded-2xl border border-gray-100 bg-gray-50 p-5'
      : 'border-y border-gray-100 py-4';

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mr-1">
          Share
        </span>

        {supportsWebShare && (
          <button
            onClick={nativeShare}
            aria-label="Share via device"
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        )}

        {buttons.map((b) => (
          <button
            key={b.network}
            onClick={() => openIntent(b.network)}
            aria-label={`Share on ${b.label}`}
            className={`inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-xl border border-gray-200 text-gray-600 transition-colors ${b.className}`}
          >
            {b.icon}
            <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:font-medium">{b.label}</span>
          </button>
        ))}

        <button
          onClick={copyLink}
          aria-label="Copy link"
          className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition-colors ml-auto"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
          </svg>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
