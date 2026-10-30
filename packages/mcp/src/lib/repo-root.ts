/**
 * Locate the Simten repo, for the tools that only work inside it.
 *
 * `run_on_fpga` and `read_waveform` drive projects and read VCDs under
 * `hardware/ulx3s`, which exist only in a checkout of the Simten repo. The
 * server registers them only when it finds one, so an npm user's assistant
 * never lists tools it can't use.
 *
 * A directory is the repo when it holds both `hardware/ulx3s/run_on_fpga.ts`
 * and a `package.json` named `simten` (the monorepo root). Either alone is
 * too weak: a user's project could have its own `hardware/` folder, or be
 * named `simten`. The search starts at `SIMTEN_REPO_ROOT` when that is set and
 * qualifies, then walks up from the working directory to the filesystem root,
 * so a session started in `packages/mcp` or `hardware/ulx3s` still finds it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SENTINEL = 'hardware/ulx3s/run_on_fpga.ts';
const ROOT_PACKAGE_NAME = 'simten';

/** Whether `dir` is the root of a Simten repo checkout. */
export function isSimtenRepo(dir: string): boolean {
  if (!existsSync(resolve(dir, SENTINEL))) return false;
  try {
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
      name?: unknown;
    };
    return pkg.name === ROOT_PACKAGE_NAME;
  } catch {
    return false;
  }
}

/** The Simten repo root containing `from` (default: the working directory), or null. */
export function findSimtenRepo(from: string = process.cwd()): string | null {
  const envRoot = process.env.SIMTEN_REPO_ROOT;
  if (envRoot && isSimtenRepo(resolve(envRoot))) return resolve(envRoot);
  let dir = resolve(from);
  for (;;) {
    if (isSimtenRepo(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
