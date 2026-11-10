import React from 'react';
import { lazyPage } from './actor';
import { User, ShoppingCart, ChartPie, Book, Briefcase, Heart, Message, TrendUp, SealCheck, Mail, ChartBubble, ChartCircle, Cog, PriceTag, Layout, Hashtag, List, PresentationChart, Stack } from '@strapi/icons';

const PLUGIN_ID = 'user-manager';

// These are substituted at build time by Vite define or fall back to dev defaults
const NSE_API_URL: string =
  (typeof process !== 'undefined' && process.env?.STRAPI_ADMIN_NSE_API_URL) ||
  'https://nseacademy-api.vitaldigitalmedia.net';

const NSE_ADMIN_KEY: string =
  (typeof process !== 'undefined' && process.env?.STRAPI_ADMIN_NSE_KEY) || '';

export { NSE_API_URL, NSE_ADMIN_KEY };

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: User,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Users',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/ebook-purchases`,
      icon: ShoppingCart,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.ebook-purchases`,
        defaultMessage: 'Ebook Purchases',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/investor-profiles`,
      icon: ChartPie,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.investor-profiles`,
        defaultMessage: 'Investor Profiles',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/lesson-progress`,
      icon: Book,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.lesson-progress`,
        defaultMessage: 'Lesson Progress',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/organizations`,
      icon: Briefcase,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.organizations`,
        defaultMessage: 'Organizations',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/advisor-approvals`,
      icon: SealCheck,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.advisor-approvals`,
        defaultMessage: 'Advisor Approvals',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/referrals`,
      icon: Heart,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.referrals`,
        defaultMessage: 'Referrals',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/contact-submissions`,
      icon: Message,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.contact-submissions`,
        defaultMessage: 'Contact Submissions',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/leads`,
      icon: Mail,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.leads`,
        defaultMessage: 'Leads',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/stock-prices`,
      icon: TrendUp,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.stock-prices`,
        defaultMessage: 'Stock Prices',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/compose-email`,
      icon: Message,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.compose-email`,
        defaultMessage: 'Compose Email',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/engagement`,
      icon: ChartBubble,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.engagement`,
        defaultMessage: 'Engagement Automation',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/campaign-reports`,
      icon: ChartCircle,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.campaign-reports`,
        defaultMessage: 'Campaign Reports',
      },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/payments`,
      icon: PriceTag,
      intlLabel: { id: `${PLUGIN_ID}.plugin.payments`, defaultMessage: 'Payments & Subscriptions' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/market-reports`,
      icon: Layout,
      intlLabel: { id: `${PLUGIN_ID}.plugin.market-reports`, defaultMessage: 'Market Reports' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/brokers`,
      icon: Briefcase,
      intlLabel: { id: `${PLUGIN_ID}.plugin.brokers`, defaultMessage: 'Brokers' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/system-health`,
      icon: Cog,
      intlLabel: { id: `${PLUGIN_ID}.plugin.system-health`, defaultMessage: 'System Health' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/tags`,
      icon: Hashtag,
      intlLabel: { id: `${PLUGIN_ID}.plugin.tags`, defaultMessage: 'Tags' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/campaigns`,
      icon: Mail,
      intlLabel: { id: `${PLUGIN_ID}.plugin.campaigns`, defaultMessage: 'Subscription Campaigns' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/analytics`,
      icon: PresentationChart,
      intlLabel: { id: `${PLUGIN_ID}.plugin.analytics`, defaultMessage: 'Analytics' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/audit-log`,
      icon: List,
      intlLabel: { id: `${PLUGIN_ID}.plugin.audit-log`, defaultMessage: 'Audit Log' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/model-portfolios`,
      icon: Stack,
      intlLabel: { id: `${PLUGIN_ID}.plugin.model-portfolios`, defaultMessage: 'Model Portfolios' },
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/research`,
      icon: Message,
      intlLabel: { id: `${PLUGIN_ID}.plugin.research`, defaultMessage: 'Research' },
      permissions: [],
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/research`,
      Component: lazyPage(() => import('./pages/ResearchAdmin'), 'ResearchAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/model-portfolios`,
      Component: lazyPage(() => import('./pages/ModelPortfoliosAdmin'), 'ModelPortfoliosAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/tags`,
      Component: lazyPage(() => import('./pages/TagsAdmin'), 'TagsAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/campaigns`,
      Component: lazyPage(() => import('./pages/CampaignsAdmin'), 'CampaignsAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/analytics`,
      Component: lazyPage(() => import('./pages/AnalyticsAdmin'), 'AnalyticsAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/audit-log`,
      Component: lazyPage(() => import('./pages/AuditLog'), 'AuditLog'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}`,
      Component: lazyPage(() => import('./pages/UsersList'), 'UsersList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/ebook-purchases`,
      Component: lazyPage(() => import('./pages/EbookPurchasesList'), 'EbookPurchasesList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/investor-profiles`,
      Component: lazyPage(() => import('./pages/InvestorProfilesList'), 'InvestorProfilesList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/lesson-progress`,
      Component: lazyPage(() => import('./pages/LessonProgressList'), 'LessonProgressList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/organizations`,
      Component: lazyPage(() => import('./pages/OrganizationsList'), 'OrganizationsList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/organizations/new`,
      Component: lazyPage(() => import('./pages/CreateOrganization'), 'CreateOrganization'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/advisor-approvals`,
      Component: lazyPage(() => import('./pages/AdvisorApprovals'), 'AdvisorApprovals'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/referrals`,
      Component: lazyPage(() => import('./pages/ReferralsList'), 'ReferralsList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/contact-submissions`,
      Component: lazyPage(() => import('./pages/ContactSubmissionsList'), 'ContactSubmissionsList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/leads`,
      Component: lazyPage(() => import('./pages/LeadsList'), 'LeadsList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/stock-prices`,
      Component: lazyPage(() => import('./pages/StockPricesList'), 'StockPricesList'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/compose-email`,
      Component: lazyPage(() => import('./pages/ComposeEmail'), 'ComposeEmail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/engagement`,
      Component: lazyPage(() => import('./pages/EngagementDashboard'), 'EngagementDashboard'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/campaign-reports`,
      Component: lazyPage(() => import('./pages/CampaignReports'), 'CampaignReports'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/payments`,
      Component: lazyPage(() => import('./pages/PaymentsAndSubscriptions'), 'PaymentsAndSubscriptions'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/market-reports`,
      Component: lazyPage(() => import('./pages/MarketReportsAdmin'), 'MarketReportsAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/brokers`,
      Component: lazyPage(() => import('./pages/BrokersAdmin'), 'BrokersAdmin'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/system-health`,
      Component: lazyPage(() => import('./pages/SystemHealth'), 'SystemHealth'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/:id/portfolio`,
      Component: lazyPage(() => import('./pages/UserPortfolio'), 'UserPortfolio'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/organizations/:id`,
      Component: lazyPage(() => import('./pages/OrganizationDetail'), 'OrganizationDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/ebook-purchases/:id`,
      Component: lazyPage(() => import('./pages/EbookPurchaseDetail'), 'EbookPurchaseDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/investor-profiles/:id`,
      Component: lazyPage(() => import('./pages/InvestorProfileDetail'), 'InvestorProfileDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/lesson-progress/:id`,
      Component: lazyPage(() => import('./pages/LessonProgressDetail'), 'LessonProgressDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/referrals/:id`,
      Component: lazyPage(() => import('./pages/ReferralDetail'), 'ReferralDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/contact-submissions/:id`,
      Component: lazyPage(() => import('./pages/ContactSubmissionDetail'), 'ContactSubmissionDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/stock-prices/:ticker`,
      Component: lazyPage(() => import('./pages/StockPriceDetail'), 'StockPriceDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/leads/:id`,
      Component: lazyPage(() => import('./pages/LeadDetail'), 'LeadDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/advisor-approvals/:id`,
      Component: lazyPage(() => import('./pages/AdvisorDetail'), 'AdvisorDetail'),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/:id`,
      Component: lazyPage(() => import('./pages/UserDetail'), 'UserDetail'),
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return [];
  },
};
