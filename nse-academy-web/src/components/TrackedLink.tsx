'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics';

type NextLinkProps = ComponentPropsWithoutRef<typeof Link>;

interface TrackedLinkProps extends NextLinkProps {
  event: string;
  eventProps?: Record<string, unknown>;
  children: ReactNode;
}

/**
 * Drop-in Next.js Link replacement that fires a PostHog event on click.
 * The event is captured synchronously *before* navigation so it isn't lost
 * to a fast SPA transition. eventProps is forwarded as the PostHog payload.
 */
export function TrackedLink({
  event,
  eventProps,
  onClick,
  children,
  ...rest
}: TrackedLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    trackEvent(event, eventProps);
    onClick?.(e);
  };
  return (
    <Link {...rest} onClick={handleClick}>
      {children}
    </Link>
  );
}

interface TrackedAnchorProps extends ComponentPropsWithoutRef<'a'> {
  event: string;
  eventProps?: Record<string, unknown>;
  children: ReactNode;
}

/**
 * Same idea for raw <a> elements (external links). Use this for any href
 * that points outside the Next.js app (WhatsApp, partner brokers, etc.).
 */
export function TrackedAnchor({
  event,
  eventProps,
  onClick,
  children,
  ...rest
}: TrackedAnchorProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    trackEvent(event, eventProps);
    onClick?.(e);
  };
  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
