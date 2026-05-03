/**
 * Circuit definitions for the "Building a CPU" blog post.
 *
 * Reuses basic gates from splash and adds sequential circuits
 * (SR Latch, D Flip-Flop, Register, Counter) for the memory sections.
 */

import { circuit, bit } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Nor, Not, Xor, And, Or, Mux,
  DFlipFlop, Switch, Led, Input, HexDisplay, RAM,
} from "@simten/core/std";
import { FullAdder } from "@/features/splash/circuits";

// Re-export gate circuits from splash
export { CIRCUITS as GATE_CIRCUITS } from "@/features/splash/circuits";

// ── Circuit Definitions ──

export const SRLatch = circuit('SRLatch', {
  inputs: { s: bit, r: bit },
  outputs: { q: bit, q_bar: bit },
  nodes: { nor1: Nor, nor2: Nor },
  connect: ({ inputs, outputs, nodes: { nor1, nor2 } }) => [
    inputs.s.to(nor1.a),
    nor2.out.to(nor1.b, outputs.q_bar),
    inputs.r.to(nor2.a),
    nor1.out.to(nor2.b, outputs.q),
  ],
});

// D Flip-Flop is a primitive — use it directly; auto-harness handles Switch/Led
// For display, we just show the DFlipFlop itself

export const Reg4 = circuit('Reg4', {
  inputs: { d0: bit, d1: bit, d2: bit, d3: bit },
  outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
  connect: ({ inputs, outputs, nodes: { ff0, ff1, ff2, ff3 } }) => [
    inputs.d0.to(ff0.d),
    inputs.d1.to(ff1.d),
    inputs.d2.to(ff2.d),
    inputs.d3.to(ff3.d),
    ff0.q.to(outputs.q0),
    ff1.q.to(outputs.q1),
    ff2.q.to(outputs.q2),
    ff3.q.to(outputs.q3),
  ],
});

export const Counter4 = circuit('Counter4', {
  outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop, inv0: Not, xor1: Xor, and01: And, xor2: Xor, and012: And, xor3: Xor },
  connect: ({ outputs, nodes: { ff0, ff1, ff2, ff3, inv0, xor1, and01, xor2, and012, xor3 } }) => [
    ff0.q.to(inv0.in, xor1.b, and01.a, outputs.q0),
    inv0.out.to(ff0.d),
    ff1.q.to(xor1.a, and01.b, outputs.q1),
    xor1.out.to(ff1.d),
    ff2.q.to(xor2.a, and012.b, outputs.q2),
    and01.out.to(xor2.b, and012.a),
    xor2.out.to(ff2.d),
    ff3.q.to(xor3.a, outputs.q3),
    and012.out.to(xor3.b),
    xor3.out.to(ff3.d),
  ],
});

export const Adder4 = circuit('Adder4', {
  inputs: { a0: bit, a1: bit, a2: bit, a3: bit, b0: bit, b1: bit, b2: bit, b3: bit },
  outputs: { s0: bit, s1: bit, s2: bit, s3: bit, cout: bit },
  nodes: { fa0: FullAdder, fa1: FullAdder, fa2: FullAdder, fa3: FullAdder },
  connect: ({ inputs, outputs, nodes: { fa0, fa1, fa2, fa3 } }) => [
    inputs.a0.to(fa0.a),
    inputs.b0.to(fa0.b),
    inputs.a1.to(fa1.a),
    inputs.b1.to(fa1.b),
    inputs.a2.to(fa2.a),
    inputs.b2.to(fa2.b),
    inputs.a3.to(fa3.a),
    inputs.b3.to(fa3.b),
    fa0.cout.to(fa1.cin),
    fa1.cout.to(fa2.cin),
    fa2.cout.to(fa3.cin),
    fa0.sum.to(outputs.s0),
    fa1.sum.to(outputs.s1),
    fa2.sum.to(outputs.s2),
    fa3.sum.to(outputs.s3),
    fa3.cout.to(outputs.cout),
  ],
});

export const ALU1 = circuit('ALU1', {
  inputs: { a: bit, b: bit, cin: bit, op0: bit, op1: bit },
  outputs: { result: bit, cout: bit },
  nodes: { add: FullAdder, op_and: And, op_or: Or, op_xor: Xor, mux_lo: Mux, mux_hi: Mux, mux_out: Mux },
  connect: ({ inputs, outputs, nodes: { add, op_and, op_or, op_xor, mux_lo, mux_hi, mux_out } }) => [
    inputs.a.to(add.a, op_and.a, op_or.a, op_xor.a),
    inputs.b.to(add.b, op_and.b, op_or.b, op_xor.b),
    inputs.cin.to(add.cin),
    add.cout.to(outputs.cout),
    add.sum.to(mux_lo.in0),
    op_and.out.to(mux_lo.in1),
    inputs.op0.to(mux_lo.sel, mux_hi.sel),
    op_or.out.to(mux_hi.in0),
    op_xor.out.to(mux_hi.in1),
    mux_lo.out.to(mux_out.in0),
    mux_hi.out.to(mux_out.in1),
    inputs.op1.to(mux_out.sel),
    mux_out.out.to(outputs.result),
  ],
});

// RAM demo is self-contained (no ports) — auto-harness skips it
export const DemoRAM = circuit('DemoRAM', {
  nodes: { addr: Input, data_in: Input, we: Switch, mem: RAM, data_out: HexDisplay },
  nodeArgs: { addr: { width: 8 }, data_in: { width: 8 }, we: { value: 0 }, mem: { width: 8 }, data_out: { width: 8 } },
  connect: ({ nodes: { addr, data_in, we, mem, data_out } }) => [
    addr.out.to(mem.addr),
    data_in.out.to(mem.data_in),
    we.out.to(mem.we),
    mem.data_out.to(data_out.in),
  ],
});

// D flip-flop demo is self-contained
export const DemoFlipFlop = circuit('DemoFlipFlop', {
  nodes: { sw_d: Switch, dff: DFlipFlop, led_q: Led },
  connect: ({ nodes: { sw_d, dff, led_q } }) => [
    sw_d.out.to(dff.d),
    dff.q.to(led_q.in),
  ],
});

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  srLatch: {
    name: "SR Latch",
    description:
      "The simplest memory element. Set (S) stores a 1, Reset (R) clears to 0.",
    circuit: SRLatch,
  },

  dFlipFlop: {
    name: "D Flip-Flop",
    description:
      "Captures the input value on each clock edge. The building block of registers.",
    circuit: DemoFlipFlop,
  },

  register4bit: {
    name: "4-Bit Register",
    description:
      "Four flip-flops in parallel store a nibble (4 bits) of data.",
    circuit: Reg4,
  },

  counter4bit: {
    name: "4-Bit Counter",
    description:
      "Counts from 0 to 15 using a synchronous binary counter.",
    circuit: Counter4,
  },

  adder4bit: {
    name: "4-Bit Adder",
    description:
      "Chains four full adders to add two 4-bit numbers with carry propagation.",
    circuit: Adder4,
  },

  alu1bit: {
    name: "1-Bit ALU Slice",
    description:
      "Performs ADD, AND, OR, or XOR on one bit, selected by a 2-bit control signal.",
    circuit: ALU1,
  },

  ram: {
    name: "RAM",
    description:
      "256x8 memory. Reads are instant (combinational). Writes happen on the clock edge when write-enable is on.",
    circuit: DemoRAM,
  },
};
