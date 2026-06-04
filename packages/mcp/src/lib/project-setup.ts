/**
 * Project setup helpers for `setup_project`.
 *
 * The MCP's design/simulate tools run in-process against the bundled
 * `@simten/core` and need nothing on disk. `verify_circuit`, by contrast,
 * shells out to `tsx` and resolves the testbench's imports from the USER's
 * folder — so a brand-new/empty folder needs `@simten/core` + `fast-check` +
 * `tsx` installed and an ESM `package.json` before verify can run.
 *
 * Rather than make the user discover that through a chain of cryptic errors
 * (the original first-run friction: failed verify → `npm init` → missing
 * `type: module` → retry), `setup_project` does it once, proactively: write a
 * correct `package.json`, install the deps, and report back. Standard Node
 * resolution from there on — no loader hooks, no format trickery.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Which testbench/circuit extension a project must use to load as ESM. */
export type CircuitExt = '.ts' | '.mts';

/** Detect the package manager from a lockfile; default npm (ships with Node). */
export function detectPackageManager(root: string): PackageManager {
  if (existsSync(resolve(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(resolve(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(resolve(root, 'bun.lockb'))) return 'bun';
  // package-lock.json or nothing → npm
  return 'npm';
}

/** The framework deps verify needs resolvable from the user's project. */
export const RUNTIME_DEPS = ['@simten/core', 'fast-check'] as const;
export const DEV_DEPS = ['tsx', 'typescript'] as const;

/** `verify` is runnable here iff the framework deps resolve from the project. */
export function isProjectReady(root: string): boolean {
  return existsSync(resolve(root, 'node_modules', '@simten', 'core')) &&
    existsSync(resolve(root, 'node_modules', 'fast-check'));
}

/** The exact manual install command, for docs / offline fallback. */
export function installCommand(pm: PackageManager): string {
  const add = pm === 'npm' ? 'install' : 'add';
  const dev = pm === 'bun' ? '-d' : '-D';
  return `${pm} ${add} ${RUNTIME_DEPS.join(' ')} && ${pm} ${add} ${dev} ${DEV_DEPS.join(' ')}`;
}

export interface PackageJsonPlan {
  /** 'created' (none existed), 'patched' (added type:module), 'unchanged'. */
  action: 'created' | 'patched' | 'unchanged';
  /** Extension circuit/verify files must use so they load as ESM. */
  ext: CircuitExt;
  /** Human note for the result, e.g. the commonjs escape-hatch explanation. */
  note?: string;
}

/**
 * Ensure `package.json` declares ESM, without ever clobbering an explicit
 * CommonJS project. Returns the plan + the extension circuits must use:
 *  - absent / no `type`  → make it `type: module`, use `.ts`
 *  - `type: module`      → leave it, use `.ts`
 *  - `type: commonjs`    → leave it, use `.mts` (ESM by extension, since every
 *                          file importing the ESM-only @simten/core must be ESM)
 */
export function ensurePackageJson(root: string): PackageJsonPlan {
  const pkgPath = resolve(root, 'package.json');

  if (!existsSync(pkgPath)) {
    const pkg = {
      name: sanitizeName(basename(root)),
      private: true,
      type: 'module',
    };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    return { action: 'created', ext: '.ts' };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    // Unparseable package.json — don't touch it; fall back to .mts so files are
    // ESM regardless of whatever's in there.
    return {
      action: 'unchanged',
      ext: '.mts',
      note: 'package.json could not be parsed; using .mts so testbenches load as ESM regardless.',
    };
  }

  if (pkg.type === 'commonjs') {
    return {
      action: 'unchanged',
      ext: '.mts',
      note: 'package.json is type:commonjs — leaving it untouched. Every file importing @simten/core (circuits and testbenches) must use the .mts extension so it loads as ESM.',
    };
  }

  if (pkg.type === 'module') {
    return { action: 'unchanged', ext: '.ts' };
  }

  // No type field → add it (safe for a fresh circuit project).
  pkg.type = 'module';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return {
    action: 'patched',
    ext: '.ts',
    note: 'Added "type": "module" to your existing package.json so .ts files load as ESM.',
  };
}

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  },
} as const;

/** Write a minimal NodeNext tsconfig for editor IntelliSense, if absent. */
export function ensureTsconfig(root: string): boolean {
  const p = resolve(root, 'tsconfig.json');
  if (existsSync(p)) return false;
  writeFileSync(p, JSON.stringify(TSCONFIG, null, 2) + '\n');
  return true;
}

export interface InstallResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/** Run a package-manager install of the given deps. */
export function runInstall(
  root: string,
  pm: PackageManager,
  deps: readonly string[],
  opts: { dev?: boolean; timeoutMs?: number } = {},
): Promise<InstallResult> {
  const add = pm === 'npm' ? 'install' : 'add';
  const flag = opts.dev ? [pm === 'bun' ? '-d' : '-D'] : [];
  const args = [add, ...flag, ...deps];
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return new Promise((res) => {
    // shell:true so the pm resolves cross-platform (npm → npm.cmd on Windows).
    // Args are fixed package names, not user input.
    const proc = spawn(pm, args, { cwd: root, shell: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout?.on('data', (c: Buffer) => (stdout += c.toString('utf8')));
    proc.stderr?.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
    proc.on('close', (code) => {
      clearTimeout(timer);
      res({ ok: code === 0 && !timedOut, stdout, stderr, exitCode: code ?? -1, timedOut });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      res({ ok: false, stdout, stderr: stderr + String(e), exitCode: -1, timedOut });
    });
  });
}

/** npm package names must be lowercase and url-safe; fall back to a default. */
function sanitizeName(raw: string): string {
  const name = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
  return name || 'simten-circuits';
}
