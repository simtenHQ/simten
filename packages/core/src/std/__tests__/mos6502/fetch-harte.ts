/**
 * Downloads Tom Harte's 6502 SingleStepTests for the documented opcodes into
 * ./vectors (about 650 MB, gitignored). Files already present are skipped.
 *
 *   npx tsx src/std/__tests__/mos6502/fetch-harte.ts
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENTED_OPCODES } from './harte.js';

const BASE = 'https://raw.githubusercontent.com/SingleStepTests/65x02/main/6502/v1';
const DIR = join(import.meta.dirname, 'vectors');

mkdirSync(DIR, { recursive: true });
for (const op of DOCUMENTED_OPCODES) {
  const name = `${op.toString(16).padStart(2, '0')}.json`;
  const path = join(DIR, name);
  if (existsSync(path)) continue;
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${name}`);
}
console.log(`${DOCUMENTED_OPCODES.length} opcode files in ${DIR}`);
