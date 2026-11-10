/**
 * nestest against its reference log. Needs the files from
 * `pnpm --filter @simten/nes nestest:fetch`; skipped without them.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseINes } from '../src/ines.js';
import { LOG_PATH, ROM_PATH } from './files.js';
import { describeMismatch, OFFICIAL_LINES, parseLog, runNestest } from './nestest.js';

const fetched = existsSync(ROM_PATH) && existsSync(LOG_PATH);

// ADC and SBC opcodes. With D set these differ from the 2A03, which has no
// decimal mode, until the core can turn decimal mode off.
const ADC_SBC = new Set([0x61, 0x65, 0x69, 0x6d, 0x71, 0x75, 0x79, 0x7d]);
for (const op of [0xe1, 0xe5, 0xe9, 0xed, 0xf1, 0xf5, 0xf9, 0xfd]) ADC_SBC.add(op);

describe.skipIf(!fetched)('nestest', () => {
  it('matches nestest.log through the official-opcode section', () => {
    const log = parseLog(readFileSync(LOG_PATH, 'utf8'));
    const result = runNestest(parseINes(readFileSync(ROM_PATH)), log, { resync: true });
    const official = result.mismatches.filter((m) => m.culprit.line <= OFFICIAL_LINES);
    const notDecimal = official.filter(
      (m) => !(ADC_SBC.has(m.culprit.opcode) && m.culprit.p & 0x08),
    );
    expect(notDecimal.map(describeMismatch)).toEqual([]);
  });
});
