/**
 * Editor Flow Tests
 *
 * Tests the exact sequence the editor follows:
 * 1. DSL string arrives (from editor compile)
 * 2. compileDSL → elaborate → createSimulator
 * 3. SimulationSession wraps it
 * 4. Tick, toggle, time-travel
 *
 * These tests exercise the same code path as useCircuitSimulator
 * without needing React.
 */

import { describe, it, expect } from 'vitest';
import {
  SimulationSession,
  createSimulator,
  elaborate,
  PRIMITIVES,
} from '../index.js';
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from '../../dsl/index.js';
import type { Circuit } from '../../types/circuit.js';

// Same mutable library pattern as useCircuitSimulator
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

/** Mimics what useCircuitSimulator does internally */
function compileAndCreateSession(dsl: string) {
  const library = createMutableLibrary();
  const result = compileDSL(dsl, library, 'editor.dsl');
  if (result.errors.length > 0) throw new Error(result.errors.map(e => e.message).join('; '));
  if (result.circuits.length === 0) throw new Error('No circuits');

  const mainCircuit = result.circuits[result.circuits.length - 1];
  const flat = elaborate(mainCircuit, library);

  // Detect sequential
  let isSequential = !!(mainCircuit.clocks && mainCircuit.clocks.length > 0);
  if (!isSequential) {
    for (const node of flat.nodes) {
      if (node.primitiveType) {
        const def = library.resolveComponent(node.primitiveType);
        if (def && def.clocks && def.clocks.length > 0) { isSequential = true; break; }
      }
    }
  }

  const engine = createSimulator(flat, { componentLibrary: library });
  engine.runCombinational();

  const session = new SimulationSession(engine, { isSequential });
  return { session, mainCircuit, flat, library, engine };
}

function readDisplay(pv: ReadonlyMap<string, boolean | number>, name: string): number | boolean | undefined {
  for (const [k, v] of pv) {
    if (k.includes(name) && k.endsWith('.in')) return v;
  }
  return undefined;
}

// ── Tests ──

describe('Editor flow: DSL → Session → Tick', () => {

  it('combinational AND gate responds to input changes', () => {
    const { session } = compileAndCreateSession(`
      circuit Demo {
        impl {
          node sw_a: Switch
          node sw_b: Switch
          node and1: And
          node led: Led
          connect sw_a.out -> and1.a
          connect sw_b.out -> and1.b
          connect and1.out -> led.in
        }
      }
    `);

    // Initially both off
    let pv = session.getState().portValues;
    expect(readDisplay(pv, 'led')).toBe(false);

    // Toggle both on via engine
    const engine = session.getEngine()!;
    const nodes = Array.from(pv.keys());
    for (const k of nodes) {
      if (k.includes('sw_a') && k.endsWith('.out')) {
        const nodeId = k.slice(0, k.lastIndexOf('.'));
        engine.setInput(nodeId, true);
      }
      if (k.includes('sw_b') && k.endsWith('.out')) {
        const nodeId = k.slice(0, k.lastIndexOf('.'));
        engine.setInput(nodeId, true);
      }
    }
    session.runCombinational();
    pv = session.getState().portValues;
    expect(readDisplay(pv, 'led')).toBe(true);

    session.dispose();
  });

  it('sequential counter ticks correctly', () => {
    const { session } = compileAndCreateSession(`
      circuit Counter {
        clock clk
        impl {
          node counter: Register(initial=0)
          node inc: Incrementer
          node one: Constant(value=1)
          connect counter.q -> inc.in
          connect inc.out -> counter.data
          connect one.out -> counter.we
          connect clk -> counter.clk
          node display: HexDisplay
          connect counter.q -> display.in
        }
      }
    `);

    expect(session.getState().isSequential).toBe(true);
    expect(session.getState().cycle).toBe(0);

    session.tick();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(1);

    session.tick();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(2);

    session.tick();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(3);

    session.dispose();
  });

  it('Switch(value=1) is picked up on first tick', () => {
    const { session } = compileAndCreateSession(`
      circuit Demo {
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
    `);

    // start=1 so counter should advance
    session.tick();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(1);
    session.tick();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(2);

    session.dispose();
  });

  it('time-travel preserves and restores state', () => {
    const { session } = compileAndCreateSession(`
      circuit Counter {
        clock clk
        impl {
          node counter: Register(initial=0)
          node inc: Incrementer
          node one: Constant(value=1)
          connect counter.q -> inc.in
          connect inc.out -> counter.data
          connect one.out -> counter.we
          connect clk -> counter.clk
          node display: HexDisplay
          connect counter.q -> display.in
        }
      }
    `);

    session.tick(); // cycle 1, display=1
    session.tick(); // cycle 2, display=2
    session.tick(); // cycle 3, display=3

    expect(readDisplay(session.getState().portValues, 'display')).toBe(3);

    session.stepBack();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(2);
    expect(session.getState().isViewingPast).toBe(true);

    session.stepBack();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(1);

    session.stepForward();
    expect(readDisplay(session.getState().portValues, 'display')).toBe(2);

    session.dispose();
  });

  it('input change during sequential simulation does not reset', () => {
    const { session } = compileAndCreateSession(`
      circuit Demo {
        clock clk
        impl {
          node sw: Switch
          node counter: Register(initial=0)
          node inc: Incrementer
          node one: Constant(value=1)
          connect counter.q -> inc.in
          connect inc.out -> counter.data
          connect one.out -> counter.we
          connect clk -> counter.clk
          node display: HexDisplay
          connect counter.q -> display.in
          node led: Led
          connect sw.out -> led.in
        }
      }
    `);

    session.tick();
    session.tick();
    session.tick();
    expect(session.getState().cycle).toBe(3);
    expect(readDisplay(session.getState().portValues, 'display')).toBe(3);

    // Toggle switch (simulates keyboard input) — should NOT reset cycle
    const engine = session.getEngine()!;
    for (const [k] of session.getState().portValues) {
      if (k.includes('sw') && k.endsWith('.out')) {
        const nodeId = k.slice(0, k.lastIndexOf('.'));
        engine.setInput(nodeId, true);
        break;
      }
    }
    // Run combinational to see the LED change, but don't tick
    session.runCombinational();

    // Cycle should still be 3
    expect(session.getState().cycle).toBe(3);
    // LED should now be on
    expect(readDisplay(session.getState().portValues, 'led')).toBe(true);

    // Continue ticking
    session.tick();
    expect(session.getState().cycle).toBe(4);
    expect(readDisplay(session.getState().portValues, 'display')).toBe(4);

    session.dispose();
  });

  it('composite circuits compile and simulate through session', () => {
    const { session } = compileAndCreateSession(`
      circuit HalfAdder {
        input a: Bit
        input b: Bit
        output sum: Bit
        output carry: Bit
        impl {
          node xor1: Xor
          node and1: And
          connect a -> xor1.a
          connect b -> xor1.b
          connect xor1.out -> sum
          connect a -> and1.a
          connect b -> and1.b
          connect and1.out -> carry
        }
      }

      circuit Demo {
        impl {
          node sw_a: Switch
          node sw_b: Switch
          node ha: HalfAdder
          node led_sum: Led
          node led_carry: Led
          connect sw_a.out -> ha.a
          connect sw_b.out -> ha.b
          connect ha.sum -> led_sum.in
          connect ha.carry -> led_carry.in
        }
      }
    `);

    // Both off: sum=0, carry=0
    let pv = session.getState().portValues;
    expect(readDisplay(pv, 'led_sum')).toBe(false);
    expect(readDisplay(pv, 'led_carry')).toBe(false);

    // Toggle both on: sum=0 (1+1=10), carry=1
    const engine = session.getEngine()!;
    for (const [k] of pv) {
      if (k.includes('sw_a') && k.endsWith('.out')) {
        engine.setInput(k.slice(0, k.lastIndexOf('.')), true);
      }
      if (k.includes('sw_b') && k.endsWith('.out')) {
        engine.setInput(k.slice(0, k.lastIndexOf('.')), true);
      }
    }
    session.runCombinational();
    pv = session.getState().portValues;
    expect(readDisplay(pv, 'led_sum')).toBe(false); // 1 XOR 1 = 0
    expect(readDisplay(pv, 'led_carry')).toBe(true); // 1 AND 1 = 1

    session.dispose();
  });

  it('setNode loads ROM data without resetting simulation', () => {
    const { session, flat } = compileAndCreateSession(`
      circuit Demo {
        clock clk
        impl {
          node imem: RV32I_InstrMem
          node addr: Input(value=0)
          node display: HexDisplay
          connect addr.out -> imem.addr
          connect imem.instruction -> display.in
        }
      }
    `);

    // Tick a few times to advance the simulation
    session.tick();
    session.tick();
    session.tick();
    expect(session.getState().cycle).toBe(3);

    // Find the InstrMem node ID in the flat circuit
    const imemNode = flat.nodes.find(n => n.primitiveType === 'RV32I_InstrMem');
    expect(imemNode).toBeDefined();

    // Load a simple RISC-V instruction into ROM via setNode
    // addi x1, x0, 42  →  0x02A00093 → bytes: 93 00 A0 02
    const romData = new Map<number, number>();
    romData.set(0, 0x93);
    romData.set(1, 0x00);
    romData.set(2, 0xA0);
    romData.set(3, 0x02);

    const engine = session.getEngine()!;
    engine.setNode(imemNode!.id, romData);
    session.runCombinational();

    // Cycle should still be 3 — no reset
    expect(session.getState().cycle).toBe(3);

    // Display should show the instruction at addr 0: 0x02A00093
    const displayVal = readDisplay(session.getState().portValues, 'display');
    expect(displayVal).toBe(0x02A00093);

    session.dispose();
  });

  it('DSL recompile creates fresh session (simulates editor flow)', () => {
    // First compile
    const { session: session1 } = compileAndCreateSession(`
      circuit Counter {
        clock clk
        impl {
          node counter: Register(initial=0)
          node inc: Incrementer
          node one: Constant(value=1)
          connect counter.q -> inc.in
          connect inc.out -> counter.data
          connect one.out -> counter.we
          connect clk -> counter.clk
          node display: HexDisplay
          connect counter.q -> display.in
        }
      }
    `);

    session1.tick();
    session1.tick();
    expect(session1.getState().cycle).toBe(2);
    session1.dispose();

    // Second compile (user edits DSL) — fresh session, starts at 0
    const { session: session2 } = compileAndCreateSession(`
      circuit Counter {
        clock clk
        impl {
          node counter: Register(initial=0)
          node inc: Incrementer
          node one: Constant(value=1)
          connect counter.q -> inc.in
          connect inc.out -> counter.data
          connect one.out -> counter.we
          connect clk -> counter.clk
          node display: HexDisplay
          connect counter.q -> display.in
        }
      }
    `);

    expect(session2.getState().cycle).toBe(0);
    session2.tick();
    expect(readDisplay(session2.getState().portValues, 'display')).toBe(1);
    session2.dispose();
  });
});
