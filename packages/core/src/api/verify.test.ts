/**
 * verifyCircuit tests
 *
 * Each test preserves its reasoning inline — a future engineer considering
 * deletion should see the argument for keeping it, not just an assertion.
 */

import { describe, it, expect } from 'vitest';
import { verifyCircuit, type VerifyResult, type VerifyError } from './verify.js';
import { stripImports } from '../circuit/execute.js';

const HALF_ADDER = `
const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});
`;

const ORACLE = {
  tier: 'B' as const,
  type: 'behavioral reference sum=a^b, carry=a&b',
  independence_basis: 'reference is plain JS, decorrelated from the gate structure',
};

const ok = (r: VerifyResult | VerifyError): VerifyResult => {
  if ('error' in r) throw new Error(`unexpected VerifyError(${r.phase}): ${r.error}`);
  return r;
};

describe('verifyCircuit', () => {
  it('passes a correct Tier-B reference and echoes the oracle verbatim', () => {
    const r = ok(verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      testbench: `
        verify.check('sum=a^b, carry=a&b', fc.property(fc.boolean(), fc.boolean(), (a, b) => {
          const sim = simulate(HalfAdder);
          try {
            sim.set({ a: a ? 1 : 0, b: b ? 1 : 0 });
            return sim.get('sum') === ((a ? 1 : 0) ^ (b ? 1 : 0))
                && sim.get('carry') === ((a && b) ? 1 : 0);
          } finally { sim.dispose(); }
        }));
      `,
    }));
    expect(r.testbench_passed).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.oracle).toEqual(ORACLE); // surfaced for auditing, not inferred
    expect(r.caveat).toContain('FPGA');
    expect(r.checks[0]).toMatchObject({ strategy: 'sampled', passed: true });
  });

  it('returns a shrunk counterexample when a property fails', () => {
    // Buggy reference (claims carry is always 0) so the property must fail and
    // fast-check must hand back the minimal failing input — the agent's gradient.
    const r = ok(verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      testbench: `
        verify.check('wrong: carry always 0', fc.property(fc.boolean(), fc.boolean(), (a, b) => {
          const sim = simulate(HalfAdder);
          try {
            sim.set({ a: a ? 1 : 0, b: b ? 1 : 0 });
            return sim.get('carry') === 0;
          } finally { sim.dispose(); }
        }));
      `,
    }));
    expect(r.testbench_passed).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].counterexample?.inputs).toEqual([true, true]); // a&b is the only carry case
  });

  it('runs an exhaustive sweep and reports the full count', () => {
    const r = ok(verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      testbench: `
        verify.exhaustive('all 4 input pairs', [2, 2], (a, b) => {
          const sim = simulate(HalfAdder);
          try {
            sim.set({ a, b });
            return sim.get('sum') === (a ^ b) && sim.get('carry') === (a & b);
          } finally { sim.dispose(); }
        });
      `,
    }));
    expect(r.testbench_passed).toBe(true);
    expect(r.checks[0]).toMatchObject({ strategy: 'exhaustive', count: 4, passed: true });
  });

  it('rejects an exhaustive sweep larger than the cutoff with guidance', () => {
    // 2^21 > 2^20 cutoff — must refuse rather than hang, and point at sampling.
    const r = verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      testbench: `verify.exhaustive('too big', [2097152], () => true);`,
    });
    expect('error' in r).toBe(true);
    expect((r as VerifyError).phase).toBe('runtime');
    expect((r as VerifyError).error).toContain('exceeds');
  });

  it('rejects raw fc.assert with a hard error steering to verify.check', () => {
    // Single failure path: fc.assert loses the structured counterexample, so it
    // is disallowed. Without this the rich-vs-string ambiguity returns forever.
    const r = verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      testbench: `fc.assert(fc.property(fc.boolean(), () => true));`,
    });
    expect('error' in r).toBe(true);
    expect((r as VerifyError).error).toContain('verify.check');
  });

  it('reports a source compile error as phase:compile', () => {
    const r = verifyCircuit({
      source: `const x = circuit('Broken', {`,
      oracle: ORACLE,
      testbench: `verify.check('noop', fc.property(fc.boolean(), () => true));`,
    });
    expect('error' in r).toBe(true);
    expect((r as VerifyError).phase).toBe('compile');
  });

  it('returns phase:timeout when the testbench exceeds its budget', () => {
    // timeoutMs:0 trips the deadline on the first check — proves the wall-clock
    // guard surfaces as phase:timeout (distinct from oom, which the sandbox sets).
    const r = verifyCircuit({
      source: HALF_ADDER,
      oracle: ORACLE,
      timeoutMs: 0,
      testbench: `verify.check('x', fc.property(fc.boolean(), () => true));`,
    });
    expect('error' in r).toBe(true);
    expect((r as VerifyError).phase).toBe('timeout');
  });

  it('accepts a circuit file with real @simten/core imports (executor strips them)', () => {
    // The whole point of the import shim: a file can carry real imports so it's
    // editor/tsx-valid, and the executor drops them and uses injected scope.
    const r = ok(verifyCircuit({
      source: `import { circuit, bit } from '@simten/core/circuit';\n` +
              `import { Xor, And } from '@simten/core/std';\n` + HALF_ADDER,
      oracle: ORACLE,
      testbench: `verify.exhaustive('ha', [2, 2], (a, b) => {
        const s = simulate(HalfAdder);
        try { s.set({ a, b }); return s.get('sum') === (a ^ b) && s.get('carry') === (a & b); }
        finally { s.dispose(); }
      });`,
    }));
    expect(r.testbench_passed).toBe(true);
  });

  it('enforces the loader boundary: testbench cannot see internal sub-circuits', () => {
    // The whole point of loader-over-concat. A circuit file with an internal
    // helper must NOT leak that helper into the testbench scope. If a future
    // refactor restores concat semantics, this is the test that catches it.
    const src = `
      const helper = circuit('Helper', {
        inputs: { x: bit }, outputs: { y: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [ inputs.x.to(n.in), n.out.to(outputs.y) ],
      });
      const Top = circuit('Top', {
        inputs: { x: bit }, outputs: { y: bit },
        nodes: { h: helper },
        connect: ({ inputs, outputs, nodes: { h } }) => [ inputs.x.to(h.x), h.y.to(outputs.y) ],
      });
    `;
    const r = verifyCircuit({
      source: src,
      oracle: ORACLE,
      circuitName: 'Top',
      testbench: `const sim = simulate(helper); sim.dispose();`, // references internal helper by name
    });
    expect('error' in r).toBe(true);
    expect((r as VerifyError).phase).toBe('runtime');
    expect((r as VerifyError).error).toMatch(/helper is not defined|not defined/);
  });
});

describe('stripImports', () => {
  it('removes every import form, leaves the rest intact', () => {
    const src = [
      `import Default from 'a';`,
      `import { x, y } from "b";`,
      `import {`,
      `  multi,`,
      `  line,`,
      `} from 'c';`,
      `import * as ns from 'd';`,
      `import 'side-effect';`,
      `const keep = 1;`,
      `const s = "import not a statement";`,
    ].join('\n');
    const out = stripImports(src);
    expect(out).not.toMatch(/^\s*import\s/m);   // no import statements survive
    expect(out).toContain('const keep = 1;');   // real code untouched
    expect(out).toContain('"import not a statement"'); // string literal untouched
  });
});
