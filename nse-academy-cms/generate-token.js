async function main() {
  const token = await strapi.service('admin::api-token').create({
    name: 'Seed Token ' + Date.now(),
    type: 'full-access',
    description: 'Temporary seed token',
  });
  console.log('TOKEN_CREATED:' + token.accessKey);
}

main();
