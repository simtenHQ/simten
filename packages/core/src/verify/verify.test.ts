/**
 * Harness tests — run each fixture `.verify.ts` via tsx as a subprocess (its real
 * mode) and assert on the delimited JSON block + exit code. Subprocesses give each
 * test a fresh module state, which the module-singleton harness needs.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERIFY_JSON_BEGIN, VERIFY_JSON_END } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const tsxBin = resolve(repoRoot, 'node_modules/.bin/tsx');
const fixtures = resolve(here, '__fixtures__');

function runFixture(name: string, env: Record<string, string> = {}) {
  // Strip VITEST from the child env — otherwise the fixture's harness runs in
  // vitest-mode (throws) instead of its real tsx-mode (emit JSON + exit code).
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  delete childEnv.VITEST;
  delete childEnv.VITEST_POOL_ID;
  delete childEnv.VITEST_WORKER_ID;
  const r = spawnSync(tsxBin, [resolve(fixtures, name)], {
    cwd: repoRoot,
    env: childEnv,
    encoding: 'utf8',
  });
  const out = r.stdout ?? '';
  const start = out.lastIndexOf(VERIFY_JSON_BEGIN);
  const end = out.lastIndexOf(VERIFY_JSON_END);
  const json =
    start >= 0 && end > start
      ? JSON.parse(out.slice(start + VERIFY_JSON_BEGIN.length, end).trim())
      : undefined;
  return { json, status: r.status, stdout: out, stderr: r.stderr ?? '' };
}

describe('verify harness (via tsx subprocess)', () => {
  it('passing testbench → testbench_passed:true, oracle echoed, exit 0', () => {
    const { json, status } = runFixture('pass.verify.ts');
    expect(json, 'expected a JSON block').toBeDefined();
    expect(json.testbench_passed).toBe(true);
    expect(json.oracle.tier).toBe('B');
    expect(json.checks[0]).toMatchObject({ strategy: 'exhaustive', count: 4, passed: true });
    expect(json.caveat).toContain('FPGA');
    expect(status).toBe(0);
  });

  it('failing testbench → testbench_passed:false + shrunk counterexample, exit 1', () => {
    const { json, status } = runFixture('fail.verify.ts');
    expect(json.testbench_passed).toBe(false);
    expect(json.failures).toHaveLength(1);
    expect(json.failures[0].counterexample.inputs).toEqual([true, true]); // a&b is the only carry case
    expect(status).toBe(1);
  });

  it('no oracle → phase:contract gate, exit nonzero', () => {
    const { json, status } = runFixture('no-oracle.verify.ts');
    expect(json.phase).toBe('contract');
    expect(json.verify_error).toMatch(/oracle/);
    expect(json.testbench_passed).toBeUndefined();
    expect(status).not.toBe(0);
  });

  it('oracle injected via SIMTEN_VERIFY_ORACLE → same file now passes (tool precedence)', () => {
    const oracle = JSON.stringify({
      tier: 'B',
      type: 'injected',
      independence_basis: 'tool param',
    });
    const { json, status } = runFixture('no-oracle.verify.ts', { SIMTEN_VERIFY_ORACLE: oracle });
    expect(json.testbench_passed).toBe(true);
    expect(json.oracle.type).toBe('injected');
    expect(status).toBe(0);
  });

  it('flagship: an npm package (sha256) as a Tier-A oracle resolves and passes', () => {
    // The reason verify runs on the host: @noble/hashes resolves from node_modules
    // with no esbuild/stripImports. Independent (external) reference → Tier A.
    const { json, status } = runFixture('flagship-npm-oracle.verify.ts');
    expect(json.testbench_passed).toBe(true);
    expect(json.oracle.tier).toBe('A');
    expect(json.checks[0]).toMatchObject({ count: 4, passed: true });
    expect(status).toBe(0);
  });

  it('forgot verify.run() → beforeExit emits phase:contract, exit nonzero', () => {
    const { json, status } = runFixture('forgot-run.verify.ts');
    expect(json.phase).toBe('contract');
    expect(json.verify_error).toMatch(/run\(\)/);
    expect(status).not.toBe(0);
  });
});
