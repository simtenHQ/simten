/**
 * Production builds of the sandbox, the game and the web app, served locally
 * with `vite preview`. Shared by the browser bench and the site checks.
 *
 * The web and game builds frame the sandbox from `VITE_SANDBOX_ORIGIN`, so a
 * sandbox change is exercised before it's deployed. The web build and its
 * preview need the root .env (Cloudflare credentials), like a normal web build.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

export type App = 'sandbox' | 'game' | 'web';

/** The environment for building and serving: the root .env (unless skipped), then this process's, then the sandbox origin. */
export function siteEnv(sandboxOrigin: string, { dotenv = true } = {}): NodeJS.ProcessEnv {
  const fromFile = dotenv
    ? Object.fromEntries(
        readFileSync(join(ROOT, '.env'), 'utf8')
          .split('\n')
          .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/))
          .filter((m) => m !== null)
          .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
      )
    : {};
  return { ...fromFile, ...process.env, VITE_SANDBOX_ORIGIN: sandboxOrigin };
}

export function buildApps(apps: App[], env: NodeJS.ProcessEnv): void {
  for (const app of apps) {
    console.log(`building ${app}…`);
    execSync('pnpm build', { cwd: join(ROOT, 'apps', app), env, stdio: 'ignore' });
  }
}

/** `vite preview` in its own process group, so `stopAll` can kill the whole tree. */
export function serveApp(app: App, port: number, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: join(ROOT, 'apps', app),
    env,
    stdio: 'ignore',
    detached: true,
  });
}

export function stopAll(servers: ChildProcess[]): void {
  for (const s of servers) {
    try {
      if (s.pid) process.kill(-s.pid);
    } catch {}
  }
}

export async function waitForUrl(url: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} didn't start`);
}
