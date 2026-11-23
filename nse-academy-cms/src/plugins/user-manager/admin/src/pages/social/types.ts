export interface PlatformInfo {
  id: string;
  label: string;
  needsMedia: boolean;
  textLimit: number;
}

export type HealthState = 'paused' | 'expired' | 'expiring' | 'untested' | 'ok';

export interface Account {
  id: string;
  platform: string;
  accountName: string;
  externalId: string | null;
  expiresAt: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  isActive: boolean;
  hasBearer?: boolean;
  hasRefreshToken?: boolean;
  health: { state: HealthState; daysLeft: number | null };
}

export interface Post {
  id: string;
  platform: string;
  externalPostId: string;
  url: string | null;
  content: string;
  mediaUrls: string[];
  status: 'published' | 'draft' | 'failed' | string;
  error: string | null;
  reportId: string | null;
  reportType?: string;
  publishedAt: string;
  credential?: { accountName: string };
}

export interface Summary {
  days: number;
  byDay: { day: string; published: number; failed: number; draft: number }[];
  byPlatform: { platform: string; published: number; failed: number; draft: number; successRate: number | null; lastPublishedAt: string | null }[];
  totals: { published: number; failed: number; draft: number; successRate: number | null };
  previous: { published: number; failed: number };
}

export interface AutomationLite {
  config: { enabled: boolean; mode: 'draft' | 'live'; platforms: { platform: string; enabled: boolean; credentialId: string | null }[] };
  runs: { slotId: string; status: string; createdAt: string; deliveries?: { platform: string; status: string; reason?: string }[] }[];
}

export type TabId = 'overview' | 'accounts' | 'post' | 'hourly' | 'history';

export interface Notify {
  (text: string, bad?: boolean): void;
}

export const PLATFORM_ORDER = ['x', 'facebook', 'instagram', 'threads', 'tiktok'];
