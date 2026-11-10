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

describe.skipIf(!fetched)('nestest', () => {
  it('matches nestest.log through the official-opcode section', () => {
    const log = parseLog(readFileSync(LOG_PATH, 'utf8'));
    const result = runNestest(parseINes(readFileSync(ROM_PATH)), log, { resync: true });
    const official = result.mismatches.filter((m) => m.culprit.line <= OFFICIAL_LINES);
    expect(official.map(describeMismatch)).toEqual([]);
  });
});
