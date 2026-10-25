#!/usr/bin/env tsx
/**
 * Complexity ratchet: the number of functions over Biome's cognitive
 * complexity limit (biome.json, tests excluded) may only go down.
 *
 * scripts/complexity-baseline.txt lists today's offenders, one
 * `path name` per line. The check fails when a function is over the limit
 * and not in that list, and when the list names more functions than are
 * still over it (so a refactor lowers the baseline in the same PR).
 *
 *   pnpm check-complexity            # check
 *   pnpm check-complexity --update   # rewrite the baseline from the current code
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULE = 'lint/complexity/noExcessiveCognitiveComplexity';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repoRoot, 'scripts/complexity-baseline.txt');

type Diagnostic = {
  severity: string;
  category: string;
  location: { path: string; start: { line: number; column: number }; end: { column: number } };
};

const output = execFileSync(
  'pnpm',
  [
    'exec',
    'biome',
    'lint',
    `--only=${RULE.replace('lint/', '')}`,
    '--reporter=json',
    '--max-diagnostics=none',
  ],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  },
);
const { diagnostics } = JSON.parse(output) as { diagnostics: Diagnostic[] };

// Test files have the rule off in biome.json; `--only` still reports them as info.
const current = diagnostics
  .filter((d) => d.category === RULE && d.severity === 'warning')
  .map(({ location: { path, start, end } }) => {
    const line = readFileSync(join(repoRoot, path), 'utf8').split('\n')[start.line - 1] ?? '';
    const name = line.slice(start.column - 1, end.column - 1).trim();
    if (/^[\w$]+$/.test(name)) return `${path} ${name}`;
    // Arrow function: use the variable or property it is assigned to, if on the same line.
    const assigned = line.slice(0, start.column - 1).match(/([\w$]+)\s*[:=]\s*(async\s*)?\(/);
    return `${path} ${assigned?.[1] ?? '(anonymous)'}`;
  })
  .sort();

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, `${current.join('\n')}\n`);
  console.log(`Wrote ${current.length} entries to scripts/complexity-baseline.txt`);
  process.exit(0);
}

const baseline = readFileSync(baselinePath, 'utf8').split('\n').filter(Boolean);

// Multiset difference: entries in `a` not matched by an entry in `b`.
function minus(a: string[], b: string[]): string[] {
  const left = [...b];
  return a.filter((x) => {
    const i = left.indexOf(x);
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
}

const added = minus(current, baseline);
const fixed = minus(baseline, current);

if (added.length > 0) {
  console.error('New functions over the cognitive complexity limit (max 25, see biome.json):');
  for (const entry of added) console.error(`  ${entry}`);
  console.error(
    'Split them up. If you only renamed or moved one, run: pnpm check-complexity --update',
  );
  process.exit(1);
}
if (fixed.length > 0) {
  console.error('These functions are no longer over the limit:');
  for (const entry of fixed) console.error(`  ${entry}`);
  console.error('Lower the baseline: pnpm check-complexity --update');
  process.exit(1);
}
console.log(`Complexity ratchet OK: ${current.length} functions over the limit (baseline).`);
