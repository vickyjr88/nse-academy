import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'seo': {
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
  },
  'analytics-dashboard': {
    enabled: true,
  },
});

export default config;
