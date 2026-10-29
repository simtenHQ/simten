/**
 * Prepares the e2e run: builds the sandbox and a production build of the embed
 * page pointed at that local sandbox, then seeds local KV with one share.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SANDBOX, SHARE_ID_FILE, SOURCE, STATE_DIR } from './setup.ts';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync(cmd, args, { cwd: appDir, stdio: 'inherit', env: { ...process.env, ...env } });

run('pnpm', ['--filter', '@simten/sandbox-app', 'build']);
run('pnpm', ['exec', 'vite', 'build'], { VITE_SANDBOX_ORIGIN: SANDBOX });

rmSync(STATE_DIR, { recursive: true, force: true });
mkdirSync(STATE_DIR, { recursive: true });
// hashSource from @simten/react/share, which Node can't import directly (lz-string is CommonJS).
const id = createHash('sha256').update(SOURCE).digest('hex').slice(0, 20);
const sourceFile = `${STATE_DIR}/source.ts`;
writeFileSync(sourceFile, SOURCE);
// Into both the namespace and its preview id: which one local dev reads has
// changed between wrangler versions.
for (const preview of ['true', 'false']) {
  run('pnpm', [
    'exec',
    'wrangler',
    'kv',
    'key',
    'put',
    id,
    '--path',
    sourceFile,
    '--binding',
    'CIRCUIT_SHARES',
    `--preview=${preview}`,
    '--local',
    '--persist-to',
    STATE_DIR,
  ]);
}
writeFileSync(SHARE_ID_FILE, id);
