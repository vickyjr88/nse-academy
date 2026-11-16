import React from 'react';
import { useAuth } from '@strapi/strapi/admin';
import { NSE_API_URL } from './index';
import { SectionTabs } from './ui/page';

// The NSE API is protected by one shared key. That key must never reach the browser (Strapi's admin JavaScript is public),
// so every call the pages make to the NSE API is rewritten here to go to Strapi's own `/user-manager/proxy` route instead,
// carrying the signed-in admin's Strapi login token. Strapi checks the login, adds the key server-side, adds the admin's
// email as `x-admin-user` for the audit trail, and forwards the call (see ../../server/proxy.ts). Wrapping fetch once means
// the pages, which call fetch directly, are covered without being edited.

let token: string | null = null;
let patched = false;

function installFetchPatch() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(NSE_API_URL)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.delete('x-admin-key');
        headers.delete('x-admin-user');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const rest = url.slice(NSE_API_URL.length).replace(/([?&])x-admin-key=[^&]*&?/, '$1').replace(/[?&]$/, '');
        const backend = (window as any).strapi?.backendURL || '';
        return original(`${backend}/user-manager/proxy${rest}`, { ...init, headers });
      }
    } catch {
      /* fall through to the plain call */
    }
    return original(input, init);
  };
}

/** React.lazy for an admin page that also routes its API calls through Strapi's proxy. `name` is the page's named export. */
export function lazyPage(importer: () => Promise<Record<string, any>>, name: string) {
  return React.lazy(async () => {
    const mod = await importer();
    const Page = mod[name];
    const Wrapped = (props: any) => {
      token = useAuth('NSEActor', (s) => s.token) ?? null;
      installFetchPatch();
      return (
        <>
          <SectionTabs />
          <Page {...props} />
        </>
      );
    };
    return { default: Wrapped };
  });
}
