/**
 * Which step failed, and the sentence that says so.
 *
 * The latch's steps 2 and 4 carry the same inputs (s = 1, r = 1) and expect
 * different outputs: that difference is the memory the level teaches. The
 * panel used to find the failed column by searching for its inputs, so a
 * failure at step 4 reddened step 2.
 */

import { describe, expect, it } from 'vitest';
import { explain } from '../explain';
import { grade } from '../grade';
import { LEVELS_BY_ID } from '../levels';
import type { Level } from '../types';
import { localRuntime } from './local-runtime';

function level(id: string): Level {
  const found = LEVELS_BY_ID.get(id);
  if (!found) throw new Error(`level ${id} missing`);
  return found;
}

// No memory: q just copies r (two NANDs make a buffer). That matches the latch
// for steps 1 to 3 and first goes wrong at step 4.
const COPIES_R = `export const Latch1 = circuit('Latch1', {
  nodes: { s: Switch, r: Switch, n1: Nand, n2: Nand, q: Led },
  connect: ({ nodes: { r, n1, n2, q } }) => [
    r.out.to(n1.a, n1.b),
    n1.out.to(n2.a, n2.b),
    n2.out.to(q.in),
  ],
});`;

// The NOT stub with its last wire missing: the LED is never driven.
const UNFINISHED_NOT = `export const Not1 = circuit('Not1', {
  nodes: { a: Switch, n1: Nand, result: Led },
  connect: ({ nodes: { a, n1 } }) => [a.out.to(n1.a)],
});`;

describe('a wrong output', () => {
  it('reports the step that failed, not the first step with the same inputs', async () => {
    const latch = level('latch');
    expect(latch.vectors[3].inputs).toEqual(latch.vectors[1].inputs);

    const result = await grade(localRuntime(), latch, COPIES_R);
    if (result.status !== 'fail' || result.failure.kind !== 'vector') {
      throw new Error(`expected a wrong output, got ${JSON.stringify(result)}`);
    }
    expect(result.failure.index).toBe(3);
  });

  it('is explained with the step on a sequential level', async () => {
    const latch = level('latch');
    const result = await grade(localRuntime(), latch, COPIES_R);
    expect(explain(result, latch)).toBe(
      'At step 4 (s = 1, r = 1), q should be 0 but your circuit gives 1.',
    );
  });

  it('is explained with the inputs on a truth-table level', async () => {
    const not = level('not');
    const result = await grade(localRuntime(), not, UNFINISHED_NOT);
    expect(explain(result, not)).toBe('With a = 0, result should be 1 but your circuit gives 0.');
  });
});

describe('a code error', () => {
  it('drops the compiler prefix and keeps what the player needs', () => {
    const message =
      "Circuit 'Not1' validation failed: - Port 'c' does not exist on node 'n1' (Nand). Available ports: a, b, out";
    expect(explain({ status: 'error', message }, level('not'))).toBe(
      "Port 'c' does not exist on node 'n1' (Nand). Available ports: a, b, out",
    );
  });
});
