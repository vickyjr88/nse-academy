import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'strapi-plugin-seo': {
    enabled: true,
  },
  'insights-strapi': {
    enabled: true,
  },
  'strapi-google-analytics-dashboard': {
    enabled: true,
    config: {
      propertyId: env('GA_PROPERTY_ID'),
      serviceAccountCredentials: {
        client_email: env('GA_CLIENT_EMAIL'),
        private_key: env('GA_PRIVATE_KEY'),
      },
    },
  },
  'user-manager': {
    enabled: true,
    resolve: './src/plugins/user-manager',
  },
});

export default config;
