/**
 * Host subprocess runner for `tsx`.
 *
 * Runs a TypeScript file on the HOST via `tsx` (full node + npm resolution, no
 * sandbox) and returns its output. This is the trusted local-agent path — same
 * trust model as the agent running `npm test`. Untrusted/shared circuits belong
 * in the web `/circuit` worker, not here.
 *
 * Pattern lifted from run_on_fpga.ts (spawn tsx / findRepoRoot / delimited-JSON
 * extraction); generalized so verify_circuit can reuse it.
 */

import { spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Project root: explicit env, else walk up from cwd for node_modules, else cwd. */
export function findRepoRoot(): string {
  const envRoot = process.env.SIMTEN_REPO_ROOT;
  if (envRoot && existsSync(resolve(envRoot, 'node_modules'))) return envRoot;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'node_modules'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Locate tsx: SIMTEN_TSX → <root>/node_modules/.bin/tsx → bare `tsx` on PATH. */
export function resolveTsx(root: string): string | null {
  if (process.env.SIMTEN_TSX) return process.env.SIMTEN_TSX;
  const local = resolve(root, 'node_modules/.bin/tsx');
  if (existsSync(local)) return local;
  return 'tsx'; // rely on PATH; spawn 'error' surfaces if absent
}

export interface HostRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  /** Set when tsx itself couldn't be launched (e.g. not installed). */
  spawnError?: string;
}

export function runTsx(
  scriptPath: string,
  opts: { env?: Record<string, string | undefined>; timeoutMs?: number; cwd?: string } = {},
): Promise<HostRunResult> {
  const root = opts.cwd ?? findRepoRoot();
  const tsx = resolveTsx(root);
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return new Promise((res) => {
    if (!tsx) {
      res({ stdout: '', stderr: '', exitCode: -1, timedOut: false, spawnError: 'tsx not found' });
      return;
    }
    const proc = spawn(tsx, [scriptPath], {
      cwd: root,
      env: { ...process.env, ...opts.env },
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (c: Buffer) => (stdout += c.toString('utf8')));
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
    proc.on('close', (code) => {
      clearTimeout(timer);
      res({ stdout, stderr, exitCode: code ?? -1, timedOut });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      res({ stdout, stderr, exitCode: -1, timedOut, spawnError: e.message });
    });
  });
}

/**
 * Check whether the given module specifiers are resolvable from the testbench's
 * directory (walking up node_modules per Node's standard resolution algorithm).
 *
 * Used by verify_circuit before spawning tsx so we can return a clear, actionable
 * "install these deps" error instead of a cryptic ERR_MODULE_NOT_FOUND from the
 * subprocess. The MCP itself bundles these deps for its own use, but the testbench
 * runs in the user's project context — Node's resolver only walks up from the
 * testbench file, never into the MCP's own install location.
 */
export function checkDepsResolvable(testbenchPath: string, deps: string[]): string[] {
  const absolute = resolve(testbenchPath);
  // createRequire takes a parent path/URL as resolution context. The file itself
  // doesn't have to exist — Node uses the path as the starting point for walking
  // up the directory tree looking for node_modules.
  const req = createRequire(pathToFileURL(absolute));
  const missing: string[] = [];
  for (const dep of deps) {
    try {
      req.resolve(dep);
    } catch {
      missing.push(dep);
    }
  }
  return missing;
}

/**
 * Detect the consumer project's package manager by walking up from the given
 * directory looking for a lockfile. Falls back to npm if nothing matches —
 * the install command will still work, the user may just prefer a different
 * tool. The order encodes our preference for unambiguous lockfile signals.
 */
export function detectPackageManager(startDir: string): 'pnpm' | 'yarn' | 'bun' | 'npm' {
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(dir, 'bun.lockb'))) return 'bun';
    if (existsSync(join(dir, 'package-lock.json'))) return 'npm';
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'npm';
}

/** Render the install command for the detected package manager. */
export function installCommand(pm: 'pnpm' | 'yarn' | 'bun' | 'npm', deps: string[]): string {
  const list = deps.join(' ');
  switch (pm) {
    case 'pnpm': return `pnpm add -D ${list}`;
    case 'yarn': return `yarn add -D ${list}`;
    case 'bun':  return `bun add -d ${list}`;
    case 'npm':  return `npm install -D ${list}`;
  }
}

/** Extract the last delimited JSON block from stdout (tolerant of surrounding noise). */
export function extractDelimitedJson<T>(stdout: string, begin: string, end: string): T | null {
  const start = stdout.lastIndexOf(begin);
  const stop = stdout.lastIndexOf(end);
  if (start < 0 || stop < 0 || stop < start) return null;
  try {
    return JSON.parse(stdout.slice(start + begin.length, stop).trim()) as T;
  } catch {
    return null;
  }
}
