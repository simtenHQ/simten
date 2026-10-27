/**
 * RAM co-simulation verification.
 *
 * Runs the same input sequence through (a) our JS simulator and (b) the
 * exporter-generated Verilog under iverilog, then asserts cycle-by-cycle
 * agreement. If the exporter ever drifts from simulator semantics, this
 * test is what catches it — which matters for behaviors that aren't
 * obvious (write-first vs read-first, same-cycle read/write, carry
 * propagation, etc.).
 *
 * This is the pattern every WS4d verify test should follow: drive
 * identical inputs into both engines, compare outputs.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import type { CircuitDefinitions } from '../../ir/circuit-ir.js';
import { createEngine, elaborate } from '../../simulator/index.js';
import { RAM } from '../../std/index.js';
import { getStdLibrary } from '../../std/library.js';
import { exportVerilogFromIR } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { hasVerifier, verifyVerilog } from './verify.js';

// Shared input sequence — drives both the JS sim and the iverilog testbench.
interface Step {
  addr: number;
  data_in: number;
  we: number;
}

const SEQUENCE: Step[] = [
  { addr: 5, data_in: 0xab, we: 1 }, // write 0xAB to [5]
  { addr: 7, data_in: 0xcd, we: 1 }, // write 0xCD to [7]
  { addr: 5, data_in: 0x00, we: 0 }, // read [5]
  { addr: 7, data_in: 0x00, we: 0 }, // read [7]
  { addr: 3, data_in: 0x00, we: 0 }, // read [3] — untouched, should be 0
];

function buildRam() {
  // RAM is a factory — it must be called (see ROM.verify.test.ts).
  const Ram = RAM();
  const RamWrapper = circuit('RamWrapper', {
    inputs: { addr: bus(8), data_in: bus(8), we: bit },
    outputs: { data_out: bus(8) },
    nodes: { r: Ram },
    connect: ({ inputs, outputs, nodes: { r } }) => [
      inputs.addr.to(r.addr),
      inputs.data_in.to(r.data_in),
      inputs.we.to(r.we),
      r.data_out.to(outputs.data_out),
    ],
  });

  const definitions: CircuitDefinitions = {
    resolveCircuit: (name) =>
      name === 'RamWrapper'
        ? internalsOf(RamWrapper).ir
        : name === 'RAM'
          ? internalsOf(Ram).ir
          : undefined,
    getAllPrimitiveNames: () => ['RAM'],
  };

  return { circuit: internalsOf(RamWrapper).ir, definitions };
}

function runSimulator(steps: Step[]): number[] {
  const { circuit, definitions } = buildRam();
  const sim = createEngine(elaborate(circuit, definitions), {
    library: { definitions, behaviors: getStdLibrary().behaviors },
  });
  const outputs: number[] = [];

  for (const step of steps) {
    sim.setNode('addr', step.addr);
    sim.setNode('data_in', step.data_in);
    sim.setNode('we', step.we);
    sim.tick();
    const v = sim.getPortValues().get('__top__.data_out');
    outputs.push(typeof v === 'number' ? (v >>> 0) & 0xff : 0);
  }
  return outputs;
}

function buildVectors(steps: Step[]): SequentialTestVector[] {
  // One vector per cycle: drive inputs before the posedge, sample data_out
  // after. The generator emits a RESULT|... line per `expect` block.
  return steps.map((s, i) => ({
    cycle: i + 1,
    setInputs: { addr: s.addr, data_in: s.data_in, we: s.we },
    expect: { data_out: 0 }, // placeholder — co-sim compares against runSimulator output
  }));
}

const d = describe.skipIf(!hasVerifier());

d('RAM — JS simulator vs iverilog co-simulation', () => {
  it('agrees cycle-for-cycle on a write-then-read sequence', { timeout: 30000 }, async () => {
    const simOutputs = runSimulator(SEQUENCE);

    const { circuit, definitions } = buildRam();
    const { verilog } = exportVerilogFromIR(circuit, definitions);
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
      .map((r) => r.outputs.data_out & 0xff);

    // Ground truth: the JS simulator. iverilog must agree at every cycle.
    expect(veriOutputs).toEqual(simOutputs);
  });
});
