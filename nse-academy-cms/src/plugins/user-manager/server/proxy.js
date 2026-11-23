'use strict';

/**
 * The admin pages never hold the NSE API's admin key. They call this route on Strapi (which has already checked that the
 * caller is a signed-in Strapi admin) and Strapi adds the key and forwards the call. Before this, the key was compiled
 * into the admin's JavaScript, which anyone can download without signing in.
 *
 * This file is plain JavaScript on purpose: tsconfig.json keeps src/plugins out of the server compilation, so a .ts file
 * here would never be loaded.
 */

// Only the parts of the NSE API the admin uses. Anything else is refused, so this cannot be turned into a general relay.
const ALLOWED = /^(admin|leads|contact|market-data\/sync|marketing)(\/|$)/;

function isAllowedPath(path) {
  if (!path || path.includes('..') || path.includes('\\') || path.includes('//') || /[\u0000-\u001f]/.test(path)) return false;
  return ALLOWED.test(path);
}

// Headers that describe the upstream connection, not the content, and must not be copied onto Strapi's own response.
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding', 'set-cookie']);

module.exports = ({ strapi }) => ({
  async forward(ctx) {
    const base = (process.env.NSE_API_URL || process.env.STRAPI_ADMIN_NSE_API_URL || '').replace(/\/$/, '');
    const key = process.env.ADMIN_API_KEY || '';
    if (!base || !key) return ctx.internalServerError('The NSE API connection is not configured on the server (NSE_API_URL, ADMIN_API_KEY).');

    const raw = (ctx.params && (ctx.params[0] || ctx.params.path)) || '';
    const path = String(raw).replace(/^\/+/, '');
    if (!isAllowedPath(path)) return ctx.notFound('Unknown admin API path.');

    // The browser's own query string, minus anything that looks like a credential.
    const query = new URLSearchParams(ctx.querystring || '');
    query.delete('x-admin-key');
    const qs = query.toString();
    const url = `${base}/${path}${qs ? `?${qs}` : ''}`;

    const method = ctx.method;
    const headers = { 'x-admin-key': key, 'x-admin-user': (ctx.state && ctx.state.user && ctx.state.user.email) || '' };
    let body;
    const parsed = ctx.request.body;
    if (!['GET', 'HEAD'].includes(method) && parsed && Object.keys(parsed).length > 0) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(parsed);
    }

    let res;
    try {
      res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60000) });
    } catch (err) {
      strapi.log.error(`NSE API proxy: ${err.message}`);
      return ctx.badGateway('The NSE API did not answer.');
    }

    ctx.status = res.status;
    res.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.has(name.toLowerCase())) ctx.set(name, value);
    });
    ctx.body = Buffer.from(await res.arrayBuffer());
  },
});

module.exports.isAllowedPath = isAllowedPath;
