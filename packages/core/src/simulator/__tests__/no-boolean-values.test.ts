/**
 * No booleans in the value domain.
 *
 * `BitValue` is `0 | 1`. Everything the simulator stores — port values and
 * sequential state alike — is numeric, and bit-ness lives in the port type
 * rather than in the JS type of the value.
 *
 * There are no boolean boundaries left. Not in `StateFieldValue`, not in
 * `PrimitiveState`, not in a primitive's options, not in `@simten/embed`'s
 * props. Every one that existed turned out to be a bug vector rather than an
 * ergonomic win — `sim.set()` converted numbers *to* booleans, `DFlipFlop`
 * stored boolean state, embed surfaced boolean outputs — so the "accept a
 * boolean and coerce" boundary was removed rather than made safe. A bit is 0
 * or 1, including at the API surface.
 *
 * The only reason any of this was survivable is that `tsconfig.json` excludes
 * tests from `tsc`, so none of those call sites was ever type-checked.
 *
 * Three risks remain, and all three are covered below.
 *
 * 1. IR that did not come from `circuit()` — deserialized JSON, an imported
 *    netlist, the sandbox boundary, a hand-built fixture — where the declared
 *    types were never enforced at runtime. Verified to fail when its coercion
 *    in `sequential-init.ts` is removed.
 *
 * 2. The stdlib itself. `DFlipFlop` kept its state boolean via
 *    `onTick: ({ d }) => ({ value: Boolean(d) })`, and the entire suite passed
 *    — a fixture-only test covers none of the primitives every real design is
 *    actually built from. Verified to fail when that is reintroduced.
 *
 * 3. Anything that reaches `topLevelInputs`. Note this map is NOT the
 *    write-only sink it looks like: `updateSequentialStates` (propagate.ts,
 *    the `srcNodeIdx === -1` branch) reads it **raw** to build `onTick`'s
 *    inputs, bypassing the `Int32Array` — so a boolean there lands directly in
 *    sequential state. The end-to-end case below caught exactly that: `set()`
 *    in `sim/simulate.ts` used to do `Boolean(value)` for bit ports, a
 *    leftover from when `BitValue` was `boolean`, and every bit-driven
 *    `onTick` produced boolean state as a result.
 *
 * `findBooleans` is proved capable of failing before it is trusted (first
 * case), in the same spirit as the `fault-check.ts` harnesses under
 * hardware/ulx3s.
 */

import { describe, expect, it } from 'vitest';
import { bit, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/simulate.js';
import { DFlipFlop } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { createSimulator, elaborate } from '../index.js';

/** Every boolean reachable in `value`, reported by path. Maps are opaque leaves. */
function findBooleans(label: string, value: unknown, out: string[] = []): string[] {
  if (typeof value === 'boolean') {
    out.push(`${label} = ${value}`);
  } else if (value && typeof value === 'object' && !(value instanceof Map)) {
    for (const [k, v] of Object.entries(value)) findBooleans(`${label}.${k}`, v, out);
  }
  return out;
}

/**
 * A stateful primitive. State is numeric: `StateFieldValue` no longer permits
 * boolean, so the boolean case can only be planted on the IR directly (below),
 * which is exactly the untrusted-IR path this file exists to pin.
 */
const BoolStateFF = circuit('BoolStateFF', {
  inputs: { d: bit },
  outputs: { q: bit },
  state: { held: 0 },
  eval: ({ held }) => ({ q: held }),
  onTick: ({ d }) => ({ held: d }),
});

const Top = circuit('Top', {
  inputs: { a: bit },
  outputs: { q: bit },
  nodes: { ff: BoolStateFF },
  connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.a.to(ff.d), ff.q.to(outputs.q)],
});

function libraryFor(circuits: Circuit[]): CircuitLibrary {
  const byName = new Map(circuits.map((c) => [c.name, c]));
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
  };
}

describe('no booleans in the value domain', () => {
  it('findBooleans detects one (the detector is not vacuous)', () => {
    expect(findBooleans('x', { a: 1, b: { c: false } })).toEqual(['x.b.c = false']);
    expect(findBooleans('x', { a: 1, b: { c: 0 } })).toEqual([]);
    // Maps are leaves — memory contents are not walked.
    expect(findBooleans('x', new Map([[0, 1]]))).toEqual([]);
  });

  it('coerces a boolean initialValue on IR that did not come from circuit()', () => {
    // Deserialized JSON, an imported netlist and the sandbox boundary can all
    // deliver a Circuit whose declared types were never enforced at runtime.
    // This is the only route to `sequential-init`'s declared-value path:
    // circuit() coerces a boolean `state:` at authoring time, so nothing built
    // through the builder reaches it.
    const ff = structuredClone(BoolStateFF.circuit);
    (ff.state[0] as { initialValue: unknown }).initialValue = false;

    const library = libraryFor([ff, Top.circuit]);
    const sim = createSimulator(elaborate(Top.circuit, library), { componentLibrary: library });
    sim.runCombinational();

    const found: string[] = [];
    for (const [k, v] of sim.getState()?.currentState ?? new Map()) {
      findBooleans(`state.${k}`, v, found);
    }
    expect(found).toEqual([]);
  });

  it('keeps the serialized IR numeric for factory-built primitives', () => {
    // The IR is a separate surface from runtime state, and checking only the
    // latter hides bugs: `circuit()`'s factory path normalises per-instance
    // state initials and set bit state to `false`, so every factory-built
    // primitive with bit state — DFlipFlop among them — carried a boolean
    // `initialValue` in its serialized IR. Runtime state looked fine because
    // sequential-init coerces on read. The IR crosses the sandbox boundary and
    // feeds the Verilog exporter, so it is the surface that matters.
    const found: string[] = [];
    for (const sb of DFlipFlop().circuit.state) {
      findBooleans(`ir.${sb.name}.initialValue`, sb.initialValue, found);
    }
    expect(found).toEqual([]);
  });

  it('keeps stdlib sequential state numeric', () => {
    // The stdlib is the gap a fixture-only test leaves. `DFlipFlop` stored its
    // state as a boolean (`onTick: ({ d }) => ({ value: Boolean(d) })`) and all
    // 752 tests passed — it is the most-used sequential primitive there is, so
    // every register in every design carried boolean state.
    const Latch = circuit('Latch', {
      inputs: { d: bit },
      outputs: { q: bit },
      nodes: { ff: DFlipFlop() },
      connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.d.to(ff.d), ff.q.to(outputs.q)],
    });

    const sim = simulate(Latch);
    sim.set({ d: 1 });
    sim.tick();

    const snap = sim.snapshot() as unknown as {
      sequentialState?: { currentState?: Map<string, unknown> };
    };
    const found: string[] = [];
    for (const [k, v] of snap.sequentialState?.currentState ?? new Map()) {
      findBooleans(`state.${k}`, v, found);
    }
    expect(found).toEqual([]);
    sim.dispose();
  });

  it('keeps authored state and port values numeric end to end', () => {
    const sim = simulate(Top);
    sim.set({ a: 1 });
    sim.tick();

    const snap = sim.snapshot() as unknown as {
      portValues: Map<string, unknown>;
      sequentialState?: { currentState?: Map<string, unknown> };
    };
    const found: string[] = [];
    for (const [k, v] of snap.portValues) findBooleans(`port.${k}`, v, found);
    for (const [k, v] of snap.sequentialState?.currentState ?? new Map()) {
      findBooleans(`state.${k}`, v, found);
    }
    expect(found).toEqual([]);
    sim.dispose();
  });
});
