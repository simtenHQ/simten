import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findSimtenRepo, isSimtenRepo } from './repo-root.js';

function project(dir: string, { name, sentinel }: { name?: string; sentinel?: boolean }) {
  mkdirSync(dir, { recursive: true });
  if (name) writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }));
  if (sentinel) {
    mkdirSync(join(dir, 'hardware/ulx3s'), { recursive: true });
    writeFileSync(join(dir, 'hardware/ulx3s/run_on_fpga.ts'), '');
  }
  return dir;
}

describe('findSimtenRepo', () => {
  let root: string;
  let env: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'simten-repo-'));
    env = process.env.SIMTEN_REPO_ROOT;
    delete process.env.SIMTEN_REPO_ROOT;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (env === undefined) delete process.env.SIMTEN_REPO_ROOT;
    else process.env.SIMTEN_REPO_ROOT = env;
  });

  it('finds the repo from a folder deep inside it', () => {
    const repo = project(join(root, 'simten'), { name: 'simten', sentinel: true });
    const deep = join(repo, 'packages/mcp/src');
    mkdirSync(deep, { recursive: true });
    expect(findSimtenRepo(deep)).toBe(repo);
  });

  it('needs both the FPGA runner and the root package name', () => {
    expect(isSimtenRepo(project(join(root, 'a'), { sentinel: true, name: 'my-board' }))).toBe(
      false,
    );
    expect(isSimtenRepo(project(join(root, 'b'), { name: 'simten' }))).toBe(false);
    expect(isSimtenRepo(project(join(root, 'c'), { sentinel: true }))).toBe(false);
  });

  it('returns null in a project outside the repo', () => {
    expect(findSimtenRepo(project(join(root, 'app'), { name: 'app' }))).toBeNull();
  });

  it('takes SIMTEN_REPO_ROOT when it points at the repo', () => {
    const repo = project(join(root, 'simten'), { name: 'simten', sentinel: true });
    process.env.SIMTEN_REPO_ROOT = repo;
    expect(findSimtenRepo(project(join(root, 'app'), { name: 'app' }))).toBe(repo);
  });

  it('ignores SIMTEN_REPO_ROOT when it does not', () => {
    process.env.SIMTEN_REPO_ROOT = project(join(root, 'other'), { name: 'other' });
    expect(findSimtenRepo(project(join(root, 'app'), { name: 'app' }))).toBeNull();
  });
});
