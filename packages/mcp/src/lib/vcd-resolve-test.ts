/**
 * Resolve a `test_name` to the absolute path of its iverilog-emitted VCD.
 *
 * verify.ts (hardware/ulx3s/projects/cpu/verify.ts) writes per-test VCDs to
 *   <repo>/hardware/ulx3s/projects/cpu/.vcd/<slugify(test_name)>.vcd
 *
 * We use the same shared `slugify` so the read path matches the write path
 * byte-for-byte. Any drift between the two would break test_name lookups.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { slugify } from '@simten/core/util/test-name';
import { findRepoRoot } from './repo-root.js';

export const VCD_PROJECT_DIR_SUFFIX = 'hardware/ulx3s/projects/cpu/.vcd';

export interface TestNameResolution {
  path: string;
  slug: string;
}

/**
 * Returns the absolute path to the VCD for the given test name.
 * Throws if the file does not exist on disk.
 */
export function resolveTestName(name: string): TestNameResolution {
  const slug = slugify(name);
  const root = findRepoRoot();
  const path = resolve(root, VCD_PROJECT_DIR_SUFFIX, `${slug}.vcd`);
  if (!existsSync(path)) {
    throw new Error(
      `vcd_not_found: no VCD for test_name='${name}' (slug='${slug}'); expected at ${path}`,
    );
  }
  return { path, slug };
}
