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

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { RAM } from '../../std/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { verifyVerilog, hasVerifier } from './verify.js';

// Shared input sequence — drives both the JS sim and the iverilog testbench.
interface Step {
  addr: number;
  data_in: number;
  we: number;
}

const SEQUENCE: Step[] = [
  { addr: 5, data_in: 0xAB, we: 1 }, // write 0xAB to [5]
  { addr: 7, data_in: 0xCD, we: 1 }, // write 0xCD to [7]
  { addr: 5, data_in: 0x00, we: 0 }, // read [5]
  { addr: 7, data_in: 0x00, we: 0 }, // read [7]
  { addr: 3, data_in: 0x00, we: 0 }, // read [3] — untouched, should be 0
];

function buildRam() {
  const RamWrapper = circuit('RamWrapper', {
    in: { addr: bus(8), data_in: bus(8), we: bit },
    out: { data_out: bus(8) },
    nodes: { r: RAM },
    connect: ({ in: inp, out, r }) => [
      inp.addr.to(r.addr),
      inp.data_in.to(r.data_in),
      inp.we.to(r.we),
      r.data_out.to(out.data_out),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) =>
      name === 'RamWrapper' ? RamWrapper.circuit :
      name === 'RAM' ? (RAM.circuit as Circuit) :
      undefined,
    getAllPrimitiveNames: () => ['RAM'],
  };

  return { circuit: RamWrapper.circuit, lib };
}

function runSimulator(steps: Step[]): number[] {
  const { circuit, lib } = buildRam();
  const sim = createSimulatorFromCircuit(circuit, lib);
  const outputs: number[] = [];

  for (const step of steps) {
    sim.setNode('addr', step.addr);
    sim.setNode('data_in', step.data_in);
    sim.setNode('we', step.we);
    sim.tick();
    const v = sim.getPortValues().get('__top__.data_out');
    outputs.push(typeof v === 'number' ? (v >>> 0) & 0xFF : 0);
  }
  return outputs;
}

function buildTestbench(steps: Step[]): string {
  const setInputs = steps
    .map((s, i) =>
      `    addr = 8'd${s.addr}; data_in = 8'd${s.data_in}; we = 1'b${s.we};\n` +
      `    @(posedge clk); #1;\n` +
      `    $display("RESULT|test|${i}|cycle|${i + 1}|data_out|%0d", data_out);`,
    )
    .join('\n');

  return `\`timescale 1ns / 1ps
module tb;
  reg clk = 0;
  reg [7:0] addr = 0;
  reg [7:0] data_in = 0;
  reg we = 0;
  wire [7:0] data_out;

  RamWrapper dut (.clk(clk), .addr(addr), .data_in(data_in), .we(we), .data_out(data_out));

  always #5 clk = ~clk;

  initial begin
${setInputs}
    $finish;
  end
endmodule
`;
}

const d = describe.skipIf(!hasVerifier());

d('RAM — JS simulator vs iverilog co-simulation', () => {
  it('agrees cycle-for-cycle on a write-then-read sequence', { timeout: 30000 }, async () => {
    const simOutputs = runSimulator(SEQUENCE);

    const { circuit, lib } = buildRam();
    const verilog = exportVerilog(circuit, lib);
    const testbench = buildTestbench(SEQUENCE);

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
      .map((r) => r.outputs.data_out & 0xFF);

    // Ground truth: the JS simulator. iverilog must agree at every cycle.
    expect(veriOutputs).toEqual(simOutputs);
  });
});
