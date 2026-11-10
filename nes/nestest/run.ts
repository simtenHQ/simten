/**
 * Runs nestest on the NES board and reports how far it matches nestest.log.
 *
 *   pnpm --filter @simten/nes nestest:fetch
 *   pnpm --filter @simten/nes nestest            # stop at the first mismatch
 *   pnpm --filter @simten/nes nestest --resync   # also tally unofficial opcodes
 */

import { existsSync, readFileSync } from 'node:fs';
import { parseINes } from '../src/ines.js';
import { LOG_PATH, ROM_PATH } from './files.js';
import { describeMismatch, type LogLine, OFFICIAL_LINES, parseLog, runNestest } from './nestest.js';

if (!existsSync(ROM_PATH) || !existsSync(LOG_PATH)) {
  console.error('nestest files missing: run `pnpm --filter @simten/nes nestest:fetch` first');
  process.exit(1);
}

const rom = parseINes(readFileSync(ROM_PATH));
const log = parseLog(readFileSync(LOG_PATH, 'utf8'));
const resync = process.argv.includes('--resync');

const start = performance.now();
const result = runNestest(rom, log, { resync });
const seconds = ((performance.now() - start) / 1000).toFixed(1);

const first = result.mismatches[0];
const firstLine = first ? first.expected.line : log.length + 1;
const official = Math.min(firstLine - 1, OFFICIAL_LINES);
console.log(`official section: ${official}/${OFFICIAL_LINES} lines match`);
console.log(`strict run: ${firstLine - 1}/${log.length} lines match before the first mismatch`);
if (first) console.log(describeMismatch(first));

if (resync) {
  const { passed, failed } = result.unofficial;
  // "*NOP 04": mnemonic and opcode byte, once per opcode.
  const name = (l: LogLine) => `${l.text.slice(16, 19)} ${l.text.slice(6, 8)}`;
  const opcodes = (lines: LogLine[]) => [...new Set(lines.map(name))].sort().join(', ');
  const before = result.mismatches.filter((m) => m.culprit.line <= OFFICIAL_LINES);
  const after = result.mismatches.filter((m) => m.culprit.line > OFFICIAL_LINES);
  console.log(`\nwith resync after each mismatch: ${result.matched}/${log.length} lines match`);
  console.log(`official section: ${before.length} mismatches`);
  for (const m of before) console.log(describeMismatch(m));
  console.log(`unofficial instructions: ${passed.length} pass, ${failed.length} fail`);
  console.log(`  passing opcodes: ${opcodes(passed) || 'none'}`);
  console.log(`  failing opcodes: ${opcodes(failed) || 'none'}`);
  const knockOn = after.filter((m) => !m.culprit.unofficial).length;
  console.log(`  official instructions failing after them (memory left wrong): ${knockOn}`);
}
console.log(`\n${seconds}s`);
process.exit(first && !first.culprit.unofficial ? 1 : 0);
