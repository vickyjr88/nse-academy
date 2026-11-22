/**
 * The one configuration document for hourly posting and the read listener.
 * Stored as JSON on XAutomationConfig. `normalizeConfig` is the only parser,
 * so a hand-edited row cannot smuggle an unknown template into the poster.
 */

export const SLOT_TEMPLATES = [
  'session-open',
  'mover',
  'breadth',
  'spotlight',
  'most-active',
  'into-the-close',
  'session-close',
  'evening-wrap',
] as const;

export type SlotTemplate = (typeof SLOT_TEMPLATES)[number];

export interface SlotDef {
  id: string;
  enabled: boolean;
  /** Fires throughout this Nairobi hour (0-23) until a run exists. */
  hour?: number;
  /** Fires from this minute-of-day for 50 minutes. Used by the evening wrap, which sits outside the hourly window. */
  atMinute?: number;
  template: SlotTemplate;
}

export interface StreamRule {
  tag: string;
  value: string;
}

export interface AutomationConfig {
  enabled: boolean;
  mode: 'draft' | 'live';
  credentialId: string | null;
  /** JS weekday, 0 = Sunday. */
  days: number[];
  startMinute: number;
  endMinute: number;
  maxPostsPerDay: number;
  minGapMinutes: number;
  skipIfUnchanged: boolean;
  /** When true, market slots are rewritten by the cheapest model. Lessons and the evening wrap never are. */
  aiCompose: boolean;
  moverThresholdPct: number;
  slots: SlotDef[];
  lessons: string[];
  spotlightTickers: string[];
  streamEnabled: boolean;
  streamRules: StreamRule[];
  streamDailyPostCap: number;
  streamMonthlyUsdCap: number;
  streamUnitUsd: number;
}

export const DEFAULT_SLOTS: SlotDef[] = [
  { id: 'open', enabled: true, hour: 9, template: 'session-open' },
  { id: 'mover-am', enabled: true, hour: 10, template: 'mover' },
  { id: 'breadth', enabled: true, hour: 11, template: 'breadth' },
  { id: 'spotlight', enabled: true, hour: 12, template: 'spotlight' },
  { id: 'active', enabled: true, hour: 13, template: 'most-active' },
  { id: 'mover-pm', enabled: true, hour: 14, template: 'mover' },
  { id: 'close-approach', enabled: true, hour: 15, template: 'into-the-close' },
  { id: 'close', enabled: true, hour: 16, template: 'session-close' },
  { id: 'evening-wrap', enabled: true, atMinute: 21 * 60 + 10, template: 'evening-wrap' },
];

export const DEFAULT_LESSONS = [
  'The NSE limits a share price to a 10% move in one day. A stock that hits the limit can still move again next session.',
  'A price that jumps on a few shares is easy to misread. Our mover lists ignore stocks with under KSh 100,000 traded.',
  'Breadth is how many stocks rose versus how many fell. It says more about the session than any single name.',
  'Value traded is the shillings that changed hands, not a profit or a loss. A big turnover can belong to one stock.',
  'The most traded name can be a large share of the whole market. Headline turnover then describes that stock more than the session.',
  'A daily change compares the last price with the previous close. It does not say why the price moved.',
  'Volume is what makes a move hard to dismiss. The same percentage on thin trading is a weaker signal.',
  'Unchanged stocks are part of the picture. A session can look busy while most names barely moved.',
  'Near the 10% limit, a stock can stop trading higher or lower for the rest of the day and still gap next session.',
  'Comparing one stock with the session breadth stops a single mover from standing in for the whole market.',
  'Prices on this feed are snapshots through the day. The official close is the figure the exchange publishes.',
  'Educational posts describe the session. They are not a recommendation to buy, sell, or hold.',
];

export const DEFAULT_RULES: StreamRule[] = [
  { tag: 'official', value: 'from:NSE_PLC' },
  { tag: 'desk', value: 'from:kenyanwalstreet OR from:AXYS_Invest OR from:MwangoCapital' },
];

export const DEFAULT_CONFIG: AutomationConfig = {
  enabled: false,
  mode: 'draft',
  credentialId: null,
  days: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 16 * 60,
  maxPostsPerDay: 8,
  minGapMinutes: 50,
  skipIfUnchanged: true,
  aiCompose: false,
  moverThresholdPct: 3,
  slots: DEFAULT_SLOTS,
  lessons: DEFAULT_LESSONS,
  spotlightTickers: ['SCOM', 'EQTY', 'KCB', 'COOP', 'KEGN', 'EABL'],
  streamEnabled: false,
  streamRules: DEFAULT_RULES,
  streamDailyPostCap: 200,
  streamMonthlyUsdCap: 15,
  streamUnitUsd: 0.005,
};

/**
 * Written once, when no config row exists. Later edits on the X admin page are
 * not overwritten on restart. The stream stays off until a bearer token and a
 * spend cap have been checked by hand.
 */
export const STARTER_CONFIG: AutomationConfig = {
  ...DEFAULT_CONFIG,
  enabled: true,
  mode: 'live',
};

const TEMPLATE_SET = new Set<string>(SLOT_TEMPLATES);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function slotId(value: unknown, index: number): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const cleaned = raw.replace(/[^a-z0-9-]/g, '').slice(0, 40);
  return cleaned || `slot-${index + 1}`;
}

/** Fills anything missing or out of range with the defaults. Drops slots and rules that cannot be posted. */
export function normalizeConfig(input: unknown): AutomationConfig {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const base = DEFAULT_CONFIG;

  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map((d) => clampInt(d, -1, 0, 6)).filter((d) => d >= 0))].sort((a, b) => a - b)
    : base.days;

  const seen = new Set<string>();
  const slots: SlotDef[] = [];
  if (Array.isArray(raw.slots)) {
    raw.slots.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const row = item as Record<string, unknown>;
      const template = typeof row.template === 'string' ? row.template : '';
      if (!TEMPLATE_SET.has(template)) return;
      let id = slotId(row.id, index);
      while (seen.has(id)) id = `${id}-${slots.length + 1}`.slice(0, 40);
      seen.add(id);
      const slot: SlotDef = { id, enabled: row.enabled !== false, template: template as SlotTemplate };
      if (row.atMinute != null && row.atMinute !== '') slot.atMinute = clampInt(row.atMinute, 0, 0, 24 * 60 - 1);
      else if (row.hour != null && row.hour !== '') slot.hour = clampInt(row.hour, 12, 0, 23);
      else return;
      slots.push(slot);
    });
  }

  const lessons = Array.isArray(raw.lessons)
    ? raw.lessons
        .filter((l): l is string => typeof l === 'string')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.slice(0, 280))
        .slice(0, 30)
    : base.lessons;

  const spotlightTickers = Array.isArray(raw.spotlightTickers)
    ? [...new Set(raw.spotlightTickers.filter((t): t is string => typeof t === 'string').map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(0, 30)
    : base.spotlightTickers;

  const streamRules: StreamRule[] = [];
  if (Array.isArray(raw.streamRules)) {
    for (const item of raw.streamRules) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const tag = typeof row.tag === 'string' ? row.tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) : '';
      const value = typeof row.value === 'string' ? row.value.trim().slice(0, 512) : '';
      if (!tag || !value) continue;
      streamRules.push({ tag, value });
      if (streamRules.length >= 10) break;
    }
  }

  const mode = raw.mode === 'live' ? 'live' : 'draft';
  const credentialId = typeof raw.credentialId === 'string' && raw.credentialId.trim() ? raw.credentialId.trim() : null;

  return {
    enabled: raw.enabled === true,
    mode,
    credentialId,
    days: Array.isArray(raw.days) ? days : base.days,
    startMinute: clampInt(raw.startMinute, base.startMinute, 0, 24 * 60 - 1),
    endMinute: clampInt(raw.endMinute, base.endMinute, 0, 24 * 60 - 1),
    maxPostsPerDay: clampInt(raw.maxPostsPerDay, base.maxPostsPerDay, 0, 24),
    minGapMinutes: clampInt(raw.minGapMinutes, base.minGapMinutes, 0, 24 * 60),
    skipIfUnchanged: raw.skipIfUnchanged !== false,
    aiCompose: raw.aiCompose === true,
    moverThresholdPct: clampFloat(raw.moverThresholdPct, base.moverThresholdPct, 0, 20),
    slots: Array.isArray(raw.slots) ? slots : base.slots,
    lessons: Array.isArray(raw.lessons) ? lessons : base.lessons,
    spotlightTickers: Array.isArray(raw.spotlightTickers) ? spotlightTickers : base.spotlightTickers,
    streamEnabled: raw.streamEnabled === true,
    streamRules: Array.isArray(raw.streamRules) ? streamRules : base.streamRules,
    streamDailyPostCap: clampInt(raw.streamDailyPostCap, base.streamDailyPostCap, 0, 5000),
    streamMonthlyUsdCap: clampFloat(raw.streamMonthlyUsdCap, base.streamMonthlyUsdCap, 0, 500),
    streamUnitUsd: clampFloat(raw.streamUnitUsd, base.streamUnitUsd, 0, 1),
  };
}
