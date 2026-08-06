/**
 * The port-key contract.
 *
 * `GradeRuntime.evaluate` must return BARE port names. The sandbox namespaces
 * top-level ports under `__top__.` while `@simten/core/sim` returns them bare,
 * and because the interface never said which, the sandbox adapter shipped the
 * prefixed keys straight through. Grading then read `undefined` for every
 * output and, thanks to a `?? 0` fallback, scored it 0 — which silently passes
 * every truth-table row that expects 0. Three of the four rows in a two-input
 * AND expect 0, so it looked like one stubborn failing case rather than a
 * grader that never read anything.
 *
 * The host-side tests could not have caught it: they use the local runtime,
 * which was the half that was already right.
 */

import { describe, expect, it } from 'vitest';
import { readOutputs, resolveOutput } from '../runtime';

describe('resolveOutput / readOutputs', () => {
  it('strips the __top__ prefix', () => {
    expect(readOutputs({ '__top__.out': 1, '__top__.carry': 0 }, ['out', 'carry'])).toEqual({
      out: 1,
      carry: 0,
    });
  });

  it('coerces bit values to 0/1', () => {
    expect(readOutputs({ '__top__.out': true, '__top__.other': false }, ['out', 'other'])).toEqual({
      out: 1,
      other: 0,
    });
  });

  it('drops internal node ports', () => {
    // `and1.out` is a node's port, not the circuit's. A level grades the
    // interface, so an internal node that shares a port name must not stand in
    // for the real one.
    expect(readOutputs({ 'and1.out': 1, '__top__.out': 0 }, ['out'])).toEqual({ out: 0 });
  });

  it('returns nothing when the bag has no top-level ports', () => {
    // The failure that started this: an empty result must stay empty so the
    // grader reports "could not read output" rather than defaulting to 0.
    expect(readOutputs({ 'and1.out': 1 }, ['out'])).toEqual({});
  });
});

describe('resolveOutput spans both circuit shapes', () => {
  // The two shapes a level can take. One rule reads either, which is what lets
  // the self-contained early levels and the port-based abstraction level share
  // a grader and a level format.
  it('reads a top-level port', () => {
    expect(resolveOutput({ '__top__.out': 1 }, 'out')).toBe(1);
  });

  it('reads an Led node of that name', () => {
    expect(resolveOutput({ 'out.in': 1 }, 'out')).toBe(1);
  });

  it('prefers the port when a circuit somehow has both', () => {
    expect(resolveOutput({ '__top__.out': 0, 'out.in': 1 }, 'out')).toBe(0);
  });

  it('is undefined when neither exists, so the grader can say so', () => {
    expect(resolveOutput({ 'and1.out': 1 }, 'out')).toBeUndefined();
  });
});
