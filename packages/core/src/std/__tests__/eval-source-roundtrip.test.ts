/**
 * Stdlib evals and the source round-trip.
 *
 * The sandbox receives evals as source *text* and rebuilds them with
 * `new Function`, which preserves the body but not the closure. An eval that
 * reads a variable from its factory scope therefore throws the moment it runs
 * there — `Adder` is written `({ a, b, carry_in, width: w = width })`, where
 * the default reads the factory's `width`, and a bare `Adder()` supplies no
 * `width` argument, so the default always fires.
 *
 * That crashed Snake and Pong with "width is not defined" once
 * `registerCircuitEval` became last-write-wins: the rebuilt copies started
 * replacing the real ones instead of being discarded. The sandbox now skips
 * stdlib names, so nothing is broken today.
 *
 * This test exists so the hazard cannot grow silently. KNOWN_CLOSURE_DEPS is a
 * list that may only shrink: a new component written in the same style fails
 * here immediately, and fixing an existing one (give the destructure a literal
 * default instead of reading the factory variable) means deleting its line.
 *
 * A closure dependency surfaces as ReferenceError specifically, which is what
 * separates it from an eval that merely dislikes this test's synthetic inputs.
 */

import { describe, expect, it } from 'vitest';
import { getAllCircuitEvals } from '../../circuit/index.js';
import '../index.js';

/**
 * Evals that cannot be rebuilt from their own source because they close over a
 * factory variable (`width`, `inWidth`, `loWidth`, …). May only shrink.
 */
const KNOWN_CLOSURE_DEPS = [
  'Adder',
  'BusNot',
  'BusXnor',
  'Concat',
  'Divider',
  'DynamicSlice',
  'LeftShifter',
  'Modulo',
  'ReduceAnd',
  'RightShifter',
  'SignExtend',
  'SignedComparator',
  'SignedDivider',
  'SignedModulo',
  'SignedRightShifter',
  'Slice',
  'Subtractor',
  'WrappingMultiplier',
  'ZeroExtend',
];

/** Rebuild an eval the way the sandbox does, and run it. */
function survivesRoundTrip(entry: {
  evalFn: unknown;
  inputNames: string[];
  stateKeys?: string[];
}): { ok: true } | { ok: false; reference: boolean; message: string } {
  try {
    const rebuilt = new Function(`return (${String(entry.evalFn)})`)() as (
      inputs: Record<string, unknown>,
    ) => unknown;
    const inputs: Record<string, unknown> = {};
    for (const port of entry.inputNames) inputs[port] = 1;
    for (const key of entry.stateKeys ?? []) inputs[key] = new Map();
    rebuilt(inputs);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reference: error instanceof ReferenceError,
      message: (error as Error).message,
    };
  }
}

describe('stdlib evals rebuilt from source', () => {
  const closureDeps: string[] = [];
  for (const [name, entry] of getAllCircuitEvals()) {
    const result = survivesRoundTrip(entry);
    if (!result.ok && result.reference) closureDeps.push(name);
  }

  it('has no closure dependency outside the known list', () => {
    const unexpected = closureDeps.filter((n) => !KNOWN_CLOSURE_DEPS.includes(n)).sort();
    expect(
      unexpected,
      'A new stdlib eval reads a variable from its factory scope. It cannot be rebuilt ' +
        'from source, so it breaks in the sandbox if anything registers it from text. ' +
        'Give the destructured parameter a literal default instead of reading the ' +
        'factory variable — e.g. `width: w = 8` rather than `width: w = width`.',
    ).toEqual([]);
  });

  it('keeps the known list honest — fixed components must be removed from it', () => {
    const fixed = KNOWN_CLOSURE_DEPS.filter((n) => !closureDeps.includes(n)).sort();
    expect(
      fixed,
      'These no longer depend on their closure. Delete them from KNOWN_CLOSURE_DEPS.',
    ).toEqual([]);
  });

  it('rebuilds the majority of stdlib evals cleanly', () => {
    const total = [...getAllCircuitEvals()].length;
    expect(total).toBeGreaterThan(50);
    expect(closureDeps.length).toBeLessThan(total / 2);
  });
});
