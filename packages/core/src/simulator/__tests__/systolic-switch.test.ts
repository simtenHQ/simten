/**
 * Test: Systolic array with Switch(value=1) — matching the exact editor path
 */

import { describe, it, expect } from 'vitest';
import {
  SimulationSession,
  createSimulator,
  createComponentLibrary,
  elaborate,
  PRIMITIVES,
} from '../index.js';
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from '../../dsl/index.js';
import type { Circuit } from '../../types/circuit.js';

function createMutableLibrary() {
  const circuitMap = new Map<string, Circuit>();
  for (const c of PRIMITIVES as Circuit[]) circuitMap.set(c.name, c);
  return {
    resolveComponent: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => Array.from(circuitMap.entries())
      .filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => { circuitMap.set(circuit.name, circuit); },
  } satisfies DSLComponentLibrary;
}

// Minimal test: Switch(value=1) feeding a sequential circuit
const SIMPLE_DSL = `
circuit CountIfStarted {
  clock clk
  impl {
    node start: Switch(value=1)
    node counter: Register(initial=0)
    node inc: Incrementer
    node mux: Mux
    node one: Constant(value=1)

    connect counter.q -> inc.in
    connect start.out -> mux.sel
    connect counter.q -> mux.in0
    connect inc.out -> mux.in1
    connect mux.out -> counter.data
    connect one.out -> counter.we
    connect clk -> counter.clk

    node display: HexDisplay
    connect counter.q -> display.in
  }
}
`;

describe('Switch(value=1) in session', () => {
  it('switch initial value=1 is picked up by engine', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(SIMPLE_DSL, lib, 'test.dsl');
    expect(result.errors).toEqual([]);

    const circuit = result.circuits[result.circuits.length - 1];
    const flat = elaborate(circuit, lib);

    // Check the switch node's initial value
    const switchNode = flat.nodes.find(n => n.primitiveType === 'Switch');
    console.log('Switch node:', switchNode?.id, 'args:', switchNode?.arguments);

    const sim = createSimulator(flat, { componentLibrary: lib });
    sim.runCombinational();

    // Check switch output before any ticks
    const pv0 = sim.getPortValues();
    for (const [k, v] of pv0) {
      if (k.includes('start') && k.endsWith('.out')) {
        console.log('Switch output before tick:', k, '=', v);
      }
      if (k.includes('display') && k.endsWith('.in')) {
        console.log('Display before tick:', k, '=', v);
      }
    }

    // Tick 5 times
    for (let i = 0; i < 5; i++) {
      sim.tick();
      const pv = sim.getPortValues();
      let displayVal: number | boolean | undefined;
      for (const [k, v] of pv) {
        if (k.includes('display') && k.endsWith('.in')) displayVal = v;
      }
      console.log(`Cycle ${i + 1}: display = ${displayVal}`);
    }
  });

  it('same thing through SimulationSession', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(SIMPLE_DSL, lib, 'test.dsl');
    const circuit = result.circuits[result.circuits.length - 1];
    const flat = elaborate(circuit, lib);
    const engine = createSimulator(flat, { componentLibrary: lib });
    engine.runCombinational();

    const session = new SimulationSession(engine, { isSequential: true });

    for (let i = 0; i < 5; i++) {
      session.tick();
      const state = session.getState();
      let displayVal: number | boolean | undefined;
      for (const [k, v] of state.portValues) {
        if (k.includes('display') && k.endsWith('.in')) displayVal = v;
      }
      console.log(`Session cycle ${i + 1}: display = ${displayVal}`);
    }

    expect(session.getState().cycle).toBe(5);
  });
});
