/**
 * Verilog testbench generator.
 *
 * Generates an Icarus Verilog testbench from circuit test vectors.
 * Uses the strict RESULT protocol for output parsing:
 *   RESULT|test|<id>|cycle|<n>|<port>|<val>|<port>|<val>|...
 *
 * Timing constants are explicit and named:
 *   `define SETTLE_TIME 10     — combinational settling delay
 *   `define CLK_HALF_PERIOD 5  — clock half-period
 *   `define SAMPLE_DELAY 1     — delay after posedge before sampling
 */

import type { Circuit, PortType } from '../types/circuit.js';
import type { VerilogTestbenchOptions, TestVector } from './types.js';

function sanitizeId(id: string): string {
  return id.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function portWidth(pt: PortType): number {
  return pt.kind === 'bus' ? pt.width : 1;
}

function portWidthDecl(pt: PortType): string {
  if (pt.kind === 'bit') return '';
  return `[${pt.width - 1}:0] `;
}

function formatValue(value: number | boolean, width: number): string {
  if (typeof value === 'boolean') {
    return value ? "1'b1" : "1'b0";
  }
  if (width <= 1) {
    return value ? "1'b1" : "1'b0";
  }
  return `${width}'d${value}`;
}

const DEFAULT_OPTIONS: Required<VerilogTestbenchOptions> = {
  clockHalfPeriod: 5,
  settleTime: 10,
  sampleDelay: 1,
  timeoutCycles: 1000,
};

/**
 * Generate a Verilog testbench for combinational circuits.
 * Each test vector sets inputs, waits for settling, and samples outputs.
 */
export function generateTestbench(
  circuit: Circuit,
  testVectors: TestVector[],
  options?: VerilogTestbenchOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const moduleName = sanitizeId(circuit.name);
  const hasClocks = circuit.clocks && circuit.clocks.length > 0;

  const lines: string[] = [];

  lines.push('`timescale 1ns / 1ps');
  lines.push(`\`define SETTLE_TIME ${opts.settleTime}`);
  lines.push(`\`define CLK_HALF_PERIOD ${opts.clockHalfPeriod}`);
  lines.push(`\`define SAMPLE_DELAY ${opts.sampleDelay}`);
  lines.push('');
  lines.push('module tb;');

  // Clock
  if (hasClocks) {
    lines.push('  reg clk;');
  }

  // Input registers
  for (const input of circuit.inputs) {
    const w = portWidthDecl(input.portType);
    lines.push(`  reg ${w}${input.name};`);
  }

  // Output wires
  for (const output of circuit.outputs) {
    const w = portWidthDecl(output.portType);
    lines.push(`  wire ${w}${output.name};`);
  }

  lines.push('');

  // DUT instantiation
  const ports: string[] = [];
  if (hasClocks) {
    ports.push('.clk(clk)');
  }
  for (const input of circuit.inputs) {
    ports.push(`.${input.name}(${input.name})`);
  }
  for (const output of circuit.outputs) {
    ports.push(`.${output.name}(${output.name})`);
  }

  lines.push(`  ${moduleName} dut (`);
  lines.push(`    ${ports.join(',\n    ')}`);
  lines.push('  );');
  lines.push('');

  // Clock generation
  if (hasClocks) {
    lines.push('  always #`CLK_HALF_PERIOD clk = ~clk;');
    lines.push('');
  }

  // Test sequence
  lines.push('  integer test_id;');
  if (hasClocks) {
    lines.push('  integer cycle_num;');
  }
  lines.push('  initial begin');

  if (hasClocks) {
    lines.push('    clk = 0;');
    lines.push('    cycle_num = 0;');
  }

  // Initialize all inputs to 0
  for (const input of circuit.inputs) {
    const w = portWidth(input.portType);
    lines.push(`    ${input.name} = ${formatValue(0, w)};`);
  }
  lines.push('');

  for (const tv of testVectors) {
    lines.push(`    // Test ${tv.id}${tv.description ? ': ' + tv.description : ''}`);
    lines.push(`    test_id = ${tv.id};`);

    // Set inputs
    for (const [name, value] of Object.entries(tv.inputs)) {
      const inputDef = circuit.inputs.find(i => i.name === name);
      const w = inputDef ? portWidth(inputDef.portType) : 1;
      lines.push(`    ${name} = ${formatValue(value, w)};`);
    }

    if (tv.ticks && tv.ticks > 0 && hasClocks) {
      // Sequential: tick N times then sample
      lines.push(`    repeat(${tv.ticks}) begin`);
      lines.push('      @(posedge clk);');
      lines.push('      cycle_num = cycle_num + 1;');
      lines.push('    end');
      lines.push('    #`SAMPLE_DELAY;');
    } else {
      // Combinational: just wait for settling
      lines.push('    #`SETTLE_TIME;');
    }

    // Display results — all outputs in one line
    const displayParts: string[] = [];
    const displayArgs: string[] = [];
    displayParts.push('test');
    displayArgs.push('test_id');
    displayParts.push('cycle');
    displayArgs.push(hasClocks ? 'cycle_num' : '0');

    for (const output of circuit.outputs) {
      displayParts.push(output.name);
      displayArgs.push(output.name);
    }

    // Build proper format: RESULT|test|%0d|cycle|%0d|port1|%0d|port2|%0d
    const fmtParts = ['RESULT'];
    const fmtArgs: string[] = [];
    fmtParts.push('test');
    fmtParts.push('%0d');
    fmtArgs.push('test_id');
    fmtParts.push('cycle');
    fmtParts.push('%0d');
    fmtArgs.push(hasClocks ? 'cycle_num' : '0');
    for (const output of circuit.outputs) {
      fmtParts.push(output.name);
      fmtParts.push('%0d');
      fmtArgs.push(output.name);
    }

    lines.push(`    $display("${fmtParts.join('|')}", ${fmtArgs.join(', ')});`);
    lines.push('');
  }

  lines.push('    $finish;');
  lines.push('  end');
  lines.push('endmodule');
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────
// Sequential testbench generator
// ────────────────────────────────────────────────────────────────────────

/**
 * Single cycle in a sequential test. Inputs apply *before* the posedge;
 * outputs sample *after* the posedge + `sampleDelay`. This models how
 * real hardware is typically observed: drive inputs during the low
 * half-cycle, let them propagate, clock, then sample.
 *
 * Omit `setInputs` to leave inputs at their previous value (useful
 * during "wait for the circuit to settle" periods — see `holdInputs`).
 * Omit `expect` to not emit a RESULT line for this cycle.
 */
export interface SequentialTestVector {
  /** 1-indexed cycle number. Vectors must be in ascending cycle order. */
  cycle: number;
  /** Input values to apply before the posedge of this cycle. */
  setInputs?: Record<string, number | boolean>;
  /** Outputs to sample after posedge + sampleDelay; emit as RESULT line. */
  expect?: Record<string, number | boolean>;
}

/**
 * Generate a Verilog testbench for sequential circuits from a list of
 * per-cycle vectors. Drives the clock, applies `setInputs` before each
 * posedge, samples `expect` after posedge + `sampleDelay`, and emits a
 * `RESULT|test|<cycle>|cycle|<cycle>|<port>|<val>|...` line per expect.
 *
 * Use this instead of hand-writing Verilog testbench strings — the
 * timing convention stays consistent across tests and matches what the
 * verifier's `parseResults` expects.
 *
 * Holding inputs for multiple cycles without sampling is implicit: just
 * jump cycle numbers. Gap between vectors is filled with
 * `repeat (N) @(posedge clk)`, preserving whatever inputs were last
 * driven. Example: `[{cycle: 1, setInputs: {go: 1}}, {cycle: 50,
 * expect: {done: 1}}]` drives `go=1` at cycle 1, holds through cycle 49,
 * samples `done` at cycle 50.
 */
export function generateSequentialTestbench(
  circuit: Circuit,
  vectors: SequentialTestVector[],
  options?: VerilogTestbenchOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const moduleName = sanitizeId(circuit.name);

  // Vectors must be in strict ascending cycle order so we can drive the
  // clock linearly and apply setInputs at the right moment.
  const ordered = [...vectors].sort((a, b) => a.cycle - b.cycle);

  const inputWidth = new Map<string, number>();
  for (const p of circuit.inputs) inputWidth.set(p.name, portWidth(p.portType));

  const lines: string[] = [];
  lines.push('`timescale 1ns / 1ps');
  lines.push(`\`define CLK_HALF_PERIOD ${opts.clockHalfPeriod}`);
  lines.push(`\`define SAMPLE_DELAY ${opts.sampleDelay}`);
  lines.push('');
  lines.push('module tb;');
  lines.push('  reg clk;');

  for (const input of circuit.inputs) {
    const w = portWidthDecl(input.portType);
    lines.push(`  reg ${w}${input.name};`);
  }
  for (const output of circuit.outputs) {
    const w = portWidthDecl(output.portType);
    lines.push(`  wire ${w}${output.name};`);
  }
  lines.push('');

  // DUT
  const ports: string[] = ['.clk(clk)'];
  for (const input of circuit.inputs) ports.push(`.${input.name}(${input.name})`);
  for (const output of circuit.outputs) ports.push(`.${output.name}(${output.name})`);
  lines.push(`  ${moduleName} dut (`);
  lines.push(`    ${ports.join(',\n    ')}`);
  lines.push('  );');
  lines.push('');

  lines.push('  always #`CLK_HALF_PERIOD clk = ~clk;');
  lines.push('');
  lines.push('  initial begin');
  lines.push('    clk = 0;');

  // Initialize all inputs to 0
  for (const input of circuit.inputs) {
    lines.push(`    ${input.name} = ${formatValue(0, portWidth(input.portType))};`);
  }
  lines.push('');

  // Walk vectors in order, advancing the clock between each.
  let prevCycle = 0;
  for (const v of ordered) {
    // Advance cycles from prev to v.cycle - 1 with no I/O changes.
    const gap = v.cycle - prevCycle - 1;
    if (gap > 0) {
      lines.push(`    repeat (${gap}) @(posedge clk);`);
    }

    if (v.setInputs) {
      for (const [name, value] of Object.entries(v.setInputs)) {
        const w = inputWidth.get(name) ?? 1;
        lines.push(`    ${name} = ${formatValue(value, w)};`);
      }
    }

    // Advance one posedge to land on this cycle.
    lines.push('    @(posedge clk);');
    lines.push('    #`SAMPLE_DELAY;');

    if (v.expect && Object.keys(v.expect).length > 0) {
      const fmtParts = ['RESULT', 'test', `${v.cycle}`, 'cycle', `${v.cycle}`];
      const fmtArgs: string[] = [];
      for (const portName of Object.keys(v.expect)) {
        fmtParts.push(portName);
        fmtParts.push('%0d');
        fmtArgs.push(portName);
      }
      lines.push(`    $display("${fmtParts.join('|')}", ${fmtArgs.join(', ')});`);
    }

    prevCycle = v.cycle;
  }

  lines.push('');
  lines.push('    $finish;');
  lines.push('  end');
  lines.push('endmodule');
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────
// Vector helpers (compose into generateSequentialTestbench input)
// ────────────────────────────────────────────────────────────────────────

/**
 * Sweep an address input across 0..count-1, sampling a value port at
 * each setting. Used for debug-scan readouts: RV32I regfile read via
 * debug_addr → debug_value, ROM content dump, framebuffer readback,
 * cache contents, or any indexed-readout pattern.
 *
 * Produces `count` vectors starting at `startCycle`, one per address.
 * Each vector sets `addrNode` to the current index and includes an
 * `expect` keyed by `valueNode` so the generator emits a RESULT line.
 * The `expect` value itself is a placeholder — the test compares the
 * parsed RESULT against whatever the JS simulator produced for the
 * same sequence (co-sim pattern), not against these placeholder values.
 */
export function sweepPort(
  addrNode: string,
  valueNode: string,
  count: number,
  startCycle: number,
): SequentialTestVector[] {
  const vectors: SequentialTestVector[] = [];
  for (let i = 0; i < count; i++) {
    vectors.push({
      cycle: startCycle + i,
      setInputs: { [addrNode]: i },
      expect: { [valueNode]: 0 },
    });
  }
  return vectors;
}

/**
 * Generate exhaustive test vectors for small combinational circuits.
 * Tests all input combinations if total input bits <= maxBits.
 */
export function generateExhaustiveVectors(
  circuit: Circuit,
  maxBits: number = 16,
): TestVector[] | null {
  const totalBits = circuit.inputs.reduce((sum, p) => sum + portWidth(p.portType), 0);
  if (totalBits > maxBits) return null;

  const totalCombinations = 1 << totalBits;
  const vectors: TestVector[] = [];

  for (let combo = 0; combo < totalCombinations; combo++) {
    const inputs: Record<string, number | boolean> = {};
    let bitOffset = 0;

    for (const input of circuit.inputs) {
      const w = portWidth(input.portType);
      const mask = (1 << w) - 1;
      const value = (combo >> bitOffset) & mask;
      inputs[input.name] = w === 1 ? Boolean(value) : value;
      bitOffset += w;
    }

    vectors.push({
      id: combo,
      inputs,
      expected: {}, // Filled by running circuit simulator
      description: `combo ${combo}/${totalCombinations}`,
    });
  }

  return vectors;
}
