// Turns an admin API call into a sentence a person can read in the audit log, and strips what must never be stored.
// Pure: method, path and body in; description out.

export interface Described {
  action: string;
  entityType: string | null;
  entityId: string | null;
}

type Body = Record<string, unknown> | undefined;

const str = (v: unknown, max = 80): string => (typeof v === 'string' ? (v.length > max ? `${v.slice(0, max)}...` : v) : v == null ? '' : String(v));
/** An exact prefix (a date, a timestamp): unlike `str`, never adds an ellipsis. */
const cut = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
const who = (id: string) => `user ${id}`;

interface Rule {
  method: string;
  pattern: RegExp;
  build: (m: RegExpMatchArray, body: Body) => Described;
}

const d = (action: string, entityType: string | null = null, entityId: string | null = null): Described => ({ action, entityType, entityId });

const RULES: Rule[] = [
  { method: 'POST', pattern: /^\/admin\/users\/([^/]+)\/subscription$/, build: (m, b) => d(`Set the subscription of ${who(m[1])} to ${str(b?.tier)} (${str(b?.status)})${b?.currentPeriodEnd ? ` until ${cut(b.currentPeriodEnd, 10)}` : ''}`, 'user', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/users\/([^/]+)\/subscription$/, build: (m) => d(`Cancelled the subscription of ${who(m[1])}`, 'user', m[1]) },
  { method: 'PUT', pattern: /^\/admin\/users\/([^/]+)\/holdings\/([^/]+)$/, build: (m, b) => d(`Edited a holding of ${who(m[1])}${b?.quantity !== undefined ? `, shares to ${str(b.quantity)}` : ''}${b?.avgCost !== undefined ? `, cost to ${str(b.avgCost)}` : ''}`, 'holding', m[2]) },
  { method: 'POST', pattern: /^\/admin\/users\/([^/]+)\/holdings$/, build: (m, b) => d(`Added a holding for ${who(m[1])}: ${str(b?.quantity)} ${str(b?.ticker)}`, 'user', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/users\/([^/]+)\/holdings\/([^/]+)$/, build: (m) => d(`Deleted a holding of ${who(m[1])}`, 'holding', m[2]) },
  { method: 'PUT', pattern: /^\/admin\/users\/([^/]+)\/trades\/([^/]+)$/, build: (m) => d(`Edited a trade of ${who(m[1])}`, 'trade', m[2]) },
  { method: 'DELETE', pattern: /^\/admin\/users\/([^/]+)\/trades\/([^/]+)$/, build: (m) => d(`Deleted a trade of ${who(m[1])}`, 'trade', m[2]) },
  { method: 'POST', pattern: /^\/admin\/organizations$/, build: (_m, b) => d(`Created organization ${str(b?.name)}`, 'organization') },
  { method: 'PUT', pattern: /^\/admin\/organizations\/([^/]+)\/license$/, build: (m, b) => d(`Updated the licence of organization ${m[1]} (${str(b?.seats)} seats, until ${cut(b?.currentPeriodEnd, 10)})`, 'organization', m[1]) },
  { method: 'PUT', pattern: /^\/admin\/organizations\/([^/]+)\/members\/([^/]+)\/role$/, build: (m, b) => d(`Changed a member's role in organization ${m[1]} to ${str(b?.role)}`, 'organization', m[1]) },
  { method: 'POST', pattern: /^\/admin\/organizations\/([^/]+)\/members\/([^/]+)\/resend-invite$/, build: (m) => d(`Resent an invite in organization ${m[1]}`, 'organization', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/organizations\/([^/]+)\/members\/([^/]+)$/, build: (m) => d(`Removed a member from organization ${m[1]}`, 'organization', m[1]) },
  { method: 'POST', pattern: /^\/admin\/advisors\/([^/]+)\/approve$/, build: (m) => d(`Approved advisor ${m[1]}`, 'advisor', m[1]) },
  { method: 'POST', pattern: /^\/admin\/advisors\/([^/]+)\/suspend$/, build: (m) => d(`Suspended advisor ${m[1]}`, 'advisor', m[1]) },
  { method: 'PUT', pattern: /^\/admin\/brokers\/([^/]+)$/, build: (m, b) => d(`Updated broker ${m[1]}${b?.feePercent !== undefined ? `, fee to ${str(b.feePercent)}%` : ''}${b?.isActive !== undefined ? `, ${b.isActive ? 'shown' : 'hidden'}` : ''}`, 'broker', m[1]) },
  { method: 'POST', pattern: /^\/admin\/broadcast\/send$/, build: (_m, b) => d(`Sent broadcast "${str(b?.subject)}" to ${[b?.tier ? `${str(b.tier)} tier` : '', b?.tagId ? `tag ${str(b.tagId)}` : ''].filter(Boolean).join(' + ') || 'all users'}`, 'broadcast') },
  { method: 'POST', pattern: /^\/admin\/campaigns\/subscription\/(sample|test|schedule|send|cancel)$/, build: (m, b) => d(`Subscription campaign: ${m[1]}${b?.audience ? ` (${str(b.audience)})` : ''}${b?.scheduledAt ? ` for ${cut(b.scheduledAt, 20)}` : ''}${b?.campaignId ? ` campaign ${str(b.campaignId)}` : ''}${b?.to ? ` to ${Array.isArray(b.to) ? b.to.join(', ') : str(b.to)}` : ''}`, 'campaign') },
  { method: 'POST', pattern: /^\/admin\/market-reports\/generate$/, build: (_m, b) => d(`Generated the market report for ${str(b?.date) || 'the latest session'}${b?.force ? ' (forced)' : ''}`, 'market-report', str(b?.date) || null) },
  { method: 'POST', pattern: /^\/admin\/market-reports\/([^/]+)\/(publish|unpublish)$/, build: (m) => d(`${m[2] === 'publish' ? 'Published' : 'Unpublished'} the market report for ${m[1]}`, 'market-report', m[1]) },
  { method: 'POST', pattern: /^\/admin\/reports\/daily\/send$/, build: (_m, b) => d(`Sent the daily report${b?.to ? ` to ${str(b.to)}` : ''}`, 'report') },
  { method: 'POST', pattern: /^\/admin\/portfolio-watch\/(send|run)$/, build: (m, b) => d(m[1] === 'run' ? 'Ran portfolio watch for everyone' : `Portfolio watch ${b?.dryRun ? 'dry run' : 'send'} for ${str(b?.email)}`, 'portfolio-watch') },
  { method: 'POST', pattern: /^\/admin\/model-portfolios$/, build: (_m, b) => d(`Created model portfolio "${str(b?.name)}"`, 'model-portfolio') },
  { method: 'PUT', pattern: /^\/admin\/model-portfolios\/([^/]+)$/, build: (m, b) => d(`Edited model portfolio ${m[1]}${b?.name ? ` ("${str(b.name)}")` : ''}`, 'model-portfolio', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/model-portfolios\/([^/]+)$/, build: (m) => d(`Deleted model portfolio ${m[1]}`, 'model-portfolio', m[1]) },
  { method: 'POST', pattern: /^\/admin\/model-portfolios\/([^/]+)\/(publish|unpublish)$/, build: (m) => d(`${m[2] === 'publish' ? 'Published' : 'Unpublished'} model portfolio ${m[1]}`, 'model-portfolio', m[1]) },
  { method: 'POST', pattern: /^\/admin\/research\/generate$/, build: (_m, b) => d(b?.kind === 'BRIEF' ? `Drafted a research brief for ${str(b?.ticker)}` : `Drafted the focus list for ${str(b?.period) || 'this month'}`, 'research') },
  { method: 'PUT', pattern: /^\/admin\/research\/([^/]+)$/, build: (m) => d(`Edited research note ${m[1]}`, 'research', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/research\/([^/]+)$/, build: (m) => d(`Deleted research note ${m[1]}`, 'research', m[1]) },
  { method: 'POST', pattern: /^\/admin\/research\/([^/]+)\/(publish|unpublish)$/, build: (m) => d(`${m[2] === 'publish' ? 'Published' : 'Unpublished'} research note ${m[1]}`, 'research', m[1]) },
  { method: 'POST', pattern: /^\/admin\/tags$/, build: (_m, b) => d(`Created tag "${str(b?.name)}"`, 'tag') },
  { method: 'PUT', pattern: /^\/admin\/tags\/([^/]+)$/, build: (m, b) => d(`Renamed tag ${m[1]} to "${str(b?.name)}"`, 'tag', m[1]) },
  { method: 'DELETE', pattern: /^\/admin\/tags\/([^/]+)$/, build: (m) => d(`Deleted tag ${m[1]}`, 'tag', m[1]) },
  { method: 'POST', pattern: /^\/admin\/tags\/([^/]+)\/apply-by-email$/, build: (m, b) => d(`Applied tag ${m[1]} to ${Array.isArray(b?.emails) ? b.emails.length : '?'} email address(es)`, 'tag', m[1]) },
  { method: 'POST', pattern: /^\/admin\/tags\/([^/]+)\/(apply|remove)$/, build: (m, b) => d(`${m[2] === 'apply' ? 'Applied' : 'Removed'} tag ${m[1]} ${m[2] === 'apply' ? 'to' : 'from'} ${Array.isArray(b?.userIds) ? b.userIds.length : '?'} member(s)`, 'tag', m[1]) },
];

/** Describes a write to the admin API. Unknown routes still get a usable line and an entity guess from the path. */
export function describeAction(method: string, path: string, body: Body): Described {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  const m = method.toUpperCase();
  for (const r of RULES) {
    if (r.method !== m) continue;
    const match = clean.match(r.pattern);
    if (match) return r.build(match, body);
  }
  const parts = clean.split('/').filter(Boolean); // ['admin', 'leads', '<id>', ...]
  const entityType = parts[1] ?? null;
  const entityId = parts[2] && !/^(send|run|generate|preview)$/.test(parts[2]) ? parts[2] : null;
  return { action: `${m} ${clean}`, entityType, entityId };
}

const SENSITIVE = /pass(word)?|secret|token|api[-_]?key|authorization|^key$/i;
const MAX_STRING = 300;
const MAX_JSON = 4000;

/** A copy of a request body that is safe to keep: secrets removed, long text cut, total size bounded. */
export function redactBody(body: unknown): unknown {
  const walk = (v: unknown, depth: number): unknown => {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}... (${v.length} chars)` : v;
    if (depth > 4) return '[nested]';
    if (Array.isArray(v)) return v.slice(0, 20).map((x) => walk(x, depth + 1));
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = SENSITIVE.test(k) ? '[redacted]' : walk(val, depth + 1);
      return out;
    }
    return String(v);
  };
  const out = walk(body, 0);
  const json = JSON.stringify(out);
  return json && json.length > MAX_JSON ? { truncated: true, preview: json.slice(0, MAX_JSON) } : out;
}

/** The admin user named by the admin panel, if it looks like a person's identity; never trusted for access. */
export function cleanActor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return v && v.length <= 120 && /^[\w.@+\- ]+$/.test(v) ? v : null;
}
