import React from 'react';
import { useAuth } from '@strapi/strapi/admin';
import { NSE_API_URL } from './index';

// The NSE API is protected by one shared key, so on its own it cannot say which person made a change. Every admin page
// is wrapped so that the signed-in Strapi admin's identity is sent with each call to the NSE API as `x-admin-user`.
// The API stores it in the audit trail as an annotation (it does not grant access). Wrapping fetch once means the older
// pages, which call fetch directly, are covered without being edited.

let actor: string | null = null;
let patched = false;

function installFetchPatch() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (actor && url.startsWith(NSE_API_URL)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set('x-admin-user', actor);
        return original(input, { ...init, headers });
      }
    } catch {
      /* fall through to the plain call */
    }
    return original(input, init);
  };
}

/** React.lazy for an admin page that also records who is using it. `name` is the page's named export. */
export function lazyPage(importer: () => Promise<Record<string, any>>, name: string) {
  return React.lazy(async () => {
    const mod = await importer();
    const Page = mod[name];
    const Wrapped = (props: any) => {
      const user = useAuth('NSEActor', (s) => s.user);
      actor = user?.email || [user?.firstname, user?.lastname].filter(Boolean).join(' ') || null;
      installFetchPatch();
      return <Page {...props} />;
    };
    return { default: Wrapped };
  });
}
