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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
