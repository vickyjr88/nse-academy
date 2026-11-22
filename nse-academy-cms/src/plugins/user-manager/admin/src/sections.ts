import type { ComponentType } from 'react';
import { PresentationChart, User, PriceTag, Mail, TrendUp, Cog } from '@strapi/icons';

/** Where the plugin's pages live inside the Strapi admin. */
export const BASE = '/plugins/user-manager';

export interface Tab {
  id: string;
  label: string;
  /** Path under BASE. The tab is active for this path and anything below it (its detail pages). */
  path: string;
}

export interface Section {
  id: string;
  label: string;
  icon: ComponentType<any>;
  tabs: Tab[];
}

/**
 * The admin's navigation. The sidebar shows one entry per section (it used to show 25 flat links); inside a section, tabs
 * switch between the pages that belong together. A detail page (a user, a lead, an organisation...) keeps its section's
 * tabs, with the tab it came from highlighted.
 */
export const SECTIONS: Section[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: PresentationChart,
    tabs: [
      { id: 'overview', label: 'Overview', path: 'overview' },
      { id: 'audience', label: 'Audience & traffic', path: 'overview/audience' },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    icon: User,
    tabs: [
      { id: 'users', label: 'Members', path: 'members' },
      { id: 'profiles', label: 'Investor profiles', path: 'members/profiles' },
      { id: 'lessons', label: 'Learning progress', path: 'members/lessons' },
      { id: 'portfolio-tools', label: 'Portfolio tools', path: 'members/portfolio-tools' },
      { id: 'referrals', label: 'Referrals', path: 'members/referrals' },
      { id: 'advisors', label: 'Advisers', path: 'members/advisors' },
      { id: 'organizations', label: 'Organisations', path: 'members/organizations' },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: PriceTag,
    tabs: [
      { id: 'payments', label: 'Payments & plans', path: 'revenue' },
      { id: 'ebooks', label: 'Ebook sales', path: 'revenue/ebooks' },
      { id: 'renewals', label: 'Renewal campaigns', path: 'revenue/campaigns' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Mail,
    tabs: [
      { id: 'leads', label: 'Leads', path: 'marketing' },
      { id: 'inbox', label: 'Contact messages', path: 'marketing/inbox' },
      { id: 'email', label: 'Send email', path: 'marketing/email' },
      { id: 'reports', label: 'Email reports', path: 'marketing/reports' },
      { id: 'automation', label: 'Lifecycle emails', path: 'marketing/automation' },
      { id: 'tags', label: 'Tags', path: 'marketing/tags' },
    ],
  },
  {
    id: 'market',
    label: 'Market & content',
    icon: TrendUp,
    tabs: [
      { id: 'prices', label: 'Stock prices', path: 'market' },
      { id: 'reports', label: 'Market reports', path: 'market/reports' },
      { id: 'research', label: 'Research', path: 'market/research' },
      { id: 'models', label: 'Model portfolios', path: 'market/models' },
      { id: 'brokers', label: 'Brokers', path: 'market/brokers' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Cog,
    tabs: [
      { id: 'health', label: 'Health & jobs', path: 'system' },
      { id: 'audit', label: 'Audit log', path: 'system/audit' },
    ],
  },
];

/** The section and tab a pathname (e.g. "/plugins/user-manager/members/ab12") belongs to: the longest matching tab path wins. */
export function locate(pathname: string): { section: Section; tab: Tab } | null {
  const rest = pathname.replace(/^\/+/, '').replace(/^plugins\/user-manager\/?/, '').replace(/\/+$/, '');
  let best: { section: Section; tab: Tab } | null = null;
  for (const section of SECTIONS) {
    for (const tab of section.tabs) {
      if (rest === tab.path || rest.startsWith(`${tab.path}/`)) {
        if (!best || tab.path.length > best.tab.path.length) best = { section, tab };
      }
    }
  }
  return best;
}

/** Full admin URL for a path under the plugin. */
export const href = (path: string) => `${BASE}/${path}`.replace(/\/+$/, '');
