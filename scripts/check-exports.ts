#!/usr/bin/env tsx
/**
 * Drift lint: verify each workspace package's `exports` and
 * `publishConfig.exports` stay in sync.
 *
 * Run via `pnpm test` (and CI). Catches the class of bug where someone adds
 * a new export key but forgets the matching publishConfig entry, or where
 * `files` doesn't include the publish output dir.
 *
 * Four checks per package with `publishConfig.exports`:
 *   1. Key sets are equal
 *   2. Every dev-export path exists on disk (publish-only ./dist/* paths skip)
 *   3. Shape correspondence: ./src/<segs>/index.<ext> ↔ ./dist/<same-segs>/index.<ext'>
 *      Skipped for entries that don't fit the 1:1 shape (bundler outputs).
 *   4. `files` includes "dist" if any publishConfig.exports path points there
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const PACKAGE_JSONS = [
  'packages/core/package.json',
  'packages/ui/package.json',
  'packages/embed/package.json',
  'packages/mcp/package.json',
];

type ExportEntry = string | { types?: string; import?: string; default?: string; require?: string };
type ExportsMap = Record<string, ExportEntry>;

const failures: string[] = [];

function fail(pkg: string, msg: string): void {
  failures.push(`${pkg}: ${msg}`);
}

function entryPath(
  entry: ExportEntry,
  key: 'import' | 'default' | 'types' = 'import',
): string | undefined {
  if (typeof entry === 'string') return entry;
  return entry[key] ?? entry.default ?? entry.import;
}

function checkPackage(relPath: string): void {
  const absPath = join(repoRoot, relPath);
  const pkg = JSON.parse(readFileSync(absPath, 'utf8'));
  const name: string = pkg.name ?? relPath;
  const pkgDir = dirname(absPath);

  const dev: ExportsMap | undefined = pkg.exports;
  const pub: ExportsMap | undefined = pkg.publishConfig?.exports;

  if (!pub) return; // not opted into the pattern; skip

  if (!dev) {
    fail(name, 'has publishConfig.exports but no exports');
    return;
  }

  // Check 1: key-set equality
  const devKeys = new Set(Object.keys(dev));
  const pubKeys = new Set(Object.keys(pub));
  for (const k of devKeys) {
    if (!pubKeys.has(k)) fail(name, `exports has key '${k}' but publishConfig.exports does not`);
  }
  for (const k of pubKeys) {
    if (!devKeys.has(k)) fail(name, `publishConfig.exports has key '${k}' but exports does not`);
  }

  // Check 2: source path existence
  for (const [k, entry] of Object.entries(dev)) {
    const path = entryPath(entry);
    if (!path) {
      fail(name, `exports['${k}'] has no resolvable path`);
      continue;
    }
    if (path.startsWith('./dist/')) continue; // publish-only asset (e.g. compiled CSS)
    const fileAbs = join(pkgDir, path);
    if (!existsSync(fileAbs)) {
      fail(name, `exports['${k}'] points at ${path} which does not exist`);
    }
  }

  // Check 3: constrained shape correspondence
  const indexShape = /^\.\/(?:src|dist)\/(.+)\/index\.[a-z]+$/;
  for (const k of devKeys) {
    if (!pubKeys.has(k)) continue;
    const devPath = entryPath(dev[k]);
    const pubPath = entryPath(pub[k]);
    if (!devPath || !pubPath) continue;
    const devMatch = devPath.match(/^\.\/src\/(.+)\/index\.[a-z]+$/);
    const pubMatch = pubPath.match(/^\.\/dist\/(.+)\/index\.[a-z]+$/);
    if (!devMatch || !pubMatch) continue; // not 1:1 shape; skip (bundler output, etc.)
    if (devMatch[1] !== pubMatch[1]) {
      fail(
        name,
        `exports['${k}'] points at src/${devMatch[1]}/index.* but publishConfig.exports['${k}'].import points at dist/${pubMatch[1]}/index.* — segment mismatch (${devMatch[1]} vs ${pubMatch[1]})`,
      );
    }
  }

  // Check 4: files includes the publish output dir
  const files: string[] = pkg.files ?? [];
  const referencesDist = Object.values(pub).some((e) => {
    const p = entryPath(e);
    return p?.startsWith('./dist/');
  });
  if (referencesDist && !files.includes('dist')) {
    fail(
      name,
      `publishConfig.exports references ./dist/* but 'files' (${JSON.stringify(files)}) does not include 'dist'`,
    );
  }
}

for (const p of PACKAGE_JSONS) {
  checkPackage(p);
}

if (failures.length > 0) {
  console.error('check-exports: drift detected\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`check-exports: ${PACKAGE_JSONS.length} packages clean`);
