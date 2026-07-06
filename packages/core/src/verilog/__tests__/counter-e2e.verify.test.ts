/**
 * End-to-end co-simulation: Register + Adder + Mux counter.
 *
 * This is the capstone of WS4d's primitive tests — it composes four
 * independently-verified primitives (Register, Adder, Mux, Or, plus
 * Constants) into one circuit and proves the whole
 * exporter → testbench-gen → verifier → iverilog loop works on
 * multi-primitive designs, not just single-primitive harnesses.
 *
 * Counter behavior:
 *   - `enable=1`: count increments by 1 each cycle, wrapping at 256.
 *   - `enable=0` and `clear=0`: count holds.
 *   - `clear=1`: count loads 0 on next edge (takes priority over enable).
 *
 * The 20-cycle sequence mixes all three cases and compares every
 * cycle's output between the JS simulator and iverilog.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { Adder, Register, Constant, Mux, Or } from '../../std/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { verifyVerilog, hasVerifier } from './verify.js';

interface Step {
  enable: number;
  clear: number;
}

// 20-cycle sequence: count up, hold, more count, clear, count up again.
const SEQUENCE: Step[] = [
  { enable: 1, clear: 0 }, // 1: 0 → 1
  { enable: 1, clear: 0 }, // 2: 1 → 2
  { enable: 1, clear: 0 }, // 3: 2 → 3
  { enable: 1, clear: 0 }, // 4: 3 → 4
  { enable: 0, clear: 0 }, // 5: holds at 4
  { enable: 0, clear: 0 }, // 6: holds at 4
  { enable: 1, clear: 0 }, // 7: 4 → 5
  { enable: 1, clear: 0 }, // 8: 5 → 6
  { enable: 1, clear: 0 }, // 9: 6 → 7
  { enable: 0, clear: 1 }, // 10: clear → 0 (clear priority via we_or)
  { enable: 1, clear: 0 }, // 11: 0 → 1
  { enable: 1, clear: 0 }, // 12: 1 → 2
  { enable: 1, clear: 0 }, // 13: 2 → 3
  { enable: 1, clear: 0 }, // 14: 3 → 4
  { enable: 1, clear: 0 }, // 15: 4 → 5
  { enable: 1, clear: 0 }, // 16: 5 → 6
  { enable: 1, clear: 0 }, // 17: 6 → 7
  { enable: 1, clear: 0 }, // 18: 7 → 8
  { enable: 1, clear: 0 }, // 19: 8 → 9
  { enable: 1, clear: 0 }, // 20: 9 → 10
];

function buildCounter() {
  // Data flow:
  //   reg.q     → adder.a   (+ out.count)
  //   1         → adder.b   (increment)
  //   0         → adder.carry_in, mux.in1
  //   adder.sum → mux.in0   (next value when not clearing)
  //   clear     → mux.sel   (picks between sum (0) and zero (1))
  //   clear|enable → reg.we (so clear writes even with enable=0)
  //   mux.out   → reg.data
  const Counter = circuit('Counter', {
    inputs: { enable: bit, clear: bit },
    outputs: { count: bus(8) },
    nodes: {
      reg: Register(),
      add: Adder(),
      one: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
      mux: Mux(),
      weOr: Or,
    },
    connect: ({ inputs, outputs, nodes: { reg, add, one, zero, mux, weOr } }) => [
      reg.q.to(add.a, outputs.count),
      one.out.to(add.b),
      zero.out.to(add.carry_in, mux.in1),
      add.sum.to(mux.in0),
      inputs.clear.to(mux.sel, weOr.a),
      inputs.enable.to(weOr.b),
      weOr.out.to(reg.we),
      mux.out.to(reg.data),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'Counter') return Counter.circuit;
      const dep = Counter._dependencies.get(name);
      return dep?.circuit;
    },
    getAllPrimitiveNames: () => [...Counter._dependencies.keys()],
  };

  return { circuit: Counter.circuit, lib };
}

function runSimulator(steps: Step[]): number[] {
  const { circuit, lib } = buildCounter();
  const sim = createSimulatorFromCircuit(circuit, lib);
  const outputs: number[] = [];
  for (const step of steps) {
    sim.setNode('enable', step.enable);
    sim.setNode('clear', step.clear);
    sim.tick();
    const v = sim.getPortValues().get('__top__.count');
    outputs.push(typeof v === 'number' ? (v >>> 0) & 0xff : 0);
  }
  return outputs;
}

function buildVectors(steps: Step[]): SequentialTestVector[] {
  return steps.map((s, i) => ({
    cycle: i + 1,
    setInputs: { enable: s.enable, clear: s.clear },
    expect: { count: 0 },
  }));
}

const d = describe.skipIf(!hasVerifier());

d('Counter (Register+Adder+Mux+Or) — end-to-end co-simulation', () => {
  it('counts, holds, and clears across 20 cycles; JS sim and iverilog agree', {
    timeout: 30000,
  }, async () => {
    const simOutputs = runSimulator(SEQUENCE);

    // Sanity-check the JS sim produced the expected behavior before we
    // pay the verifier round-trip.
    expect(simOutputs[0]).toBe(1); // first increment
    expect(simOutputs[3]).toBe(4); // 4 enables
    expect(simOutputs[4]).toBe(4); // hold
    expect(simOutputs[5]).toBe(4); // hold
    expect(simOutputs[9]).toBe(0); // clear
    expect(simOutputs[19]).toBe(10); // 10 increments after clear

    const { circuit, lib } = buildCounter();
    const { verilog } = exportVerilog(circuit, lib);
    const testbench = generateSequentialTestbench(circuit, buildVectors(SEQUENCE));

    const result = await verifyVerilog(verilog, testbench);

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('verifier response:', JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();
    expect(result.results!.length).toBe(SEQUENCE.length);

    const veriOutputs = result
      .results!.sort((a, b) => a.testCase - b.testCase)
      .map((r) => r.outputs.count & 0xff);

    expect(veriOutputs).toEqual(simOutputs);
  });
});
