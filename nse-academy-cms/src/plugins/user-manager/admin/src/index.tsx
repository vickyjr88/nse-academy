import React from 'react';
import { User, ShoppingCart, ChartPie, Book, Briefcase, Heart, Message, TrendUp } from '@strapi/icons';

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
      to: `plugins/${PLUGIN_ID}/stock-prices`,
      icon: TrendUp,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.stock-prices`,
        defaultMessage: 'Stock Prices',
      },
      permissions: [],
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}`,
      Component: React.lazy(() => import('./pages/UsersList').then((m) => ({ default: m.UsersList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/ebook-purchases`,
      Component: React.lazy(() => import('./pages/EbookPurchasesList').then((m) => ({ default: m.EbookPurchasesList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/investor-profiles`,
      Component: React.lazy(() => import('./pages/InvestorProfilesList').then((m) => ({ default: m.InvestorProfilesList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/lesson-progress`,
      Component: React.lazy(() => import('./pages/LessonProgressList').then((m) => ({ default: m.LessonProgressList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/organizations`,
      Component: React.lazy(() => import('./pages/OrganizationsList').then((m) => ({ default: m.OrganizationsList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/referrals`,
      Component: React.lazy(() => import('./pages/ReferralsList').then((m) => ({ default: m.ReferralsList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/contact-submissions`,
      Component: React.lazy(() => import('./pages/ContactSubmissionsList').then((m) => ({ default: m.ContactSubmissionsList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/stock-prices`,
      Component: React.lazy(() => import('./pages/StockPricesList').then((m) => ({ default: m.StockPricesList }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/organizations/:id`,
      Component: React.lazy(() => import('./pages/OrganizationDetail').then((m) => ({ default: m.OrganizationDetail }))),
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/:id`,
      Component: React.lazy(() => import('./pages/UserDetail').then((m) => ({ default: m.UserDetail }))),
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return [];
  },
};
