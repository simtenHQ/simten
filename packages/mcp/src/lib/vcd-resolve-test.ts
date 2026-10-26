/**
 * Resolve a `test_name` to the absolute path of its iverilog-emitted VCD.
 *
 * verify.ts (hardware/ulx3s/projects/cpu/verify.ts) writes per-test VCDs to
 *   <repo>/hardware/ulx3s/projects/cpu/.vcd/<slugify(test_name)>.vcd
 *
 * `slugify` must match the writer's byte-for-byte (see test-name.ts). Any drift
 * between the two would break test_name lookups.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findRepoRoot } from './repo-root.js';
import { slugify } from './test-name.js';

export const VCD_PROJECT_DIR_SUFFIX = 'hardware/ulx3s/projects/cpu/.vcd';

export interface TestNameResolution {
  path: string;
  slug: string;
}

/**
 * Returns the absolute path to the VCD for the given test name.
 * Throws if the file does not exist on disk.
 */
export function resolveTestName(name: string, root = findRepoRoot()): TestNameResolution {
  const slug = slugify(name);
  const path = resolve(root, VCD_PROJECT_DIR_SUFFIX, `${slug}.vcd`);
  if (!existsSync(path)) {
    throw new Error(
      `vcd_not_found: no VCD for test_name='${name}' (slug='${slug}'); expected at ${path}`,
    );
  }
  return { path, slug };
}
