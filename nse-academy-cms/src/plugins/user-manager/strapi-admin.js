// The admin entry. It is a .js file because, once the plugin is declared with `resolve` in config/plugins.ts (needed so
// its server-side proxy loads), Strapi looks for strapi-admin.js and does not pick up a .ts entry.
export { default } from './admin/src/index.tsx';
