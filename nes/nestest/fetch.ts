/**
 * Downloads nestest.nes and nestest.log into ./.cache and checks their
 * sha256. Files already present with the right hash are skipped.
 *
 *   pnpm --filter @simten/nes nestest:fetch
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, FILES } from './files.js';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

mkdirSync(CACHE, { recursive: true });
for (const file of FILES) {
  const path = join(CACHE, file.name);
  if (existsSync(path) && sha256(readFileSync(path)) === file.sha256) continue;
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`${file.name}: HTTP ${res.status} from ${file.url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const hash = sha256(bytes);
  if (hash !== file.sha256) {
    throw new Error(`${file.name}: sha256 ${hash}, expected ${file.sha256}`);
  }
  writeFileSync(path, bytes);
  console.log(`fetched ${file.name}`);
}
console.log(`nestest files in ${CACHE}`);
