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

import type { Circuit, PortDescriptor, PortType } from '../types/circuit.js';
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

    const formatStr = 'RESULT|' + displayParts.map((p, i) =>
      i % 2 === 0 ? p : '%0d'
    ).join('|');

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
