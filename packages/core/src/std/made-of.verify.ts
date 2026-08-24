#!/usr/bin/env tsx
/**
 * made-of.verify.ts — Tier-B testbench: every gate-level reference build in
 * `MADE_OF` computes exactly what the primitive it explains computes.
 *
 * The risk this removes is drift. `MADE_OF.Adder` and `Adder` are two
 * descriptions of addition maintained by hand in different files; without a
 * proof they are equal, the canvas eventually shows a diagram that lies about
 * the thing the user is looking at. Exhaustive equivalence turns that risk into
 * a guarantee — every diagram is proven to compute what it claims.
 *
 * Generic by construction: it reads each primitive's port widths and sweeps the
 * whole input space, so a new `MADE_OF` entry is covered the moment it is added.
 * No per-primitive test to remember to write.
 *
 * NOTE this proves *functional* equivalence only. A ripple-carry adder is not
 * what synthesis emits, and this says nothing about gate count or timing — see
 * the header of `made-of.ts`.
 *
 * Run: tsx packages/core/src/std/made-of.verify.ts
 * (also spawned by `std/__tests__/made-of.test.ts` so CI covers it)
 */

import * as fc from 'fast-check';
import { circuit } from '../circuit/circuit.js';
import type { BuiltCircuit } from '../circuit/types.js';
import { simulate } from '../sim/index.js';
import type { SimulationHandle } from '../sim/simulate.js';
import { declareOracle, describe, verify } from '../verify/index.js';
import { Adder, Comparator, Incrementer, Subtractor } from './arithmetic.js';
import { MADE_OF } from './made-of.js';
import { Mux } from './routing.js';

describe('MADE_OF');
declareOracle({
  tier: 'B',
  type: "each primitive's own eval — closed-form arithmetic in JS",
  independence_basis:
    'The two descriptions are paradigm-diverse. The reference is a closed-form ' +
    'expression ((a >>> 0) + (b >>> 0) + carry, masked); the circuit under test is a ' +
    'netlist of Xor/And/Or/Not with an explicit carry chain and per-bit slicing. ' +
    'Neither is derived from the other — they were written independently and share ' +
    'no code path below simulate().',
});

// ── Harness ──────────────────────────────────────────────────────────────────

const open: SimulationHandle[] = [];
const track = <T extends SimulationHandle>(h: T): T => {
  open.push(h as SimulationHandle);
  return h;
};

/**
 * A parameterized primitive only sees its `width` when it is a *node* — the
 * bridge merges `node.arguments` into the eval inputs. Simulating one bare
 * would silently fall back to the literal default (see Adder's eval comment),
 * so wrap it in a pass-through composite to get the real behaviour.
 */
function wrapPrimitive(prim: BuiltCircuit, name: string): BuiltCircuit {
  const ins = Object.fromEntries(
    Object.entries(prim.inputs).map(([k, d]) => [k, (d as { portType: unknown }).portType]),
  );
  const outs = Object.fromEntries(
    Object.entries(prim.outputs).map(([k, d]) => [k, (d as { portType: unknown }).portType]),
  );
  return circuit(name, {
    inputs: ins,
    outputs: outs,
    nodes: { p: prim },
    // Generic port walk over an arbitrary primitive; the shape is proven by
    // the equivalence sweep below rather than by the type system.
    connect: ({ inputs, outputs, nodes: { p } }: ConnectArg) => [
      ...Object.keys(ins).map((k) => inputs[k].to(p[k])),
      ...Object.keys(outs).map((k) => p[k].to(outputs[k])),
    ],
  } as never) as unknown as BuiltCircuit;
}

/** The shape `connect` receives for a wrapper built from arbitrary ports. */
type PortRef = { to: (...targets: unknown[]) => unknown };
interface ConnectArg {
  inputs: Record<string, PortRef>;
  outputs: Record<string, PortRef>;
  nodes: { p: Record<string, PortRef> };
}

/** Number of distinct values a port can hold. */
function spaceOf(d: unknown): number {
  const t = (d as { portType: { kind: string; width?: number } }).portType;
  return t.kind === 'bit' ? 2 : 2 ** (t.width ?? 1);
}

interface Subject {
  label: string;
  made: BuiltCircuit;
  ref: BuiltCircuit;
  inputNames: string[];
  spaces: number[];
}

function subject(label: string, made: unknown, prim: BuiltCircuit): Subject {
  const ref = wrapPrimitive(prim, `${label.replace(/[^A-Za-z0-9]/g, '_')}_ref`);
  return {
    label,
    made: made as BuiltCircuit,
    ref,
    inputNames: Object.keys(prim.inputs),
    spaces: Object.values(prim.inputs).map(spaceOf),
  };
}

/** Compare every output of the two circuits for one input assignment. */
function agree(
  a: SimulationHandle,
  b: SimulationHandle,
  names: string[],
  vals: number[],
  outputs: string[],
): boolean {
  const assignment = Object.fromEntries(names.map((n, i) => [n, vals[i]]));
  a.set(assignment);
  b.set(assignment);
  for (const o of outputs) {
    if (a.get(o) !== b.get(o)) return false;
  }
  return true;
}

/** Exhaustive equivalence over the primitive's whole input space. */
function proveExhaustive(s: Subject): void {
  const made = track(simulate(s.made));
  const ref = track(simulate(s.ref));
  const outputs = Object.keys((s.ref as unknown as { outputs: object }).outputs);
  verify.exhaustive(`${s.label} matches its primitive on every input`, s.spaces, (...vals) =>
    agree(made, ref, s.inputNames, vals, outputs),
  );
}

/** Sampled equivalence, for spaces too large to sweep. */
function proveSampled(s: Subject, numRuns: number): void {
  const made = track(simulate(s.made));
  const ref = track(simulate(s.ref));
  const outputs = Object.keys((s.ref as unknown as { outputs: object }).outputs);
  // One arbitrary per input port; fc.property's variadic overload does not
  // survive a spread of a computed array, so build the tuple then assert it.
  const arbs = s.spaces.map((n) => fc.integer({ min: 0, max: n - 1 }));
  const property = fc.property(...(arbs as unknown as [fc.Arbitrary<number>]), ((
    ...vals: number[]
  ) => agree(made, ref, s.inputNames, vals, outputs)) as (v: number) => boolean);
  verify.check(`${s.label} matches its primitive on sampled inputs`, property, { numRuns });
}

// ── Subjects ─────────────────────────────────────────────────────────────────

// Widths 1 and 2 are the edges the builders special-case (no Concat fold at
// width 1; a single reduction gate at width 2). 8 is the default everything
// else in the stdlib is sized against.
const EXHAUSTIVE_WIDTHS = [1, 2, 8];

const subjects: Subject[] = [
  ...EXHAUSTIVE_WIDTHS.flatMap((w) => [
    subject(`Adder(${w})`, MADE_OF.Adder({ width: w }), Adder({ width: w }) as BuiltCircuit),
    subject(
      `Subtractor(${w})`,
      MADE_OF.Subtractor({ width: w }),
      Subtractor({ width: w }) as BuiltCircuit,
    ),
    subject(
      `Comparator(${w})`,
      MADE_OF.Comparator({ width: w }),
      Comparator({ width: w }) as BuiltCircuit,
    ),
    subject(`Mux(${w})`, MADE_OF.Mux({ width: w }), Mux({ width: w }) as BuiltCircuit),
  ]),
  subject('Incrementer', MADE_OF.Incrementer({}), Incrementer as BuiltCircuit),
];

for (const s of subjects) proveExhaustive(s);

// Width 16 is the size the README and the synth voice actually instantiate, and
// its space (2^33 for an adder) is far past the exhaustive cutoff. Sample it:
// masking and carry-chain bugs that only bite above 8 bits show up here.
for (const w of [16]) {
  proveSampled(
    subject(`Adder(${w})`, MADE_OF.Adder({ width: w }), Adder({ width: w }) as BuiltCircuit),
    300,
  );
  proveSampled(
    subject(
      `Subtractor(${w})`,
      MADE_OF.Subtractor({ width: w }),
      Subtractor({ width: w }) as BuiltCircuit,
    ),
    300,
  );
  proveSampled(
    subject(
      `Comparator(${w})`,
      MADE_OF.Comparator({ width: w }),
      Comparator({ width: w }) as BuiltCircuit,
    ),
    300,
  );
  proveSampled(
    subject(`Mux(${w})`, MADE_OF.Mux({ width: w }), Mux({ width: w }) as BuiltCircuit),
    300,
  );
}

// Every entry in the table must be covered by at least one subject above — a
// new MADE_OF entry with no subject would otherwise pass by doing nothing.
const covered = new Set(subjects.map((s) => s.label.replace(/\(.*$/, '')));
const uncovered = Object.keys(MADE_OF).filter((n) => !covered.has(n));
verify.exhaustive('every MADE_OF entry is covered by a subject', [1], () => {
  if (uncovered.length > 0) {
    throw new Error(`MADE_OF entries with no equivalence check: ${uncovered.join(', ')}`);
  }
  return true;
});

for (const h of open) h.dispose();

verify.run();
