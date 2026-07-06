/**
 * Reset co-simulation verification.
 *
 * The highest-leverage test in the reset patch: builds a Counter from a
 * Register feeding an Adder, runs it forward N ticks in the JS simulator
 * AND through exporter-generated Verilog under iverilog in parallel, then
 * pulses reset mid-execution and confirms both traces snap back to the
 * initial state and stay in lockstep through the remaining cycles.
 *
 * This is the test that catches "reset arm forgot a state field" — the
 * highest-probability bug class introduced by the reset patch. If the
 * exporter ever emits a sequential primitive whose reset arm doesn't
 * actually restore initial state (or restores a different value than the
 * simulator), this co-sim test diverges immediately.
 *
 * The "bridge invariant" test below documents *why* the parity helper
 * (`buildParityTraceAcrossReset` in parity-helpers.ts) is load-bearing
 * today. It will start failing when issue #132 lands and the sim gains
 * cycle-accurate `assertReset`/`deassertReset` — that's the signal to
 * drop both the bridge helper and the invariant test itself.
 */

import { describe, expect, it } from 'vitest';
import { bus, circuit } from '../../circuit/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import { Adder, Constant, Register } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { exportVerilog } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { buildNaiveTraceAcrossReset, buildParityTraceAcrossReset } from './parity-helpers.js';
import { hasVerifier, verifyVerilog } from './verify.js';

function buildCounter() {
  const Counter = circuit('Counter', {
    outputs: { count: bus(8) },
    nodes: {
      reg: Register({ width: 8, value: 0 }),
      adder: Adder({ width: 8 }),
      one: Constant({ value: 1 }),
      we: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
    },
    connect: ({ outputs, nodes: { reg, adder, one, we, zero } }) => [
      reg.q.to(adder.a),
      one.out.to(adder.b),
      zero.out.to(adder.carry_in),
      adder.sum.to(reg.data),
      we.out.to(reg.we),
      reg.q.to(outputs.count),
    ],
  });

  const map = new Map<string, Circuit>();
  map.set(Counter.circuit.name, Counter.circuit);
  for (const [, dep] of Counter._dependencies) map.set(dep.circuit.name, dep.circuit);
  const lib: CircuitLibrary = {
    resolveCircuit: (name) => map.get(name),
    getAllPrimitiveNames: () => [...map.keys()],
  };

  return { circuit: Counter.circuit, lib };
}

const PRE = 5;
const POST = 3;

function buildResetVectors(): SequentialTestVector[] {
  // Cycle layout:
  //   1..PRE        — normal counting (rst_n high after testbench startup)
  //   PRE+1         — pulse rst_n=0; synchronous reset arms fire; count=0
  //   PRE+2..PRE+1+POST — back to normal counting
  const vectors: SequentialTestVector[] = [];
  for (let i = 1; i <= PRE; i++) {
    vectors.push({ cycle: i, expect: { count: 0 } });
  }
  vectors.push({ cycle: PRE + 1, setRstN: 0, expect: { count: 0 } });
  for (let i = 1; i <= POST; i++) {
    vectors.push({
      cycle: PRE + 1 + i,
      setRstN: i === 1 ? 1 : undefined,
      expect: { count: 0 },
    });
  }
  return vectors;
}

function readCount(sim: ReturnType<typeof createSimulatorFromCircuit>): number {
  const v = sim.getPortValues().get('__top__.count');
  return typeof v === 'number' ? (v >>> 0) & 0xff : 0;
}

async function runVerilogTrace(): Promise<number[]> {
  const { circuit, lib } = buildCounter();
  const { verilog } = exportVerilog(circuit, lib);
  const testbench = generateSequentialTestbench(circuit, buildResetVectors());
  const result = await verifyVerilog(verilog, testbench);

  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('verifier response:', JSON.stringify(result, null, 2));
  }
  expect(result.success).toBe(true);
  expect(result.results).toBeDefined();

  return result.results!.sort((a, b) => a.testCase - b.testCase).map((r) => r.outputs.count & 0xff);
}

const d = describe.skipIf(!hasVerifier());

d('reset — JS simulator vs iverilog co-simulation under rst_n', () => {
  it('mid-execution rst_n pulse: sim (via bridge) and hardware agree cycle-by-cycle', {
    timeout: 30000,
  }, async () => {
    const { circuit, lib } = buildCounter();
    const sim = createSimulatorFromCircuit(circuit, lib);

    const simOutputs = buildParityTraceAcrossReset(sim, PRE, POST, () => readCount(sim));
    const veriOutputs = await runVerilogTrace();

    expect(simOutputs.length).toBe(PRE + 1 + POST);
    expect(veriOutputs.length).toBe(PRE + 1 + POST);

    // The headline assertion: cycle-by-cycle sim and Verilog match across
    // the reset boundary. If any sequential primitive's reset arm forgets
    // a state field, the post-reset cycles diverge here.
    expect(veriOutputs).toEqual(simOutputs);
  });

  // ───────────────────────────────────────────────────────────────────
  // Bridge-invariant test: proves the parity helper is load-bearing.
  //
  // This test exists to document — by failing without it — *why* the
  // bridge in `buildParityTraceAcrossReset` is necessary today. If
  // anyone refactors the helper away or "simplifies" the parity test
  // by dropping the bridge sample, this test starts passing the wrong
  // assertion and trips them with a clear message.
  //
  // When issue #132 lands (cycle-accurate sim reset via
  // `assertReset`/`deassertReset` + per-primitive `onReset`), the naive
  // trace will start matching the Verilog trace — and THIS test will
  // start failing. That failure is the migration signal: drop
  // `buildParityTraceAcrossReset`, drop `buildNaiveTraceAcrossReset`,
  // drop this test, and rewrite the parity test above to compare
  // traces straight without any bridge.
  // ───────────────────────────────────────────────────────────────────
  it('bridge invariant: naive trace mismatches Verilog by exactly one element at the reset cycle (proves bridge is necessary; drop this when #132 lands)', {
    timeout: 30000,
  }, async () => {
    const { circuit, lib } = buildCounter();
    const sim = createSimulatorFromCircuit(circuit, lib);

    const naiveOutputs = buildNaiveTraceAcrossReset(sim, PRE, POST, () => readCount(sim));
    const veriOutputs = await runVerilogTrace();

    // Naive trace lacks the reset-cycle sample → exactly one element shorter.
    expect(naiveOutputs.length).toBe(PRE + POST);
    expect(veriOutputs.length).toBe(PRE + 1 + POST);

    // Pre-reset cycles still match — divergence starts at the reset cycle.
    for (let i = 0; i < PRE; i++) {
      expect(naiveOutputs[i]).toBe(veriOutputs[i]);
    }

    // The reset cycle in Verilog (index PRE) observes count=0; the naive
    // sim trace doesn't have an entry there — its index PRE is the first
    // post-reset tick, which observes count=1.
    expect(veriOutputs[PRE]).toBe(0);
    expect(naiveOutputs[PRE]).toBe(1);

    // Post-reset entries in the naive trace are offset by one vs Verilog —
    // not arbitrary divergence, just a shift. This is exactly what the
    // bridge corrects for.
    for (let i = 1; i <= POST; i++) {
      expect(naiveOutputs[PRE + i - 1]).toBe(veriOutputs[PRE + i]);
    }
  });
});
