/**
 * Serializer verification bars for the import path (plan Workstreams D + editability).
 *
 *  1. Round-trip (faithful inverse): import demo → circuitToSource → recompile
 *     the generated source → simulate → identical to the iverilog golden. Proves
 *     the emitted source is a faithful, re-simulatable representation.
 *
 *  2. Editability (the actual product claim): take the generated source, make a
 *     specified hand-edit (flip the adder's carry-in constant 0 → 1), recompile,
 *     and assert the predicted behavioural change (every `wide` output +1).
 *     Proves a human can open the source, find the component, edit it, and
 *     re-simulate — which a pure round-trip does not prove.
 *
 * The generated source is sandbox-style (no imports; circuit/bit/bus + stdlib are
 * ambient). We recompile it the same way the editor sandbox does — a `new
 * Function` with those symbols injected — then `return` the named entry circuit.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { circuitToSource } from '../../circuit/circuit-to-source.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { simulate } from '../../sim/index.js';
import {
  Adder,
  Comparator,
  Concat,
  Constant,
  Mux,
  Register,
  SignExtend,
  Slice,
  ZeroExtend,
} from '../../std/index.js';
import { buildFromIR } from '../../circuit/index.js';
import { importNetlist, type YosysNetlist } from '../index.js';

const fix = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
const netlist = JSON.parse(fix('demo.json')) as YosysNetlist;
const golden = JSON.parse(fix('demo.golden.json')) as {
  vectors: { in: Record<string, number>; out: Record<string, number> }[];
};

/** The ambient symbols the sandbox pre-injects (circuit/bit/bus + stdlib). */
const INJECT: Record<string, unknown> = {
  circuit,
  bit,
  bus,
  Adder,
  Comparator,
  Concat,
  Constant,
  Mux,
  Register,
  SignExtend,
  Slice,
  ZeroExtend,
};

/** Compile sandbox-style source and return the named entry circuit. */
function recompile(source: string, entryName: string): BuiltCircuit {
  const names = Object.keys(INJECT);
  // biome-ignore lint/security/noGlobalEval: sandbox-equivalent script-body eval
  const fn = new Function(...names, `${source}\nreturn ${entryName};`);
  return fn(...names.map((n) => INJECT[n])) as BuiltCircuit;
}

function importedTop(): BuiltCircuit {
  const { top, library } = importNetlist(netlist, 'top');
  const deps = [...library.values()].filter((c) => c.name !== top.name);
  return buildFromIR(top, deps);
}

describe('serializer round-trip (import → source → recompile → simulate)', () => {
  it('generated source is Rtl*-free and re-simulates to the iverilog golden', () => {
    const source = circuitToSource(importedTop());
    // cleanliness gate: no Rtl* primitive leaked into the emitted source
    expect(source).not.toMatch(/\bRtl[A-Z]/);

    const top = recompile(source, 'top');
    const sim = simulate(top);
    for (const v of golden.vectors) {
      sim.set(v.in);
      sim.tick();
      for (const [k, want] of Object.entries(v.out)) {
        expect(sim.get(k), `${k} for in=${JSON.stringify(v.in)}`).toBe(want);
      }
    }
    sim.dispose();
  });
});

describe('editability (scripted hand-edit → predicted behavioural change)', () => {
  it('flipping the adder carry-in constant 0 → 1 raises every `wide` output by 1', () => {
    const source = circuitToSource(importedTop());
    // The carry-in of the imported $add is a tied constant. Find it precisely:
    // it is the Constant that drives `.carry_in` — value 0 in the import.
    expect(source).toMatch(/_k1: Constant\(\{ width: 1, value: 0 \}\)/);
    const edited = source.replace(
      '_k1: Constant({ width: 1, value: 0 })',
      '_k1: Constant({ width: 1, value: 1 })',
    );
    expect(edited).not.toBe(source);

    const base = simulate(recompile(source, 'top'));
    const mod = simulate(recompile(edited, 'top'));
    for (const v of golden.vectors) {
      base.set(v.in);
      base.tick();
      mod.set(v.in);
      mod.tick();
      const expected = (((base.get('wide') as number) >>> 0) + 1) & 0xff;
      expect((mod.get('wide') as number) >>> 0, `wide for in=${JSON.stringify(v.in)}`).toBe(
        expected,
      );
    }
    base.dispose();
    mod.dispose();
  });
});
