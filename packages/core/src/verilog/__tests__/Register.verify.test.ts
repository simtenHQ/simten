/**
 * Register co-simulation verification.
 *
 * Drives an identical input sequence through the JS simulator and the
 * exporter-generated Verilog under iverilog; asserts cycle-by-cycle
 * agreement. Covers the write-enable latching behavior: `q` updates on
 * posedge only when `we` is high; otherwise holds the previous value.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { Register } from '../../std/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { verifyVerilog, hasVerifier } from './verify.js';

interface Step {
  data: number;
  we: number;
}

// Each cycle, we drive (data, we) and sample q after the clock edge.
// Register q updates only when we=1.
const SEQUENCE: Step[] = [
  { data: 0xAA, we: 1 }, // write 0xAA → q = 0xAA after this cycle
  { data: 0xBB, we: 0 }, // we=0 → q holds at 0xAA
  { data: 0xCC, we: 1 }, // write 0xCC → q = 0xCC
  { data: 0x00, we: 0 }, // hold 0xCC
  { data: 0xFF, we: 1 }, // write 0xFF
];

function buildRegister() {
  const RegWrapper = circuit('RegWrapper', {
    inputs: { data: bus(8), we: bit },
    outputs: { q: bus(8) },
    nodes: { r: Register },
    connect: ({ inputs, outputs, nodes: { r } }) => [
      inputs.data.to(r.data),
      inputs.we.to(r.we),
      r.q.to(outputs.q),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) =>
      name === 'RegWrapper' ? RegWrapper.circuit :
      name === 'Register' ? (Register.circuit as Circuit) :
      undefined,
    getAllPrimitiveNames: () => ['Register'],
  };

  return { circuit: RegWrapper.circuit, lib };
}

function runSimulator(steps: Step[]): number[] {
  const { circuit, lib } = buildRegister();
  const sim = createSimulatorFromCircuit(circuit, lib);
  const outputs: number[] = [];

  for (const step of steps) {
    sim.setNode('data', step.data);
    sim.setNode('we', step.we);
    sim.tick();
    const v = sim.getPortValues().get('__top__.q');
    outputs.push(typeof v === 'number' ? (v >>> 0) & 0xFF : 0);
  }
  return outputs;
}

function buildVectors(steps: Step[]): SequentialTestVector[] {
  return steps.map((s, i) => ({
    cycle: i + 1,
    setInputs: { data: s.data, we: s.we },
    expect: { q: 0 },
  }));
}

const d = describe.skipIf(!hasVerifier());

d('Register — JS simulator vs iverilog co-simulation', () => {
  it('holds value when we=0, updates on posedge when we=1', { timeout: 30000 }, async () => {
    const simOutputs = runSimulator(SEQUENCE);

    const { circuit, lib } = buildRegister();
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

    const veriOutputs = result.results!
      .sort((a, b) => a.testCase - b.testCase)
      .map((r) => r.outputs.q & 0xFF);

    expect(veriOutputs).toEqual(simOutputs);
  });
});
