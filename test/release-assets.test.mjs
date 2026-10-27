import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/release-assets.mjs', import.meta.url));
test('release collection requires every installer and hashes exact bytes', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'mademail-release-'));
  try {
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ version:'0.1.0-alpha.4' }));
    await mkdir(join(cwd,'release-assets'));
    const names = ['mac-arm64.dmg','mac-x64.dmg','win-x64.exe','linux-x64.AppImage','linux-x64.deb'].map(n=>`Made-Mail-0.1.0-alpha.4-${n}`);
    const run = tag => spawnSync(process.execPath, [script], { cwd, env:{...process.env, RELEASE_TAG:tag}, encoding:'utf8' });
    for (const name of names.slice(0,-1)) await writeFile(join(cwd,'release-assets',name),'abc');
    assert.notEqual(run('v0.1.0-alpha.4').status,0, 'missing DEB must block release');
    await writeFile(join(cwd,'release-assets',names.at(-1)),'abc');
    assert.notEqual(run('v0.1.0-alpha.3').status,0, 'mismatched tag must block release');
    assert.equal(run('v0.1.0-alpha.4').status,0);
    const lines=(await readFile(join(cwd,'release-assets/SHA256SUMS.txt'),'utf8')).trim().split('\n');
    assert.equal(lines.length,5);
    for(const name of names) assert.ok(lines.includes(`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  ${name}`));
  } finally { await rm(cwd,{recursive:true,force:true}); }
});
