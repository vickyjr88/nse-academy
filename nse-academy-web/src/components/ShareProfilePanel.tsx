'use client';

import { useEffect, useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';

interface ShareProfilePanelProps {
  initialIsPublic?: boolean;
  initialSlug?: string | null;
  investorType: string;
}

interface ShareResponse {
  isPublic: boolean;
  publicSlug: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  conservative: 'Conservative Investor',
  moderate: 'Moderate Investor',
  aggressive: 'Aggressive Investor',
  growth: 'Growth Investor',
  dividend: 'Dividend Seeker',
};

function siteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net';
}

export default function ShareProfilePanel({
  initialIsPublic = false,
  initialSlug = null,
  investorType,
}: ShareProfilePanelProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [supportsWebShare, setSupportsWebShare] = useState(false);

  useEffect(() => {
    setSupportsWebShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const shareUrl = useMemo(() => (slug ? `${siteUrl()}/p/${slug}` : ''), [slug]);
  const imageUrl = useMemo(() => (slug ? `${siteUrl()}/api/og/profile/${slug}` : ''), [slug]);
  const typeLabel = TYPE_LABEL[investorType] ?? 'NSE Investor';
  const shareText = `I’m a ${typeLabel} on NSE Academy. Take the free quiz and discover your investor type:`;

  async function callShareApi(next: boolean): Promise<ShareResponse | null> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setError('Please log in again to share.');
      return null;
    }
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiler/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isPublic: next }),
    });
    if (!res.ok) {
      setError('Could not update sharing. Try again.');
      return null;
    }
    return (await res.json()) as ShareResponse;
  }

  async function togglePublic() {
    setError('');
    setBusy(true);
    const next = !isPublic;
    const data = await callShareApi(next);
    if (data) {
      setIsPublic(data.isPublic);
      setSlug(data.publicSlug);
      trackEvent(next ? 'profile_shared_public' : 'profile_shared_private', {
        investor_type: investorType,
      });
    }
    setBusy(false);
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent('profile_share_link_copied', { investor_type: investorType });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Long-press the link to copy.');
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: 'My NSE Investor Profile',
        text: shareText,
        url: shareUrl,
      });
      trackEvent('profile_share_native', { investor_type: investorType });
    } catch {
      // user cancelled - ignore
    }
  }

  function openIntent(network: 'twitter' | 'whatsapp' | 'linkedin' | 'facebook') {
    if (!shareUrl) return;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    const urls: Record<typeof network, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    };
    window.open(urls[network], '_blank', 'noopener,noreferrer,width=600,height=600');
    trackEvent('profile_share_network', { network, investor_type: investorType });
  }

  function downloadImage() {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `nse-investor-profile-${slug}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    trackEvent('profile_share_image_downloaded', { investor_type: investorType });
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Share your profile</h3>
          <p className="text-sm text-gray-500 mt-1">
            Make your investor type public and share a watermarked card.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-gray-600">{isPublic ? 'Public' : 'Private'}</span>
          <span
            className={`relative inline-block w-11 h-6 rounded-full transition-colors ${
              isPublic ? 'bg-emerald-600' : 'bg-gray-300'
            } ${busy ? 'opacity-50' : ''}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={isPublic}
              onChange={togglePublic}
              disabled={busy}
              aria-label="Make profile public"
            />
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {!isPublic && (
        <p className="text-sm text-gray-400">
          Your profile is private. Flip the toggle to generate a shareable link.
        </p>
      )}

      {isPublic && shareUrl && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Your shareable NSE investor profile card"
              className="w-full block"
              loading="lazy"
            />
          </div>

          {/* Copy link */}
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 min-w-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyLink}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {supportsWebShare && (
              <button
                onClick={nativeShare}
                className="text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
              >
                Share…
              </button>
            )}
            <button
              onClick={() => openIntent('twitter')}
              className="text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
            >
              X / Twitter
            </button>
            <button
              onClick={() => openIntent('whatsapp')}
              className="text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
            >
              WhatsApp
            </button>
            <button
              onClick={() => openIntent('linkedin')}
              className="text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-200 hover:border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
            >
              LinkedIn
            </button>
          </div>

          <button
            onClick={downloadImage}
            className="w-full text-sm text-gray-500 hover:text-emerald-700 underline underline-offset-4"
          >
            Download image
          </button>
        </div>
      )}
    </div>
  );
}
