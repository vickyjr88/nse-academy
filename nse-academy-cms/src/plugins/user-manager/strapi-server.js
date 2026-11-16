'use strict';

const proxy = require('./server/proxy');

const route = (method) => ({
  method,
  path: '/proxy/(.*)',
  handler: 'proxy.forward',
  config: { policies: ['admin::isAuthenticatedAdmin'] },
});

module.exports = {
  register() {},
  bootstrap() {},
  controllers: { proxy },
  routes: {
    admin: {
      type: 'admin',
      routes: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(route),
    },
  },
};
