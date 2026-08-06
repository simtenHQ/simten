/**
 * The validation gate.
 *
 * A level is only shippable if two things hold, and neither is obvious from
 * reading it:
 *
 *   solvable    — a reference solution passes. Catches a level whose stated
 *                 signals, allowed primitives and truth table cannot all be
 *                 satisfied at once.
 *   not vacuous — degenerate answers fail. Catches the tautological grader,
 *                 where a truth table is so thin that returning a constant
 *                 passes it. That bug is invisible in the "solvable" direction,
 *                 which is exactly why it needs its own test.
 *
 * Every level ships a reference solution here. Adding a level without one, or
 * with one that does not pass, fails CI rather than stranding a player on an
 * unsolvable puzzle.
 *
 * The suite also spans both circuit shapes on purpose: levels 1–3 are
 * self-contained (Switch/Led nodes) and level 4 uses ports, so the grader's
 * signal resolution is exercised in both directions.
 */

import { describe, expect, it } from 'vitest';
import { grade } from '../grade';
import { LEVELS, LEVELS_BY_ID } from '../levels';
import type { Level } from '../types';
import { localRuntime } from './local-runtime';

/** Known-good answers, one per level id. */
const SOLUTIONS: Record<string, string> = {
  'first-wire': `
export const And1 = circuit('And1', {
  nodes: { a: Switch, b: Switch, and1: And, out: Led },
  connect: ({ nodes: { a, b, and1, out } }) => [
    a.out.to(and1.a),
    b.out.to(and1.b),
    and1.out.to(out.in),
  ],
});`,

  'not-from-nand': `
export const Not1 = circuit('Not1', {
  nodes: { a: Switch, n1: Nand, out: Led },
  connect: ({ nodes: { a, n1, out } }) => [
    a.out.to(n1.a, n1.b),
    n1.out.to(out.in),
  ],
});`,

  'xor-from-nand': `
export const Xor1 = circuit('Xor1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, n4, out } }) => [
    a.out.to(n1.a, n2.a),
    b.out.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(out.in),
  ],
});`,

  'half-adder': `
export const Xor2 = circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { n1: Nand, n2: Nand, n3: Nand, n4: Nand },
  connect: ({ inputs, outputs, nodes: { n1, n2, n3, n4 } }) => [
    inputs.a.to(n1.a, n2.a),
    inputs.b.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(outputs.out),
  ],
});`,
};

/**
 * A degenerate answer: the right signals, no real logic. Wires a Constant
 * straight to the output, so it also exercises the forbidden-primitive path —
 * no level allows a Constant.
 */
function constantSolution(level: Level, value: 0 | 1): string {
  const usesPorts = level.stub.includes('inputs:');
  const nodes = [
    ...(usesPorts ? [] : level.inputs.map((n) => `${n}: Switch`)),
    `k: Constant({ value: ${value} })`,
    ...(usesPorts ? [] : level.outputs.map((n) => `${n}: Led`)),
  ].join(', ');
  const wires = level.outputs
    .map((n) => (usesPorts ? `k.out.to(outputs.${n})` : `k.out.to(${n}.in)`))
    .join(', ');

  return usesPorts
    ? `
export const ${level.target} = circuit('${level.target}', {
  inputs: { ${level.inputs.map((n) => `${n}: bit`).join(', ')} },
  outputs: { ${level.outputs.map((n) => `${n}: bit`).join(', ')} },
  nodes: { ${nodes} },
  connect: ({ outputs, nodes: { k } }) => [${wires}],
});`
    : `
export const ${level.target} = circuit('${level.target}', {
  nodes: { ${nodes} },
  connect: ({ nodes: { k, ${level.outputs.join(', ')} } }) => [${wires}],
});`;
}

describe('every level has a reference solution', () => {
  it('covers each level exactly, with no orphans', () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });
});

describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (id, level) => {
  it('is solvable — the reference solution passes', async () => {
    const result = await grade(localRuntime(), level, SOLUTIONS[id]);
    // Surface the actual failure rather than a bare `false`.
    expect(result.status === 'pass' ? 'pass' : JSON.stringify(result)).toBe('pass');
  });

  it('scores at or under par, counting only permitted primitives', async () => {
    const result = await grade(localRuntime(), level, SOLUTIONS[id]);
    if (result.status !== 'pass') throw new Error('reference solution did not pass');
    expect(result.gates).toBeGreaterThan(0);
    if (level.par !== undefined) expect(result.gates).toBeLessThanOrEqual(level.par);
  });

  it.each([0, 1] as const)('is not vacuous — a constant %i answer fails', async (value) => {
    const result = await grade(localRuntime(), level, constantSolution(level, value));
    expect(result.status).toBe('fail');
  });

  it('rejects a solution that omits the required circuit', async () => {
    const result = await grade(
      localRuntime(),
      level,
      `export const Nope = circuit('Nope', {
        nodes: { s: Switch, b: Buffer, l: Led },
        connect: ({ nodes: { s, b, l } }) => [s.out.to(b.in), b.out.to(l.in)],
      });`,
    );
    expect(result.status).toBe('fail');
    if (result.status === 'fail') expect(result.failure.kind).toBe('missing-circuit');
  });
});

describe('the graded circuit is chosen by name', () => {
  /**
   * The sandbox builds its simulator on the LAST circuit in the source
   * (apps/sandbox/src/main.ts), so a player who defines a helper below their
   * answer would be graded on the helper. `GradeRuntime.select` pins the target
   * instead. This is that regression: `Not1` is correct, a decoy with the same
   * signal names and the wrong logic follows it, and the level still passes.
   */
  it('ignores a later circuit with the same signals', async () => {
    const level = LEVELS_BY_ID.get('not-from-nand');
    if (!level) throw new Error('level missing');

    const withDecoyLast = `${SOLUTIONS['not-from-nand']}

export const Decoy = circuit('Decoy', {
  nodes: { a: Switch, b: Buffer, out: Led },
  connect: ({ nodes: { a, b, out } }) => [a.out.to(b.in), b.out.to(out.in)],
});`;

    const result = await grade(localRuntime(), level, withDecoyLast);
    expect(result.status === 'pass' ? 'pass' : JSON.stringify(result)).toBe('pass');
  });
});

describe('the score counts only permitted primitives', () => {
  /**
   * Switches and lamps are nodes like any other, so a naive count would charge
   * the player for them and make every early par wrong. Counting positively
   * from `allowed` is what prevents that.
   */
  it('does not charge for Switch and Led', async () => {
    const level = LEVELS_BY_ID.get('first-wire');
    if (!level) throw new Error('level missing');
    const result = await grade(localRuntime(), level, SOLUTIONS['first-wire']);
    if (result.status !== 'pass') throw new Error(JSON.stringify(result));
    // Two switches, one lamp, one gate — the score is 1.
    expect(result.gates).toBe(1);
  });
});

describe('level definitions', () => {
  it('have unique ids', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(LEVELS_BY_ID.size).toBe(LEVELS.length);
  });

  it('name every signal in every vector', () => {
    for (const level of LEVELS) {
      for (const v of level.vectors) {
        expect(Object.keys(v.inputs).sort()).toEqual([...level.inputs].sort());
        for (const port of Object.keys(v.expect)) expect(level.outputs).toContain(port);
      }
    }
  });

  it('ship a stub that names the target circuit', () => {
    for (const level of LEVELS) expect(level.stub).toContain(`'${level.target}'`);
  });

  it('all carry completion copy', () => {
    // The dialog reads straight from this, so a level without it finishes on
    // an empty headline — and the failure would only show on a solve.
    for (const level of LEVELS) {
      expect(level.outro.headline.trim().length).toBeGreaterThan(0);
      expect(level.outro.body.trim().length).toBeGreaterThan(0);
    }
  });
});
