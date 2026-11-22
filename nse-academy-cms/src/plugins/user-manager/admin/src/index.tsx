import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { lazyPage } from './actor';
import { BASE, SECTIONS } from './sections';

const PLUGIN_ID = 'user-manager';

// The NSE API's address, used only to recognise calls that actor.tsx sends through Strapi's proxy.
const NSE_API_URL: string =
  (typeof process !== 'undefined' && process.env?.STRAPI_ADMIN_NSE_API_URL) ||
  'https://nseacademy-api.vitaldigitalmedia.net';

/** The admin key is NOT available in the browser any more (it lives on the Strapi server; see server/proxy.js). Kept
 * as an empty string so older page code that still names the header keeps compiling; the header is dropped in transit. */
const NSE_ADMIN_KEY = '';

export { NSE_API_URL, NSE_ADMIN_KEY };

type Route = { path: string; page: () => Promise<Record<string, any>>; name: string };

/**
 * Every page, by its path under the plugin. Static paths are listed with their detail pages; react-router ranks a fixed
 * segment above a parameter, so "members/profiles" is never taken for a member id. Sections and tabs: see sections.ts.
 */
const ROUTES: Route[] = [
  { path: 'overview', page: () => import('./pages/Overview'), name: 'OverviewPage' },
  { path: 'overview/audience', page: () => import('./pages/AnalyticsAdmin'), name: 'AnalyticsAdmin' },

  { path: 'members', page: () => import('./pages/UsersList'), name: 'UsersList' },
  { path: 'members/:id', page: () => import('./pages/UserDetail'), name: 'UserDetail' },
  { path: 'members/:id/portfolio', page: () => import('./pages/UserPortfolio'), name: 'UserPortfolio' },
  { path: 'members/profiles', page: () => import('./pages/InvestorProfilesList'), name: 'InvestorProfilesList' },
  { path: 'members/profiles/:id', page: () => import('./pages/InvestorProfileDetail'), name: 'InvestorProfileDetail' },
  { path: 'members/lessons', page: () => import('./pages/LessonProgressList'), name: 'LessonProgressList' },
  { path: 'members/lessons/:id', page: () => import('./pages/LessonProgressDetail'), name: 'LessonProgressDetail' },
  { path: 'members/portfolio-tools', page: () => import('./pages/PortfolioTools'), name: 'PortfolioTools' },
  { path: 'members/referrals', page: () => import('./pages/ReferralsList'), name: 'ReferralsList' },
  { path: 'members/referrals/:id', page: () => import('./pages/ReferralDetail'), name: 'ReferralDetail' },
  { path: 'members/advisors', page: () => import('./pages/AdvisorApprovals'), name: 'AdvisorApprovals' },
  { path: 'members/advisors/:id', page: () => import('./pages/AdvisorDetail'), name: 'AdvisorDetail' },
  { path: 'members/organizations', page: () => import('./pages/OrganizationsList'), name: 'OrganizationsList' },
  { path: 'members/organizations/new', page: () => import('./pages/CreateOrganization'), name: 'CreateOrganization' },
  { path: 'members/organizations/:id', page: () => import('./pages/OrganizationDetail'), name: 'OrganizationDetail' },

  { path: 'revenue', page: () => import('./pages/PaymentsAndSubscriptions'), name: 'PaymentsAndSubscriptions' },
  { path: 'revenue/ebooks', page: () => import('./pages/EbookPurchasesList'), name: 'EbookPurchasesList' },
  { path: 'revenue/ebooks/:id', page: () => import('./pages/EbookPurchaseDetail'), name: 'EbookPurchaseDetail' },
  { path: 'revenue/campaigns', page: () => import('./pages/CampaignsAdmin'), name: 'CampaignsAdmin' },

  { path: 'marketing', page: () => import('./pages/LeadsList'), name: 'LeadsList' },
  { path: 'marketing/:id', page: () => import('./pages/LeadDetail'), name: 'LeadDetail' },
  { path: 'marketing/inbox', page: () => import('./pages/ContactSubmissionsList'), name: 'ContactSubmissionsList' },
  { path: 'marketing/inbox/:id', page: () => import('./pages/ContactSubmissionDetail'), name: 'ContactSubmissionDetail' },
  { path: 'marketing/email', page: () => import('./pages/ComposeEmail'), name: 'ComposeEmail' },
  { path: 'marketing/reports', page: () => import('./pages/CampaignReports'), name: 'CampaignReports' },
  { path: 'marketing/automation', page: () => import('./pages/EngagementDashboard'), name: 'EngagementDashboard' },
  { path: 'marketing/tags', page: () => import('./pages/TagsAdmin'), name: 'TagsAdmin' },

  { path: 'market', page: () => import('./pages/StockPricesList'), name: 'StockPricesList' },
  { path: 'market/:ticker', page: () => import('./pages/StockPriceDetail'), name: 'StockPriceDetail' },
  { path: 'market/reports', page: () => import('./pages/MarketReportsAdmin'), name: 'MarketReportsAdmin' },
  { path: 'market/research', page: () => import('./pages/ResearchAdmin'), name: 'ResearchAdmin' },
  { path: 'market/models', page: () => import('./pages/ModelPortfoliosAdmin'), name: 'ModelPortfoliosAdmin' },
  { path: 'market/brokers', page: () => import('./pages/BrokersAdmin'), name: 'BrokersAdmin' },

  { path: 'system', page: () => import('./pages/SystemHealth'), name: 'SystemHealth' },
  { path: 'system/audit', page: () => import('./pages/AuditLog'), name: 'AuditLog' },
];

/** Old flat addresses (bookmarks, emails) still work: they forward to the page's new place. */
const LEGACY: Record<string, string> = {
  'ebook-purchases': 'revenue/ebooks',
  'investor-profiles': 'members/profiles',
  'lesson-progress': 'members/lessons',
  organizations: 'members/organizations',
  'advisor-approvals': 'members/advisors',
  referrals: 'members/referrals',
  'contact-submissions': 'marketing/inbox',
  leads: 'marketing',
  'stock-prices': 'market',
  'compose-email': 'marketing/email',
  engagement: 'marketing/automation',
  'campaign-reports': 'marketing/reports',
  payments: 'revenue',
  'market-reports': 'market/reports',
  brokers: 'market/brokers',
  'system-health': 'system',
  tags: 'marketing/tags',
  campaigns: 'revenue/campaigns',
  analytics: 'overview/audience',
  'audit-log': 'system/audit',
  'model-portfolios': 'market/models',
  research: 'market/research',
};

function LegacyUser() {
  const { id } = useParams();
  return <Navigate to={`${BASE}/members/${id}`} replace />;
}

export default {
  register(app: any) {
    // One sidebar entry per section; the section's own tabs switch between its pages.
    for (const s of SECTIONS) {
      app.addMenuLink({
        to: `plugins/${PLUGIN_ID}/${s.tabs[0].path}`,
        icon: s.icon,
        intlLabel: { id: `${PLUGIN_ID}.section.${s.id}`, defaultMessage: s.label },
        permissions: [],
      });
    }

    for (const r of ROUTES) {
      app.router.addRoute({ path: `plugins/${PLUGIN_ID}/${r.path}`, Component: lazyPage(r.page, r.name) });
    }

    app.router.addRoute({ path: `plugins/${PLUGIN_ID}`, Component: () => <Navigate to={`${BASE}/overview`} replace /> });
    for (const [from, to] of Object.entries(LEGACY)) {
      app.router.addRoute({ path: `plugins/${PLUGIN_ID}/${from}`, Component: () => <Navigate to={`${BASE}/${to}`} replace /> });
    }
    // An old user link was plugins/user-manager/<id>; last, so every fixed path above wins.
    app.router.addRoute({ path: `plugins/${PLUGIN_ID}/:id`, Component: LegacyUser });
  },

  async registerTrads() {
    return [];
  },
};
