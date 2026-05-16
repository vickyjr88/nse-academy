'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: 'identified_only',
      // Session replay — sampling is configured server-side in the PostHog
      // project. We mask all <input> values and any element marked .ph-mask
      // so we never record passwords, emails, M-Pesa numbers, KRA PINs, etc.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '.ph-mask',
      },
      // Honour Do Not Track signals.
      respect_dnt: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture('$pageview', { $current_url: window.location.origin + url });
  }, [pathname, searchParams]);

  return null;
}
