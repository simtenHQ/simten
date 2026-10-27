/**
 * Sequential circuit synthesis tests.
 *
 * Exercises synthesis of circuits with state:
 *   - ShiftRegister (chain of DFlipFlops) — sequential chain, DFF cells
 *   - UpDownCounter (Register + Adder + Subtractor + Mux) — control logic
 *   - FIFO-style pipeline (multiple registers) — multi-stage sequential
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { Adder, Constant, DFlipFlop, Mux, Or, Register, Subtractor } from '../../std/index.js';
import { exportVerilogFromIR } from '../exporter.js';
import { hasSynth, synthesizeVerilog } from './synth.js';

// ---- helpers ----------------------------------------------------------------

// ---- circuits ---------------------------------------------------------------

function buildShiftRegister4() {
  // 4-bit serial-in parallel-out shift register
  // Each DFlipFlop feeds the next: d0 → ff0.q → ff1.d → ff1.q → ... → out3
  const SR4 = circuit('ShiftRegister4', {
    inputs: { d: bit },
    outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
    nodes: { ff0: DFlipFlop(), ff1: DFlipFlop(), ff2: DFlipFlop(), ff3: DFlipFlop() },
    connect: ({ inputs, outputs, nodes: { ff0, ff1, ff2, ff3 } }) => [
      inputs.d.to(ff0.d),
      ff0.q.to(ff1.d, outputs.q0),
      ff1.q.to(ff2.d, outputs.q1),
      ff2.q.to(ff3.d, outputs.q2),
      ff3.q.to(outputs.q3),
    ],
  });
  return { circuit: internalsOf(SR4).ir, definitions: libraryOf(SR4).definitions };
}

function buildUpDownCounter() {
  // 8-bit up/down counter:
  //   dir=0: count up (add 1)
  //   dir=1: count down (subtract 1)
  //   enable=1: count, enable=0: hold
  const UDCounter = circuit('UpDownCounter', {
    inputs: { enable: bit, dir: bit },
    outputs: { count: bus(8) },
    nodes: {
      reg: Register(),
      add: Adder(),
      sub: Subtractor(),
      one: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
      muxResult: Mux(),
      weOr: Or,
    },
    connect: ({ inputs, outputs, nodes: { reg, add, sub, one, zero, muxResult, weOr } }) => [
      // Feed current count to both adder and subtractor
      reg.q.to(add.a, sub.a, outputs.count),
      one.out.to(add.b, sub.b),
      zero.out.to(add.carry_in, sub.borrow_in),
      // Select add or subtract based on dir
      add.sum.to(muxResult.in0),
      sub.difference.to(muxResult.in1),
      inputs.dir.to(muxResult.sel),
      // Write enable: count when enabled
      inputs.enable.to(weOr.a, reg.we),
      zero.out.to(weOr.b),
      muxResult.out.to(reg.data),
    ],
  });
  return { circuit: internalsOf(UDCounter).ir, definitions: libraryOf(UDCounter).definitions };
}

function buildPipelineStage() {
  // 2-stage pipeline: two registers in series with combinational logic between
  // Stage 1: register input
  // Stage 2: add 1, register result
  const Pipeline = circuit('Pipeline2Stage', {
    inputs: { data: bus(8), we: bit },
    outputs: { result: bus(8) },
    nodes: {
      reg1: Register(),
      reg2: Register(),
      add: Adder(),
      one: Constant({ value: 1 }),
      zero: Constant({ value: 0 }),
    },
    connect: ({ inputs, outputs, nodes: { reg1, reg2, add, one, zero } }) => [
      inputs.data.to(reg1.data),
      inputs.we.to(reg1.we, reg2.we),
      reg1.q.to(add.a),
      one.out.to(add.b),
      zero.out.to(add.carry_in),
      add.sum.to(reg2.data),
      reg2.q.to(outputs.result),
    ],
  });
  return { circuit: internalsOf(Pipeline).ir, definitions: libraryOf(Pipeline).definitions };
}

// ---- tests ------------------------------------------------------------------

const d = describe.skipIf(!hasSynth());

d('ShiftRegister4 (4x DFlipFlop chain) — synthesis', () => {
  it('synthesizes serial shift register and produces DFF cells', { timeout: 30000 }, async () => {
    const { circuit, definitions } = buildShiftRegister4();
    const result = exportVerilogFromIR(circuit, definitions, { target: 'synthesis' });
    const resp = await synthesizeVerilog(result, 'ShiftRegister4');

    if (!resp.success) console.error('synth:', JSON.stringify(resp, null, 2));

    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);

    // 4 flip-flops in the chain — must have at least 4 DFF cells
    const dffCount = Object.entries(resp.stats!.cellBreakdown)
      .filter(([name]) => name.includes('DFF'))
      .reduce((sum, [, n]) => sum + n, 0);

    expect(dffCount).toBeGreaterThanOrEqual(4);
    expect(resp.netlist).toBeTruthy();
  });
});

d('UpDownCounter (Register + Adder + Subtractor + Mux) — synthesis', () => {
  it('synthesizes up/down counter with direction control', { timeout: 30000 }, async () => {
    const { circuit, definitions } = buildUpDownCounter();
    const result = exportVerilogFromIR(circuit, definitions, { target: 'synthesis' });
    const resp = await synthesizeVerilog(result, 'UpDownCounter');

    if (!resp.success) console.error('synth:', JSON.stringify(resp, null, 2));

    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);

    // Has sequential state (the register)
    const dffCount = Object.entries(resp.stats!.cellBreakdown)
      .filter(([name]) => name.includes('DFF'))
      .reduce((sum, [, n]) => sum + n, 0);

    expect(dffCount).toBeGreaterThan(0);
    expect(resp.netlist).toBeTruthy();
  });
});

d('Pipeline2Stage (2x Register + Adder) — synthesis', () => {
  it('synthesizes 2-stage pipeline with combinational logic between stages', {
    timeout: 30000,
  }, async () => {
    const { circuit, definitions } = buildPipelineStage();
    const result = exportVerilogFromIR(circuit, definitions, { target: 'synthesis' });
    const resp = await synthesizeVerilog(result, 'Pipeline2Stage');

    if (!resp.success) console.error('synth:', JSON.stringify(resp, null, 2));

    expect(resp.success).toBe(true);
    expect(resp.stats!.cells).toBeGreaterThan(0);

    // Two registers = at least 16 DFF cells (2 × 8-bit registers)
    const dffCount = Object.entries(resp.stats!.cellBreakdown)
      .filter(([name]) => name.includes('DFF'))
      .reduce((sum, [, n]) => sum + n, 0);

    expect(dffCount).toBeGreaterThanOrEqual(16);
    expect(resp.netlist).toBeTruthy();
  });
});
