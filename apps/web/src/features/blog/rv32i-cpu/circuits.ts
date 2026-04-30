/**
 * Circuit definitions for the "RISC-V CPU" blog post.
 *
 * Small, focused circuits that illustrate individual pipeline concepts.
 */

import { circuit, bit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Not, And, Or, Mux,
  Register, Constant, Adder, Subtractor, DFlipFlop,
  BusAnd, BusOr, BitSlice,
  Switch, Led, Input, HexDisplay,
} from "@simten/core/std";

// ── Circuit Definitions ──

export const ProgramCounter = circuit('ProgramCounter', {
  inputs: { stall: bit },
  outputs: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { pc, four, adder, stall_inv } }) => [
    pc.q.to(adder.a, outputs.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    inputs.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
  ],
});

export const PCWithMux = circuit('PCWithMux', {
  inputs: { stall: bit, branch_taken: bit, jump: bit, branch_target: bus(32), jump_target: bus(32) },
  outputs: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not, branch_mux: Mux, jump_mux: Mux },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 }, branch_mux: { width: 32 }, jump_mux: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { pc, four, adder, stall_inv, branch_mux, jump_mux } }) => [
    pc.q.to(adder.a, outputs.pc_out),
    four.out.to(adder.b),
    inputs.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
    adder.sum.to(branch_mux.in0),
    inputs.branch_target.to(branch_mux.in1),
    inputs.branch_taken.to(branch_mux.sel),
    branch_mux.out.to(jump_mux.in0),
    inputs.jump_target.to(jump_mux.in1),
    inputs.jump.to(jump_mux.sel),
    jump_mux.out.to(pc.data),
  ],
});

export const PipelineReg = circuit('PipelineReg', {
  inputs: { data_in: bus(8), flush: bit },
  outputs: { data_out: bus(8) },
  nodes: { zero: Constant, mux: Mux, reg: Register, one: Constant },
  nodeArgs: { zero: { value: 0, width: 8 }, mux: { width: 8 }, reg: { width: 8 }, one: { value: 1, width: 1 } },
  connect: ({ inputs, outputs, nodes: { zero, mux, reg, one } }) => [
    inputs.data_in.to(mux.in0),
    zero.out.to(mux.in1),
    inputs.flush.to(mux.sel),
    mux.out.to(reg.data),
    one.out.to(reg.we),
    reg.q.to(outputs.data_out),
  ],
});

export const ForwardingMux = circuit('ForwardingMux', {
  inputs: { reg_val: bus(32), ex_val: bus(32), mem_val: bus(32), sel: bus(2) },
  outputs: { out: bus(32) },
  nodes: { bit0: BitSlice, bit1: BitSlice, mux1: Mux, mux2: Mux },
  nodeArgs: { bit0: { low: 0, high: 0 }, bit1: { low: 1, high: 1 }, mux1: { width: 32 }, mux2: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { bit0, bit1, mux1, mux2 } }) => [
    inputs.sel.to(bit0.in, bit1.in),
    inputs.reg_val.to(mux1.in0),
    inputs.ex_val.to(mux1.in1),
    bit0.out.to(mux1.sel),
    mux1.out.to(mux2.in0),
    inputs.mem_val.to(mux2.in1),
    bit1.out.to(mux2.sel),
    mux2.out.to(outputs.out),
  ],
});

export const SimpleALU = circuit('SimpleALU', {
  inputs: { a: bus(8), b: bus(8), op: bus(2) },
  outputs: { result: bus(8) },
  nodes: { adder: Adder, sub: Subtractor, and_gate: BusAnd, or_gate: BusOr, mux_lo: Mux, mux_hi: Mux, op0: BitSlice, op1: BitSlice, mux_final: Mux },
  nodeArgs: { adder: { width: 8 }, sub: { width: 8 }, and_gate: { width: 8 }, or_gate: { width: 8 }, mux_lo: { width: 8 }, mux_hi: { width: 8 }, op0: { low: 0, high: 0 }, op1: { low: 1, high: 1 }, mux_final: { width: 8 } },
  connect: ({ inputs, outputs, nodes: { adder, sub, and_gate, or_gate, mux_lo, mux_hi, op0, op1, mux_final } }) => [
    inputs.a.to(adder.a, sub.a, and_gate.a, or_gate.a),
    inputs.b.to(adder.b, sub.b, and_gate.b, or_gate.b),
    inputs.op.to(op0.in, op1.in),
    adder.sum.to(mux_lo.in0),
    sub.difference.to(mux_lo.in1),
    op0.out.to(mux_lo.sel, mux_hi.sel),
    and_gate.out.to(mux_hi.in0),
    or_gate.out.to(mux_hi.in1),
    mux_lo.out.to(mux_final.in0),
    mux_hi.out.to(mux_final.in1),
    op1.out.to(mux_final.sel),
    mux_final.out.to(outputs.result),
  ],
});

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  programCounter: {
    name: "Program Counter",
    description:
      "A register that holds the current instruction address, incrementing by 4 each cycle.",
    circuit: ProgramCounter,
  },

  pcWithMux: {
    name: "PC with Next-PC Mux",
    description:
      "The full program counter with a mux selecting between PC+4, branch target, and jump target. Stall freezes the PC.",
    circuit: PCWithMux,
  },

  pipelineRegister: {
    name: "Pipeline Register",
    description:
      "A register between pipeline stages. It latches data on each clock edge so each stage works on a different instruction.",
    circuit: PipelineReg,
  },

  forwardingMux: {
    name: "Forwarding Mux",
    description:
      "When a later instruction needs a result that hasn't been written back yet, the forwarding mux bypasses the register file.",
    circuit: ForwardingMux,
  },

  aluSlice: {
    name: "ALU",
    description:
      "The arithmetic logic unit. It performs addition, subtraction, shifts, and comparisons based on a 4-bit control signal.",
    circuit: SimpleALU,
  },
};
