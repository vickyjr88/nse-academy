import React from 'react';
import { ChartPie } from '@strapi/icons';

const PLUGIN_ID = 'analytics-dashboard';

export const NSE_API_URL: string =
  (typeof process !== 'undefined' && process.env?.NSE_API_URL) ||
  'https://nseacademy-api.vitaldigitalmedia.net';

export const NSE_ADMIN_KEY: string =
  (typeof process !== 'undefined' && process.env?.NSE_ADMIN_KEY) || '';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: ChartPie,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Analytics',
      },
      permissions: [],
    });

    app.router.addRoute({
      path: `/plugins/${PLUGIN_ID}`,
      Component: React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard }))),
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return [];
  },
};
