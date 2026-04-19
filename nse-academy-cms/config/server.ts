import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'https://nseacademy-admin.vitaldigitalmedia.net'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  proxy: true,
});

export default config;

