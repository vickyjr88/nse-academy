import { promises as dns } from 'dns';

/** Throwaway-mail domains: never a real customer, and sending marketing to them only hurts the sender's reputation. */
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org',
  'trashmail.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc', 'dispostable.com', 'throwawaymail.com', 'sskaid.com',
]);

const SYNTAX = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/;

export type Resolver = (domain: string) => Promise<boolean>;

/** True when the domain publishes at least one mail server. */
export const hasMailServer: Resolver = async (domain) => {
  try {
    return (await dns.resolveMx(domain)).length > 0;
  } catch {
    return false;
  }
};

export interface Screened {
  deliverable: { email: string; name: string }[];
  excluded: { email: string; reason: string }[];
}

/** Splits a list into addresses worth mailing and ones to skip (with the reason), looking each domain up once. */
export async function screenAddresses(users: { email: string; name: string }[], resolve: Resolver = hasMailServer): Promise<Screened> {
  const verdict = new Map<string, Promise<boolean>>();
  const out: Screened = { deliverable: [], excluded: [] };
  for (const u of users) {
    const m = SYNTAX.exec(u.email.trim());
    if (!m) {
      out.excluded.push({ email: u.email, reason: 'not a valid address' });
      continue;
    }
    const domain = m[1].toLowerCase();
    if (DISPOSABLE_DOMAINS.has(domain)) {
      out.excluded.push({ email: u.email, reason: 'throwaway-mail domain' });
      continue;
    }
    if (!verdict.has(domain)) verdict.set(domain, resolve(domain));
    if (await verdict.get(domain)) out.deliverable.push(u);
    else out.excluded.push({ email: u.email, reason: 'domain has no mail server' });
  }
  return out;
}
