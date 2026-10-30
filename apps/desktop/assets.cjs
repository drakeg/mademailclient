const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const routes = new Map([
  ['/packages/core/message-state.mjs',['packages/core/message-state.mjs','text/javascript']],
  ['/apps/web/mail-tools.mjs',['apps/web/mail-tools.mjs','text/javascript']],
  ['/apps/web/rule-editor.mjs',['apps/web/rule-editor.mjs','text/javascript']],
  ['/apps/web/composer.mjs',['apps/web/composer.mjs','text/javascript']],
  ['/packages/core/message-actions.mjs', ['packages/core/message-actions.mjs','text/javascript']],
  ['/apps/web/account-setup.mjs', ['apps/web/account-setup.mjs','text/javascript']],
  ['/packages/core/mailboxes.mjs', ['packages/core/mailboxes.mjs','text/javascript']],
  ['/', ['apps/web/index.html','text/html']],
  ['/apps/web/index.html', ['apps/web/index.html','text/html']],
  ['/apps/web/style.css', ['apps/web/style.css','text/css']],
  ['/apps/web/app.mjs', ['apps/web/app.mjs','text/javascript']],
  ['/packages/core/rules.mjs', ['packages/core/rules.mjs','text/javascript']],
]);
async function assetResponse(root, request) {
  const url = new URL(request.url);
  const asset = routes.get(url.pathname);
  if (request.method !== 'GET' || url.protocol !== 'mademail:' || url.host !== 'app' || !asset) return new Response('Not found', {status:404});
  try {return new Response(await readFile(join(root, asset[0])), {headers:{'Content-Type':asset[1], 'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'"}});}
  catch {return new Response('Not found', {status:404});}
}
module.exports = { assetResponse };
