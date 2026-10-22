import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../scripts/release-assets.mjs',import.meta.url));
test('release gate rejects mismatched tags and missing targets before writing checksums',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mademail-release-'));
 try {
  await writeFile(join(root,'package.json'),JSON.stringify({version:'0.1.0-alpha.1'}));
  await mkdir(join(root,'release-assets'));
  const run=tag=>spawnSync(process.execPath,[script],{cwd:root,env:{...process.env,RELEASE_TAG:tag},encoding:'utf8'});
  assert.notEqual(run('v0.2.0-alpha.1').status,0);
  assert.notEqual(run('v0.1.0-alpha.1').status,0);
  for(const target of ['mac-arm64.dmg','mac-x64.dmg','win-x64.exe'])await writeFile(join(root,'release-assets',`Made-Mail-0.1.0-alpha.1-${target}`),'fixture');
  const result=run('v0.1.0-alpha.1');assert.equal(result.status,0,result.stderr);
  const sums=await readFile(join(root,'release-assets/SHA256SUMS.txt'),'utf8');
  assert.equal(sums.trim().split('\n').length,3);assert.match(sums,/^[a-f0-9]{64}  Made-Mail-/);
 }finally{await rm(root,{recursive:true,force:true});}
});
