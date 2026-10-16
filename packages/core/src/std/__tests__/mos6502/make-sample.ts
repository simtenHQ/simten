/**
 * Writes harte-sample.json, the slice of Tom Harte's suite that runs in CI:
 * the first cases of every documented opcode, plus the first cases that cross
 * a page or run in decimal mode, so those paths are always covered.
 *
 *   npx tsx src/std/__tests__/mos6502/make-sample.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENTED_OPCODES, type HarteCase } from './harte.js';

const PER_OPCODE = 12;
const sample: HarteCase[] = [];
for (const op of DOCUMENTED_OPCODES) {
  const name = op.toString(16).padStart(2, '0');
  const cases: HarteCase[] = JSON.parse(
    readFileSync(join(import.meta.dirname, 'vectors', `${name}.json`), 'utf8'),
  );
  const picked = new Set(cases.slice(0, PER_OPCODE - 4));
  // Longest-running cases first: those take page-cross and branch-taken paths.
  const longest = Math.max(...cases.map((c) => c.cycles.length));
  for (const c of cases.filter((c) => c.cycles.length === longest).slice(0, 2)) picked.add(c);
  for (const c of cases.filter((c) => c.initial.p & 0x08).slice(0, 2)) picked.add(c);
  sample.push(...picked);
}
writeFileSync(
  join(import.meta.dirname, 'harte-sample.json'),
  `[\n${sample.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`,
);
console.log(`${sample.length} cases`);
