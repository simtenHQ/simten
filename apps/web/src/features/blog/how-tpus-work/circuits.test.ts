/**
 * The 3x3 systolic array on the TPU post computes A x B, and the demo shows
 * every entry of the result. The demo reads each result off its HexDisplay,
 * so a display with no wire into it reads 0 (issue #469: display_c02).
 */

import { simulate } from '@simten/core';
import { internalsOf, nodesOf } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { Systolic3x3, TestSystolic3x3 } from './circuits';

const ENTRIES = ['00', '01', '02', '10', '11', '12', '20', '21', '22'] as const;

const demoIR = internalsOf(TestSystolic3x3).ir;

function inputArg(name: string): number {
  const node = demoIR.nodes.find((n) => n.id === name || n.label === name);
  const value = node?.arguments.value;
  if (typeof value !== 'number') throw new Error(`no Input value for ${name}`);
  return value;
}

const matrix = (prefix: 'a' | 'b') =>
  [0, 1, 2].map((r) => [0, 1, 2].map((c) => inputArg(`${prefix}${r}${c}`)));

const A = matrix('a');
const B = matrix('b');
const expected = (r: number, c: number) =>
  A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];

function systolicInputs(): Record<string, number> {
  const inputs: Record<string, number> = { start: 1 };
  for (const rc of ENTRIES) {
    inputs[`a${rc}`] = A[Number(rc[0])][Number(rc[1])];
    inputs[`b${rc}`] = B[Number(rc[0])][Number(rc[1])];
  }
  return inputs;
}

/**
 * For each entry, the first tick after Start from which `read` returns the
 * final product and keeps returning it.
 */
function settleTicks(tick: () => void, read: (rc: string) => number, ticks: number) {
  const settled: Record<string, number | null> = {};
  for (const rc of ENTRIES) settled[`c${rc}`] = null;
  for (let t = 0; t <= ticks; t++) {
    for (const rc of ENTRIES) {
      const ok = read(rc) === expected(Number(rc[0]), Number(rc[1]));
      if (!ok) settled[`c${rc}`] = null;
      else if (settled[`c${rc}`] === null) settled[`c${rc}`] = t;
    }
    tick();
  }
  return settled;
}

/** Entry c_ij reaches the outputs, and the demo's displays, on tick 6 + i + j. */
const OUTPUT_TICKS = {
  c00: 6,
  c01: 7,
  c10: 7,
  c02: 8,
  c11: 8,
  c20: 8,
  c12: 9,
  c21: 9,
  c22: 10,
};

describe('TPU post systolic array', () => {
  it('uses the matrices the post describes', () => {
    expect(A).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(B).toEqual([
      [2, 0, 1],
      [0, 2, 0],
      [1, 0, 2],
    ]);
  });

  it('computes all nine entries of A x B', () => {
    const sim = simulate(Systolic3x3);
    sim.set(systolicInputs());
    for (let i = 0; i < 20 && sim.get('done') === 0; i++) sim.tick();
    expect(sim.get('done')).toBe(1);

    const out = sim.read();
    for (const rc of ENTRIES) {
      expect(out[`c${rc}`], `c${rc}`).toBe(expected(Number(rc[0]), Number(rc[1])));
    }
  });

  it('wires every result to its display in the demo circuit', () => {
    const ir = demoIR;
    const idOf = (name: string) => ir.nodes.find((n) => n.id === name || n.label === name)?.id;
    const sys = idOf('sys');
    for (const rc of ENTRIES) {
      const display = idOf(`display_c${rc}`);
      const wired = ir.connections.some(
        (c) =>
          c.source.nodeId === sys &&
          c.source.portName === `c${rc}` &&
          c.target.nodeId === display &&
          c.target.portName === 'in',
      );
      expect(wired, `sys.c${rc} -> display_c${rc}.in`).toBe(true);
    }
  });

  // The post's timing explanation quotes these ticks. With N = 3: weights load
  // on tick 1, row i of A enters i ticks after row 0, crossing to column j
  // takes j ticks, and passing down the N rows of PEs takes N, so c_ij leaves
  // the array on tick 1 + i + j + N (the last on 3N - 1 = 8). Two capture
  // registers put it on the output two ticks later (the last on 3N + 1 = 10).
  it('leaves the array as a diagonal wavefront, c00 first and c22 last', () => {
    const sim = simulate(Systolic3x3);
    sim.set(systolicInputs());
    // pe2j's partial-sum register holds c_ij for one tick only, so record the
    // first tick it shows the product rather than when it settles.
    const leaves: Record<string, number> = {};
    for (let t = 0; t <= 12; t++) {
      const values = nodesOf(sim).ports();
      for (const rc of ENTRIES) {
        const out = Number(values.get(`pe2${rc[1]}.psumReg.q`));
        if (!(`c${rc}` in leaves) && out === expected(Number(rc[0]), Number(rc[1]))) {
          leaves[`c${rc}`] = t;
        }
      }
      sim.tick();
    }
    const ticks = Object.fromEntries(
      Object.entries(OUTPUT_TICKS).map(([name, tick]) => [name, tick - 2]),
    );
    expect(leaves).toEqual(ticks);
  });

  it('puts each result on its output on tick 6 + i + j', () => {
    const sim = simulate(Systolic3x3);
    sim.set(systolicInputs());
    const settled = settleTicks(
      () => sim.tick(),
      (rc) => sim.get(`c${rc}` as `c${(typeof ENTRIES)[number]}`),
      20,
    );
    expect(settled).toEqual(OUTPUT_TICKS);
  });

  it('shows each result on its display in the demo on the same tick', () => {
    // The demo's inputs are Input nodes inside it; `set` takes their paths.
    const sim = simulate(TestSystolic3x3);
    sim.set({ start: 1 });
    const settled = settleTicks(
      () => sim.tick(),
      (rc) => Number(nodesOf(sim).ports().get(`display_c${rc}.in`)),
      20,
    );
    expect(settled).toEqual(OUTPUT_TICKS);
  });
});
