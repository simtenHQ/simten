/**
 * Runs the full Tom Harte 6502 suite (10,000 cases per documented opcode)
 * against MOS6502_Core. Fetch the vectors first with fetch-harte.ts.
 *
 *   npx tsx src/std/__tests__/mos6502/run-harte.ts            # every opcode
 *   npx tsx src/std/__tests__/mos6502/run-harte.ts a9 7d      # some opcodes
 *   npx tsx src/std/__tests__/mos6502/run-harte.ts --limit 500
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHarteRunner, DOCUMENTED_OPCODES, type HarteCase } from './harte.js';

const args = process.argv.slice(2);
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Number.POSITIVE_INFINITY;
const picked = args.filter(
  (a, i) => /^[0-9a-f]{2}$/i.test(a) && (limitAt < 0 || i !== limitAt + 1),
);
const opcodes = picked.length ? picked.map((a) => Number.parseInt(a, 16)) : DOCUMENTED_OPCODES;

const runner = createHarteRunner();
let failedOps = 0;
let total = 0;
const started = Date.now();
for (const op of opcodes) {
  const name = op.toString(16).padStart(2, '0');
  const cases: HarteCase[] = JSON.parse(
    readFileSync(join(import.meta.dirname, 'vectors', `${name}.json`), 'utf8'),
  );
  let failures = 0;
  let first = '';
  const n = Math.min(cases.length, limit);
  for (let i = 0; i < n; i++) {
    const err = runner.run(cases[i]);
    if (err) {
      failures++;
      if (!first) first = `${cases[i].name}: ${err}`;
    }
  }
  total += n;
  if (failures) {
    failedOps++;
    console.log(`${name}  FAIL ${failures}/${n}  first: ${first}`);
  } else {
    console.log(`${name}  ok   ${n}`);
  }
}
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\n${opcodes.length - failedOps}/${opcodes.length} opcodes pass, ${total} cases, ${secs}s`,
);
process.exit(failedOps ? 1 : 0);
