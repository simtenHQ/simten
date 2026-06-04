import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import {
  detectPackageManager,
  ensurePackageJson,
  ensureTsconfig,
  isProjectReady,
  installCommand,
} from './project-setup.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'simten-setup-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const readPkg = () => JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));

describe('ensurePackageJson — extension policy', () => {
  it('empty folder → creates type:module package.json, uses .ts', () => {
    const plan = ensurePackageJson(dir);
    expect(plan).toMatchObject({ action: 'created', ext: '.ts' });
    expect(readPkg().type).toBe('module');
    expect(readPkg().private).toBe(true);
  });

  it('existing package.json with NO type → adds type:module, uses .ts', () => {
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'x' }));
    const plan = ensurePackageJson(dir);
    expect(plan).toMatchObject({ action: 'patched', ext: '.ts' });
    expect(readPkg().type).toBe('module');
  });

  it('existing type:module → unchanged, uses .ts', () => {
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'x', type: 'module' }));
    const plan = ensurePackageJson(dir);
    expect(plan).toMatchObject({ action: 'unchanged', ext: '.ts' });
  });

  it('explicit type:commonjs → NEVER clobbered, falls back to .mts', () => {
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'x', type: 'commonjs' }));
    const plan = ensurePackageJson(dir);
    expect(plan).toMatchObject({ action: 'unchanged', ext: '.mts' });
    expect(readPkg().type).toBe('commonjs'); // untouched
    expect(plan.note).toMatch(/commonjs/i);
  });

  it('unparseable package.json → untouched, .mts', () => {
    writeFileSync(resolve(dir, 'package.json'), '{ not json');
    const plan = ensurePackageJson(dir);
    expect(plan).toMatchObject({ action: 'unchanged', ext: '.mts' });
  });
});

describe('detectPackageManager', () => {
  it('defaults to npm with no lockfile', () => {
    expect(detectPackageManager(dir)).toBe('npm');
  });
  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ])('detects %s → %s', (lockfile, pm) => {
    writeFileSync(resolve(dir, lockfile), '');
    expect(detectPackageManager(dir)).toBe(pm);
  });
});

describe('isProjectReady', () => {
  it('false when framework deps are absent', () => {
    expect(isProjectReady(dir)).toBe(false);
  });
  it('true when both @simten/core and fast-check resolve', () => {
    mkdirSync(resolve(dir, 'node_modules', '@simten', 'core'), { recursive: true });
    mkdirSync(resolve(dir, 'node_modules', 'fast-check'), { recursive: true });
    expect(isProjectReady(dir)).toBe(true);
  });
  it('false when only one is present', () => {
    mkdirSync(resolve(dir, 'node_modules', '@simten', 'core'), { recursive: true });
    expect(isProjectReady(dir)).toBe(false);
  });
});

describe('ensureTsconfig', () => {
  it('writes a NodeNext tsconfig when absent, no-ops when present', () => {
    expect(ensureTsconfig(dir)).toBe(true);
    expect(JSON.parse(readFileSync(resolve(dir, 'tsconfig.json'), 'utf-8')).compilerOptions.moduleResolution).toBe('NodeNext');
    expect(ensureTsconfig(dir)).toBe(false);
  });
});

describe('installCommand', () => {
  it('npm uses install, others use add; bun uses -d', () => {
    expect(installCommand('npm')).toContain('npm install @simten/core fast-check');
    expect(installCommand('npm')).toContain('npm install -D tsx typescript');
    expect(installCommand('pnpm')).toContain('pnpm add @simten/core fast-check');
    expect(installCommand('pnpm')).toContain('pnpm add -D tsx typescript');
    expect(installCommand('bun')).toContain('bun add -d tsx typescript');
  });
});
