/**
 * Behavior belongs to a compile, not to the process (#465, decision 0001).
 *
 * Each compile collects the eval/onTick of exactly the circuits it built, and
 * the engine runs that table. These pin the consequences: same-named circuits
 * in different compiles never meet, a user circuit named like a std one changes
 * nothing outside its own design, defining a circuit registers nothing, and two
 * different circuits under one name inside one design are an error rather than
 * one silently running as the other.
 */

import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import type { CircuitIR } from '../../ir/circuit-ir.js';
import { createEngine, elaborate } from '../../simulator/index.js';
import { simulate } from '../../simulator/simulate.js';
import { Adder } from '../../std/index.js';
import { getStdLibrary } from '../../std/library.js';
import { createDefinitions, libraryOf } from '../behavior.js';
import { bit, bus } from '../bit-bus.js';
import { circuit } from '../circuit.js';
import { type ExecuteResult, executeCircuitCode } from '../execute.js';
import { internalsOf } from '../internals.js';

/** Run a compiled source's last circuit with the compile's own library and behavior. */
function run(result: ExecuteResult, inputs: Record<string, number>): Record<string, number> {
  expect(result.error).toBeNull();
  const top = result.circuits[result.circuits.length - 1];
  const engine = createEngine(elaborate(top, result.library.definitions), {
    library: result.library,
  });
  for (const [name, value] of Object.entries(inputs)) engine.setNode(name, value);
  engine.runCombinational();
  const out: Record<string, number> = {};
  for (const p of top.outputs)
    out[p.name] = Number(engine.getPortValues().get(`__top__.${p.name}`));
  return out;
}

/** A primitive `Twin` with the given body, wrapped in a top so it is simulated as a node. */
const twinSource = (body: string) => `
  const Twin = circuit('Twin', { inputs: { a: bus(8) }, outputs: { y: bus(8) }, eval: ({ a }) => ({ y: ${body} }) });
  const Top = circuit('TwinTop', {
    inputs: { a: bus(8) }, outputs: { y: bus(8) }, nodes: { t: Twin },
    connect: ({ inputs, outputs, nodes: { t } }) => [inputs.a.to(t.a), t.y.to(outputs.y)],
  });
`;

const FAKE_ADDER = `
  const MyAdder = circuit('Adder', {
    inputs: { a: bus(8), b: bus(8), carry_in: bit },
    outputs: { sum: bus(8), carry_out: bit },
    eval: () => ({ sum: 99, carry_out: 0 }),
  });
`;

const wire = `connect: ({ inputs, outputs, nodes: { u } }) => [
  inputs.a.to(u.a), inputs.b.to(u.b), u.sum.to(outputs.sum),
]`;

describe('two compiles never share behavior', () => {
  it('same-named circuits with different evals keep their own, in either order', () => {
    const plusOne = executeCircuitCode(twinSource('a + 1'));
    const timesTwo = executeCircuitCode(twinSource('a * 2'));
    // Run the first compile after the second one has defined its own 'Twin'.
    expect(run(plusOne, { a: 5 })).toEqual({ y: 6 });
    expect(run(timesTwo, { a: 5 })).toEqual({ y: 10 });
  });

  it('two built circuits that share a name simulate as themselves', () => {
    const make = (fn: (a: number) => number) => {
      const Twin = circuit('BTTwin', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        eval: ({ a }) => ({ y: fn(a) }),
      });
      return circuit('BTTwinTop', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        nodes: { t: Twin },
        connect: ({ inputs, outputs, nodes: { t } }) => [inputs.a.to(t.a), t.y.to(outputs.y)],
      });
    };
    const plusOne = make((a) => a + 1);
    const timesTwo = make((a) => a * 2);
    const first = simulate(plusOne);
    first.set({ a: 5 });
    const second = simulate(timesTwo);
    second.set({ a: 5 });
    expect([first.get('y'), second.get('y')]).toEqual([6, 10]);
  });
});

describe('a user circuit named like a std one', () => {
  it("doesn't change the std Adder in another compile", () => {
    // Both std users exist before the user's Adder is defined, and run after.
    const std = executeCircuitCode(`
      const Top = circuit('StdAdderTop', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { sum: bus(8) }, nodes: { u: Adder({ width: 8 }) }, ${wire},
      });`);
    const stdAdder = Adder({ width: 8 });

    const user = executeCircuitCode(
      `${FAKE_ADDER}
      const Top = circuit('UserAdderTop', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { sum: bus(8) }, nodes: { u: MyAdder }, ${wire},
      });`,
    );
    expect(run(user, { a: 2, b: 3 })).toEqual({ sum: 99 });
    expect(run(std, { a: 2, b: 3 })).toEqual({ sum: 5 });

    const sim = simulate(stdAdder);
    sim.set({ a: 2, b: 3, carry_in: 0 });
    expect(sim.get('sum')).toBe(5);
  });

  it('runs as itself in a design that uses only it', () => {
    const user = executeCircuitCode(
      `${FAKE_ADDER}
      const Top = circuit('OnlyUserAdder', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { sum: bus(8) }, nodes: { u: MyAdder }, ${wire},
      });`,
    );
    expect(run(user, { a: 2, b: 3 })).toEqual({ sum: 99 });
  });

  it('is an error when used together with the std one in one design', () => {
    const both = executeCircuitCode(
      `${FAKE_ADDER}
      const Top = circuit('BothAdders', {
        inputs: { a: bus(8), b: bus(8) },
        outputs: { mine: bus(8), std: bus(8) },
        nodes: { mine: MyAdder, std: Adder({ width: 8 }) },
        connect: ({ inputs, outputs, nodes: { mine, std } }) => [
          inputs.a.to(mine.a, std.a), inputs.b.to(mine.b, std.b),
          mine.sum.to(outputs.mine), std.sum.to(outputs.std),
        ],
      });`,
    );
    expect(both.error).toMatch(/Two different circuits are named 'Adder' in this design/);
    expect(both.error).toMatch(/rename/);
  });

  it('is an error when the two meet deeper in the tree', () => {
    const nested = executeCircuitCode(
      `${FAKE_ADDER}
      const Mine = circuit('MineWrap', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { sum: bus(8) }, nodes: { u: MyAdder }, ${wire},
      });
      const Theirs = circuit('TheirsWrap', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { sum: bus(8) }, nodes: { u: Adder({ width: 8 }) }, ${wire},
      });
      const Top = circuit('NestedBoth', {
        inputs: { a: bus(8), b: bus(8) }, outputs: { x: bus(8), y: bus(8) },
        nodes: { m: Mine, t: Theirs },
        connect: ({ inputs, outputs, nodes: { m, t } }) => [
          inputs.a.to(m.a, t.a), inputs.b.to(m.b, t.b), m.sum.to(outputs.x), t.sum.to(outputs.y),
        ],
      });`,
    );
    expect(nested.error).toMatch(/Two different circuits are named 'Adder' in this design/);
  });

  it('specialisations of one factory are one circuit, not a collision', () => {
    const widths = executeCircuitCode(`
      const Top = circuit('TwoWidths', {
        inputs: { a: bus(8), b: bus(8), c: bus(16), d: bus(16) },
        outputs: { s8: bus(8), s16: bus(16) },
        nodes: { n: Adder({ width: 8 }), w: Adder({ width: 16 }) },
        connect: ({ inputs, outputs, nodes: { n, w } }) => [
          inputs.a.to(n.a), inputs.b.to(n.b), inputs.c.to(w.a), inputs.d.to(w.b),
          n.sum.to(outputs.s8), w.sum.to(outputs.s16),
        ],
      });`);
    expect(run(widths, { a: 200, b: 100, c: 40000, d: 1000 })).toEqual({ s8: 44, s16: 41000 });
  });
});

describe('defining a circuit registers nothing', () => {
  const Probe = circuit('BTRegistersNothing', {
    inputs: { a: bit },
    outputs: { y: bit },
    eval: ({ a }) => ({ y: a }),
  });

  /** The probe as a node of hand-built IR, so nothing but the table supplies its eval. */
  const wrapper: CircuitIR = {
    version: 1,
    name: 'BTProbeTop',
    inputs: [{ name: 'a', portType: { kind: 'bit' } }],
    outputs: [{ name: 'y', portType: { kind: 'bit' } }],
    clocks: [],
    state: [],
    nodes: [
      {
        id: 'p',
        componentRef: 'BTRegistersNothing',
        arguments: {},
        inputs: [{ id: 'p.a', name: 'a', portType: { kind: 'bit' } }],
        outputs: [{ id: 'p.y', name: 'y', portType: { kind: 'bit' } }],
        clocks: [],
      },
    ],
    connections: [
      {
        id: 'c0',
        source: { nodeId: '', portName: 'a' },
        target: { nodeId: 'p', portName: 'a' },
        portType: { kind: 'bit' },
      },
      {
        id: 'c1',
        source: { nodeId: 'p', portName: 'y' },
        target: { nodeId: '', portName: 'y' },
        portType: { kind: 'bit' },
      },
    ],
    implementation: { kind: 'composite' },
  };

  it('a fresh compile has no behavior for it', () => {
    const definitions = createDefinitions();
    definitions.addCircuit(internalsOf(Probe).ir);
    definitions.addCircuit(wrapper);
    const engine = () =>
      createEngine(elaborate(wrapper, definitions), {
        library: { definitions, behaviors: new Map() },
      });
    expect(engine).toThrow(/'BTRegistersNothing' has no behavior in this compile/);
    expect(executeCircuitCode('').library.behaviors.has('BTRegistersNothing')).toBe(false);
    expect(getStdLibrary().behaviors.has('BTRegistersNothing')).toBe(false);
  });

  it('the built circuit has it, so its own design runs', () => {
    expect(libraryOf(Probe).behaviors.has('BTRegistersNothing')).toBe(true);
    const sim = simulate(Probe);
    sim.set({ a: 1 });
    expect(sim.get('y')).toBe(1);
  });
});

describe('behavior is kept beside the circuit, not on it', () => {
  it('leaves the built circuit with no extra properties', () => {
    const Plain = circuit('BTPlain', { inputs: { a: bit }, outputs: { y: bit } });
    const WithEval = circuit('BTWithEval', {
      inputs: { a: bit },
      outputs: { y: bit },
      eval: ({ a }) => ({ y: a }),
    });
    expect(Reflect.ownKeys(WithEval)).toEqual(Reflect.ownKeys(Plain));
  });

  it('frees circuits from earlier edits once nothing uses them', async () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;

    // Each edit in the editor recompiles the source and drops the previous
    // result. Compiled in a helper so this test's own frame holds none of them.
    const compileEdits = (count: number): WeakRef<object>[] => {
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < count; i++) {
        const result = executeCircuitCode(twinSource(`a + ${i}`));
        expect(result.error).toBeNull();
        for (const c of result.circuits) refs.push(new WeakRef(c));
      }
      return refs;
    };
    const refs = compileEdits(50);
    expect(refs).toHaveLength(100);

    // A WeakRef keeps its target alive until the current job ends.
    await new Promise((resolve) => setImmediate(resolve));
    gc();
    expect(refs.filter((ref) => ref.deref() !== undefined)).toHaveLength(0);
  });
});
