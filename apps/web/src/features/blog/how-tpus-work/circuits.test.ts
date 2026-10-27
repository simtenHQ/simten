/**
 * The 3x3 systolic array on the TPU post computes A x B, and the demo shows
 * every entry of the result. The demo reads each result off its HexDisplay,
 * so a display with no wire into it reads 0 (issue #469: display_c02).
 */

import { simulate } from '@simten/core';
import { describe, expect, it } from 'vitest';
import { Systolic3x3, TestSystolic3x3 } from './circuits';

const ENTRIES = ['00', '01', '02', '10', '11', '12', '20', '21', '22'] as const;

function inputArg(name: string): number {
  const node = TestSystolic3x3.circuit.nodes.find((n) => n.id === name || n.label === name);
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
    const inputs: Record<string, number> = { start: 1 };
    for (const rc of ENTRIES) {
      inputs[`a${rc}`] = A[Number(rc[0])][Number(rc[1])];
      inputs[`b${rc}`] = B[Number(rc[0])][Number(rc[1])];
    }
    sim.set(inputs);
    for (let i = 0; i < 20 && sim.get('done') === 0; i++) sim.tick();
    expect(sim.get('done')).toBe(1);

    const out = sim.read();
    for (const rc of ENTRIES) {
      expect(out[`c${rc}`], `c${rc}`).toBe(expected(Number(rc[0]), Number(rc[1])));
    }
  });

  it('wires every result to its display in the demo circuit', () => {
    const ir = TestSystolic3x3.circuit;
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
});
