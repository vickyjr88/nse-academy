import React from 'react';
import { User } from '@strapi/icons';

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

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}`,
      Component: React.lazy(() => import('./pages/UsersList').then((m) => ({ default: m.UsersList }))),
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
