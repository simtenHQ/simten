/**
 * Circuit definitions for the "Building a CPU" blog post.
 *
 * Reuses basic gates from splash and adds sequential circuits
 * (SR Latch, D Flip-Flop, Register, Counter) for the memory sections.
 */

import { circuit, bit, bus } from "@turing-incomplete/core/circuit";
import type { BuiltCircuit } from "@turing-incomplete/core/circuit";
import {
  Nor, Not, Xor, And, Or, Mux,
  DFlipFlop, Switch, Led, Input, HexDisplay, RAM,
} from "@turing-incomplete/core/std";
import { HalfAdder, FullAdder } from "@/features/splash/circuits";

// Re-export gate circuits from splash
export { CIRCUITS as GATE_CIRCUITS } from "@/features/splash/circuits";

export interface BlogCircuit {
  name: string;
  description: string;
  displayCode: string;
  circuit: BuiltCircuit;
}

// ── Circuit Definitions ──

export const SRLatch = circuit('SRLatch', {
  in: { s: bit, r: bit },
  out: { q: bit, q_bar: bit },
  nodes: { nor1: Nor, nor2: Nor },
  connect: ({ in: inp, out, nor1, nor2 }) => [
    inp.s.to(nor1.a),
    nor2.out.to(nor1.b, out.q_bar),
    inp.r.to(nor2.a),
    nor1.out.to(nor2.b, out.q),
  ],
});

// D Flip-Flop is a primitive — use it directly; auto-harness handles Switch/Led
// For display, we just show the DFlipFlop itself

export const Reg4 = circuit('Reg4', {
  in: { d0: bit, d1: bit, d2: bit, d3: bit },
  out: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
  connect: ({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
    inp.d0.to(ff0.d),
    inp.d1.to(ff1.d),
    inp.d2.to(ff2.d),
    inp.d3.to(ff3.d),
    ff0.q.to(out.q0),
    ff1.q.to(out.q1),
    ff2.q.to(out.q2),
    ff3.q.to(out.q3),
  ],
});

export const Counter4 = circuit('Counter4', {
  out: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop, inv0: Not, xor1: Xor, and01: And, xor2: Xor, and012: And, xor3: Xor },
  connect: ({ in: inp, out, ff0, ff1, ff2, ff3, inv0, xor1, and01, xor2, and012, xor3 }) => [
    ff0.q.to(inv0.in, xor1.b, and01.a, out.q0),
    inv0.out.to(ff0.d),
    ff1.q.to(xor1.a, and01.b, out.q1),
    xor1.out.to(ff1.d),
    ff2.q.to(xor2.a, and012.b, out.q2),
    and01.out.to(xor2.b, and012.a),
    xor2.out.to(ff2.d),
    ff3.q.to(xor3.a, out.q3),
    and012.out.to(xor3.b),
    xor3.out.to(ff3.d),
  ],
});

export const Adder4 = circuit('Adder4', {
  in: { a0: bit, a1: bit, a2: bit, a3: bit, b0: bit, b1: bit, b2: bit, b3: bit },
  out: { s0: bit, s1: bit, s2: bit, s3: bit, cout: bit },
  nodes: { fa0: FullAdder, fa1: FullAdder, fa2: FullAdder, fa3: FullAdder },
  connect: ({ in: inp, out, fa0, fa1, fa2, fa3 }) => [
    inp.a0.to(fa0.a),
    inp.b0.to(fa0.b),
    inp.a1.to(fa1.a),
    inp.b1.to(fa1.b),
    inp.a2.to(fa2.a),
    inp.b2.to(fa2.b),
    inp.a3.to(fa3.a),
    inp.b3.to(fa3.b),
    fa0.cout.to(fa1.cin),
    fa1.cout.to(fa2.cin),
    fa2.cout.to(fa3.cin),
    fa0.sum.to(out.s0),
    fa1.sum.to(out.s1),
    fa2.sum.to(out.s2),
    fa3.sum.to(out.s3),
    fa3.cout.to(out.cout),
  ],
});

export const ALU1 = circuit('ALU1', {
  in: { a: bit, b: bit, cin: bit, op0: bit, op1: bit },
  out: { result: bit, cout: bit },
  nodes: { add: FullAdder, op_and: And, op_or: Or, op_xor: Xor, mux_lo: Mux, mux_hi: Mux, mux_out: Mux },
  connect: ({ in: inp, out, add, op_and, op_or, op_xor, mux_lo, mux_hi, mux_out }) => [
    inp.a.to(add.a, op_and.a, op_or.a, op_xor.a),
    inp.b.to(add.b, op_and.b, op_or.b, op_xor.b),
    inp.cin.to(add.cin),
    add.cout.to(out.cout),
    add.sum.to(mux_lo.a),
    op_and.out.to(mux_lo.b),
    inp.op0.to(mux_lo.sel, mux_hi.sel),
    op_or.out.to(mux_hi.a),
    op_xor.out.to(mux_hi.b),
    mux_lo.out.to(mux_out.a),
    mux_hi.out.to(mux_out.b),
    inp.op1.to(mux_out.sel),
    mux_out.out.to(out.result),
  ],
});

// RAM demo is self-contained (no ports) — auto-harness skips it
export const DemoRAM = circuit('DemoRAM', {
  nodes: { addr: Input, data_in: Input, we: Switch, mem: RAM, data_out: HexDisplay },
  nodeArgs: { addr: { width: 8 }, data_in: { width: 8 }, we: { value: 0 }, mem: { width: 8 }, data_out: { width: 8 } },
  connect: ({ addr, data_in, we, mem, data_out }) => [
    addr.out.to(mem.addr),
    data_in.out.to(mem.data_in),
    we.out.to(mem.we),
    mem.data_out.to(data_out.in),
  ],
});

// D flip-flop demo is self-contained
export const DemoFlipFlop = circuit('DemoFlipFlop', {
  nodes: { sw_d: Switch, dff: DFlipFlop, led_q: Led },
  connect: ({ sw_d, dff, led_q }) => [
    sw_d.out.to(dff.d),
    dff.q.to(led_q.in),
  ],
});

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  srLatch: {
    name: "SR Latch",
    description:
      "The simplest memory element. Set (S) stores a 1, Reset (R) clears to 0.",
    displayCode: `
const SRLatch = circuit('SRLatch', {
  in: { s: bit, r: bit },
  out: { q: bit, q_bar: bit },
  nodes: { nor1: Nor, nor2: Nor },
  connect: ({ in: inp, out, nor1, nor2 }) => [
    inp.s.to(nor1.a),
    nor2.out.to(nor1.b, out.q_bar),
    inp.r.to(nor2.a),
    nor1.out.to(nor2.b, out.q),
  ],
})
`,
    circuit: SRLatch,
  },

  dFlipFlop: {
    name: "D Flip-Flop",
    description:
      "Captures the input value on each clock edge. The building block of registers.",
    displayCode: `
const DemoFlipFlop = circuit('DemoFlipFlop', {
  nodes: { sw_d: Switch, dff: DFlipFlop, led_q: Led },
  connect: ({ sw_d, dff, led_q }) => [
    sw_d.out.to(dff.d),
    dff.q.to(led_q.in),
  ],
})
`,
    circuit: DemoFlipFlop,
  },

  register4bit: {
    name: "4-Bit Register",
    description:
      "Four flip-flops in parallel store a nibble (4 bits) of data.",
    displayCode: `
const Reg4 = circuit('Reg4', {
  in: { d0: bit, d1: bit, d2: bit, d3: bit },
  out: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
  connect: ({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
    inp.d0.to(ff0.d),
    inp.d1.to(ff1.d),
    inp.d2.to(ff2.d),
    inp.d3.to(ff3.d),
    ff0.q.to(out.q0),
    ff1.q.to(out.q1),
    ff2.q.to(out.q2),
    ff3.q.to(out.q3),
  ],
})
`,
    circuit: Reg4,
  },

  counter4bit: {
    name: "4-Bit Counter",
    description:
      "Counts from 0 to 15 using a synchronous binary counter.",
    displayCode: `
const Counter4 = circuit('Counter4', {
  out: { q0: bit, q1: bit, q2: bit, q3: bit },
  nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop, inv0: Not, xor1: Xor, and01: And, xor2: Xor, and012: And, xor3: Xor },
  connect: ({ in: inp, out, ff0, ff1, ff2, ff3, inv0, xor1, and01, xor2, and012, xor3 }) => [
    ff0.q.to(inv0.in, xor1.b, and01.a, out.q0),
    inv0.out.to(ff0.d),
    ff1.q.to(xor1.a, and01.b, out.q1),
    xor1.out.to(ff1.d),
    ff2.q.to(xor2.a, and012.b, out.q2),
    and01.out.to(xor2.b, and012.a),
    xor2.out.to(ff2.d),
    ff3.q.to(xor3.a, out.q3),
    and012.out.to(xor3.b),
    xor3.out.to(ff3.d),
  ],
})
`,
    circuit: Counter4,
  },

  adder4bit: {
    name: "4-Bit Adder",
    description:
      "Chains four full adders to add two 4-bit numbers with carry propagation.",
    displayCode: `
const Adder4 = circuit('Adder4', {
  in: { a0: bit, a1: bit, a2: bit, a3: bit, b0: bit, b1: bit, b2: bit, b3: bit },
  out: { s0: bit, s1: bit, s2: bit, s3: bit, cout: bit },
  nodes: { fa0: FullAdder, fa1: FullAdder, fa2: FullAdder, fa3: FullAdder },
  connect: ({ in: inp, out, fa0, fa1, fa2, fa3 }) => [
    inp.a0.to(fa0.a),
    inp.b0.to(fa0.b),
    inp.a1.to(fa1.a),
    inp.b1.to(fa1.b),
    inp.a2.to(fa2.a),
    inp.b2.to(fa2.b),
    inp.a3.to(fa3.a),
    inp.b3.to(fa3.b),
    fa0.cout.to(fa1.cin),
    fa1.cout.to(fa2.cin),
    fa2.cout.to(fa3.cin),
    fa0.sum.to(out.s0),
    fa1.sum.to(out.s1),
    fa2.sum.to(out.s2),
    fa3.sum.to(out.s3),
    fa3.cout.to(out.cout),
  ],
})
`,
    circuit: Adder4,
  },

  alu1bit: {
    name: "1-Bit ALU Slice",
    description:
      "Performs ADD, AND, OR, or XOR on one bit, selected by a 2-bit control signal.",
    displayCode: `
const ALU1 = circuit('ALU1', {
  in: { a: bit, b: bit, cin: bit, op0: bit, op1: bit },
  out: { result: bit, cout: bit },
  nodes: { add: FullAdder, op_and: And, op_or: Or, op_xor: Xor, mux_lo: Mux, mux_hi: Mux, mux_out: Mux },
  connect: ({ in: inp, out, add, op_and, op_or, op_xor, mux_lo, mux_hi, mux_out }) => [
    inp.a.to(add.a, op_and.a, op_or.a, op_xor.a),
    inp.b.to(add.b, op_and.b, op_or.b, op_xor.b),
    inp.cin.to(add.cin),
    add.cout.to(out.cout),
    add.sum.to(mux_lo.a),
    op_and.out.to(mux_lo.b),
    inp.op0.to(mux_lo.sel, mux_hi.sel),
    op_or.out.to(mux_hi.a),
    op_xor.out.to(mux_hi.b),
    mux_lo.out.to(mux_out.a),
    mux_hi.out.to(mux_out.b),
    inp.op1.to(mux_out.sel),
    mux_out.out.to(out.result),
  ],
})
`,
    circuit: ALU1,
  },

  ram: {
    name: "RAM",
    description:
      "256x8 memory. Reads are instant (combinational). Writes happen on the clock edge when write-enable is on.",
    displayCode: `
const DemoRAM = circuit('DemoRAM', {
  nodes: { addr: Input, data_in: Input, we: Switch, mem: RAM, data_out: HexDisplay },
  connect: ({ addr, data_in, we, mem, data_out }) => [
    addr.out.to(mem.addr),
    data_in.out.to(mem.data_in),
    we.out.to(mem.we),
    mem.data_out.to(data_out.in),
  ],
})
`,
    circuit: DemoRAM,
  },
};
