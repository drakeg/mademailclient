import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/desktop-smoke.mjs <packaged executable>');
const profile = await mkdtemp(join(tmpdir(), 'mademail-smoke-'));
const env = { ...process.env, MADEMAIL_SMOKE_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(resolve(executable), ['--smoke-test'], { env, stdio: ['ignore','pipe','pipe'] });
let output = '';
child.stdout.on('data', data => { output += data; process.stdout.write(data); });
child.stderr.on('data', data => process.stderr.write(data));
const timeout = setTimeout(() => { child.kill(); }, 60000);
try {
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 && output.includes('DESKTOP_SMOKE_OK') ? resolve() : reject(new Error(`Packaged smoke test failed: code=${code} signal=${signal}`)));
  });
} finally { clearTimeout(timeout); await rm(profile, { recursive:true, force:true }); }
