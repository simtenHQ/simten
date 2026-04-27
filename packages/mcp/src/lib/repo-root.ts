/**
 * Locate the simten repo root.
 *
 * Lifted from tools/run_on_fpga.ts so multiple tools can share the same
 * lookup. Prefers the SIMTEN_REPO_ROOT env var; otherwise walks up from
 * process.cwd() looking for hardware/ulx3s/run_on_fpga.ts.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SENTINEL = 'hardware/ulx3s/run_on_fpga.ts';

export function findRepoRoot(): string {
  const envRoot = process.env.SIMTEN_REPO_ROOT;
  if (envRoot && existsSync(resolve(envRoot, SENTINEL))) return envRoot;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, SENTINEL))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
