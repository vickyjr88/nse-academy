/** Types and the pure rules of the renewal campaigns page: when a campaign may go out, and how results are worked out. */

export type Audience = 'free' | 'intermediary' | 'premium';

export interface AudienceInfo { audience: Audience; subject: string; count: number; skipped: number; total: number }

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentDate: string | null;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribed: number;
  bounced: number;
  complaints: number;
  subscriptionCampaign: boolean;
}

export interface Overview { audiences: AudienceInfo[]; queued: Campaign[]; sent: Campaign[]; error: string | null }

export const LABEL: Record<Audience, string> = { free: 'Free members', intermediary: 'Intermediary members', premium: 'Premium members' };
/** The plan's name, for sentences such as "the Premium email". */
export const PLAN: Record<Audience, string> = { free: 'Free', intermediary: 'Intermediary', premium: 'Premium' };

const EAT_MS = 3 * 3_600_000;
const MIN_LEAD_MS = 10 * 60_000;
const MAX_LEAD_MS = 30 * 24 * 3_600_000;

/** A "YYYY-MM-DDTHH:mm" Nairobi wall-clock time (what a datetime-local input holds) as a UTC ISO string. */
export function slotToIso(slot: string): string {
  return new Date(`${slot}:00+03:00`).toISOString();
}

/** The first Nairobi time at `hour`:00 that is far enough ahead to be accepted, optionally on a given weekday (1 = Monday). */
export function nextSlot(now: Date, hour: number, weekday?: number): string {
  const eat = new Date(now.getTime() + EAT_MS);
  for (let add = 0; add <= 14; add++) {
    const day = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate() + add));
    if (weekday !== undefined && day.getUTCDay() !== weekday) continue;
    const slot = `${day.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
    // A little over the server's minimum, so a preset does not expire while the page is being read.
    if (new Date(slotToIso(slot)).getTime() - now.getTime() >= MIN_LEAD_MS + 5 * 60_000) return slot;
  }
  throw new Error('no slot found');
}

export const PRESETS: { label: string; slot: (now: Date) => string }[] = [
  { label: 'Next 7:00 am', slot: (now) => nextSlot(now, 7) },
  { label: 'Next 6:00 pm', slot: (now) => nextSlot(now, 18) },
  { label: 'Monday 7:00 am', slot: (now) => nextSlot(now, 7, 1) },
];

function inWords(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} days`;
}

/** The same limits the API enforces, said while the time is being chosen instead of after pressing the button. */
export function checkSlot(slot: string, now: Date): { ok: boolean; message: string } {
  const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot) ? new Date(`${slot}:00+03:00`) : null;
  if (!at || Number.isNaN(at.getTime())) return { ok: false, message: 'Choose a date and a time.' };
  const lead = at.getTime() - now.getTime();
  if (lead < MIN_LEAD_MS) return { ok: false, message: 'That is less than 10 minutes away or already past. Pick a later time.' };
  if (lead > MAX_LEAD_MS) return { ok: false, message: 'That is more than 30 days away. Pick an earlier date.' };
  const when = at.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
  return { ok: true, message: `Goes out ${when} Nairobi time, ${inWords(lead)}.` };
}

/** A share in percent, or null when there is nothing to divide by. */
export const rate = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

export const rateText = (value: number | null): string => (value === null ? '–' : `${value.toFixed(1)}%`);
