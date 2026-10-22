import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {assetResponse}=createRequire(import.meta.url)('../apps/desktop/assets.cjs');
const root=new URL('..',import.meta.url).pathname;
test('desktop serves bundled interface with a restrictive policy',async()=>{const r=await assetResponse(root,{url:'mademail://app/',method:'GET'});assert.equal(r.status,200);assert.match(await r.text(),/Made Mail/);assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'none'/);});
test('desktop exposes only allowlisted assets on its own origin',async()=>{for(const url of ['mademail://app/package.json','mademail://other/apps/web/app.mjs','https://app/apps/web/app.mjs','mademail://app/.git/config'])assert.equal((await assetResponse(root,{url,method:'GET'})).status,404);assert.equal((await assetResponse(root,{url:'mademail://app/',method:'POST'})).status,404);});
test('desktop serves shared rules module as JavaScript',async()=>{const r=await assetResponse(root,{url:'mademail://app/packages/core/rules.mjs',method:'GET'});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'text/javascript');});
