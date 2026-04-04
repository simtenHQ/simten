/**
 * Circuit definitions for the "Building a CPU" blog post.
 *
 * Reuses basic gates from splash3 and adds sequential circuits
 * (SR Latch, D Flip-Flop, Register, Counter) for the memory sections.
 */

// Re-export gate circuits from splash3
export { CIRCUITS as GATE_CIRCUITS } from "@/features/splash/circuits";

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  srLatch: {
    name: "SR Latch",
    description:
      "The simplest memory element. Set (S) stores a 1, Reset (R) clears to 0.",
    displayDsl: `
const SRLatch = component('SRLatch')
  .in('s', bit)
  .in('r', bit)
  .out('q', bit)
  .out('q_bar', bit)
  .node('nor1', Nor)
  .node('nor2', Nor)
  .connect(({ in: inp, out, nor1, nor2 }) => [
    inp.s.to(nor1.a),
    nor2.out.to(nor1.b, out.q_bar),
    inp.r.to(nor2.a),
    nor1.out.to(nor2.b, out.q),
  ])
  .build()
`,
    dsl: `
const SRLatch = component('SRLatch')
  .in('s', bit)
  .in('r', bit)
  .out('q', bit)
  .out('q_bar', bit)
  .node('nor1', Nor)
  .node('nor2', Nor)
  .connect(({ in: inp, out, nor1, nor2 }) => [
    inp.s.to(nor1.a),
    nor2.out.to(nor1.b, out.q_bar),
    inp.r.to(nor2.a),
    nor1.out.to(nor2.b, out.q),
  ])
  .build()

const DemoSRLatch = component('DemoSRLatch')
  .node('sw_s', Switch)
  .node('sw_r', Switch)
  .node('latch', SRLatch)
  .node('led_q', Led)
  .node('led_qbar', Led)
  .connect(({ in: inp, out, sw_s, sw_r, latch, led_q, led_qbar }) => [
    sw_s.out.to(latch.s),
    sw_r.out.to(latch.r),
    latch.q.to(led_q.in),
    latch.q_bar.to(led_qbar.in),
  ])
  .build()
`,
  },

  dFlipFlop: {
    name: "D Flip-Flop",
    description:
      "Captures the input value on each clock edge. The building block of registers.",
    displayDsl: `
const DemoFlipFlop = component('DemoFlipFlop')
  .node('sw_d', Switch)
  .node('dff', DFlipFlop)
  .node('led_q', Led)
  .connect(({ in: inp, out, sw_d, dff, led_q }) => [
    sw_d.out.to(dff.d),
    dff.q.to(led_q.in),
  ])
  .build()
`,
    dsl: `
const DemoFlipFlop = component('DemoFlipFlop')
  .node('sw_d', Switch)
  .node('dff', DFlipFlop)
  .node('led_q', Led)
  .connect(({ in: inp, out, sw_d, dff, led_q }) => [
    sw_d.out.to(dff.d),
    dff.q.to(led_q.in),
  ])
  .build()
`,
  },

  register4bit: {
    name: "4-Bit Register",
    description:
      "Four flip-flops in parallel store a nibble (4 bits) of data.",
    displayDsl: `
const Reg4 = component('Reg4')
  .in('d0', bit)
  .in('d1', bit)
  .in('d2', bit)
  .in('d3', bit)
  .out('q0', bit)
  .out('q1', bit)
  .out('q2', bit)
  .out('q3', bit)
  .node('ff0', DFlipFlop)
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .node('ff3', DFlipFlop)
  .connect(({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
    inp.d0.to(ff0.d),
    inp.d1.to(ff1.d),
    inp.d2.to(ff2.d),
    inp.d3.to(ff3.d),
    ff0.q.to(out.q0),
    ff1.q.to(out.q1),
    ff2.q.to(out.q2),
    ff3.q.to(out.q3),
  ])
  .build()
`,
    dsl: `
const Reg4 = component('Reg4')
  .in('d0', bit)
  .in('d1', bit)
  .in('d2', bit)
  .in('d3', bit)
  .out('q0', bit)
  .out('q1', bit)
  .out('q2', bit)
  .out('q3', bit)
  .node('ff0', DFlipFlop)
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .node('ff3', DFlipFlop)
  .connect(({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
    inp.d0.to(ff0.d),
    inp.d1.to(ff1.d),
    inp.d2.to(ff2.d),
    inp.d3.to(ff3.d),
    ff0.q.to(out.q0),
    ff1.q.to(out.q1),
    ff2.q.to(out.q2),
    ff3.q.to(out.q3),
  ])
  .build()

const DemoReg4 = component('DemoReg4')
  .node('sw_d0', Switch)
  .node('sw_d1', Switch)
  .node('sw_d2', Switch)
  .node('sw_d3', Switch)
  .node('reg', Reg4)
  .node('led_q0', Led)
  .node('led_q1', Led)
  .node('led_q2', Led)
  .node('led_q3', Led)
  .connect(({ in: inp, out, sw_d0, sw_d1, sw_d2, sw_d3, reg, led_q0, led_q1, led_q2, led_q3 }) => [
    sw_d0.out.to(reg.d0),
    sw_d1.out.to(reg.d1),
    sw_d2.out.to(reg.d2),
    sw_d3.out.to(reg.d3),
    reg.q0.to(led_q0.in),
    reg.q1.to(led_q1.in),
    reg.q2.to(led_q2.in),
    reg.q3.to(led_q3.in),
  ])
  .build()
`,
  },

  counter4bit: {
    name: "4-Bit Counter",
    description:
      "Counts from 0 to 15 using a synchronous binary counter.",
    displayDsl: `
const Counter4 = component('Counter4')
  .out('q0', bit)
  .out('q1', bit)
  .out('q2', bit)
  .out('q3', bit)
  .node('ff0', DFlipFlop)
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .node('ff3', DFlipFlop)
  .node('inv0', Not)
  .node('xor1', Xor)
  .node('and01', And)
  .node('xor2', Xor)
  .node('and012', And)
  .node('xor3', Xor)
  .connect(({ in: inp, out, ff0, ff1, ff2, ff3, inv0, xor1, and01, xor2, and012, xor3 }) => [
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
  ])
  .build()
`,
    dsl: `
const Counter4 = component('Counter4')
  .out('q0', bit)
  .out('q1', bit)
  .out('q2', bit)
  .out('q3', bit)
  .node('ff0', DFlipFlop)
  .node('ff1', DFlipFlop)
  .node('ff2', DFlipFlop)
  .node('ff3', DFlipFlop)
  .node('inv0', Not)
  .node('xor1', Xor)
  .node('and01', And)
  .node('xor2', Xor)
  .node('and012', And)
  .node('xor3', Xor)
  .connect(({ in: inp, out, ff0, ff1, ff2, ff3, inv0, xor1, and01, xor2, and012, xor3 }) => [
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
  ])
  .build()

const DemoCounter4 = component('DemoCounter4')
  .node('ctr', Counter4)
  .node('led_q0', Led)
  .node('led_q1', Led)
  .node('led_q2', Led)
  .node('led_q3', Led)
  .connect(({ in: inp, out, ctr, led_q0, led_q1, led_q2, led_q3 }) => [
    ctr.q0.to(led_q0.in),
    ctr.q1.to(led_q1.in),
    ctr.q2.to(led_q2.in),
    ctr.q3.to(led_q3.in),
  ])
  .build()
`,
  },

  adder4bit: {
    name: "4-Bit Adder",
    description:
      "Chains four full adders to add two 4-bit numbers with carry propagation.",
    displayDsl: `
const Adder4 = component('Adder4')
  .in('a0', bit)
  .in('a1', bit)
  .in('a2', bit)
  .in('a3', bit)
  .in('b0', bit)
  .in('b1', bit)
  .in('b2', bit)
  .in('b3', bit)
  .out('s0', bit)
  .out('s1', bit)
  .out('s2', bit)
  .out('s3', bit)
  .out('cout', bit)
  .node('fa0', FullAdder)
  .node('fa1', FullAdder)
  .node('fa2', FullAdder)
  .node('fa3', FullAdder)
  .connect(({ in: inp, out, fa0, fa1, fa2, fa3 }) => [
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
  ])
  .build()
`,
    dsl: `
const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()

const FullAdder = component('FullAdder')
  .in('a', bit)
  .in('b', bit)
  .in('cin', bit)
  .out('sum', bit)
  .out('cout', bit)
  .node('ha1', HalfAdder)
  .node('ha2', HalfAdder)
  .node('or1', Or)
  .connect(({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ])
  .build()

const Adder4 = component('Adder4')
  .in('a0', bit)
  .in('a1', bit)
  .in('a2', bit)
  .in('a3', bit)
  .in('b0', bit)
  .in('b1', bit)
  .in('b2', bit)
  .in('b3', bit)
  .out('s0', bit)
  .out('s1', bit)
  .out('s2', bit)
  .out('s3', bit)
  .out('cout', bit)
  .node('fa0', FullAdder)
  .node('fa1', FullAdder)
  .node('fa2', FullAdder)
  .node('fa3', FullAdder)
  .connect(({ in: inp, out, fa0, fa1, fa2, fa3 }) => [
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
  ])
  .build()

const DemoAdder4 = component('DemoAdder4')
  .node('sw_a0', Switch)
  .node('sw_a1', Switch)
  .node('sw_a2', Switch)
  .node('sw_a3', Switch)
  .node('sw_b0', Switch)
  .node('sw_b1', Switch)
  .node('sw_b2', Switch)
  .node('sw_b3', Switch)
  .node('adder', Adder4)
  .node('led_s0', Led)
  .node('led_s1', Led)
  .node('led_s2', Led)
  .node('led_s3', Led)
  .node('led_cout', Led)
  .connect(({ in: inp, out, sw_a0, sw_a1, sw_a2, sw_a3, sw_b0, sw_b1, sw_b2, sw_b3, adder, led_s0, led_s1, led_s2, led_s3, led_cout }) => [
    sw_a0.out.to(adder.a0),
    sw_a1.out.to(adder.a1),
    sw_a2.out.to(adder.a2),
    sw_a3.out.to(adder.a3),
    sw_b0.out.to(adder.b0),
    sw_b1.out.to(adder.b1),
    sw_b2.out.to(adder.b2),
    sw_b3.out.to(adder.b3),
    adder.s0.to(led_s0.in),
    adder.s1.to(led_s1.in),
    adder.s2.to(led_s2.in),
    adder.s3.to(led_s3.in),
    adder.cout.to(led_cout.in),
  ])
  .build()
`,
  },

  alu1bit: {
    name: "1-Bit ALU Slice",
    description:
      "Performs ADD, AND, OR, or XOR on one bit, selected by a 2-bit control signal.",
    displayDsl: `
const ALU1 = component('ALU1')
  .in('a', bit)
  .in('b', bit)
  .in('cin', bit)
  .in('op0', bit)
  .in('op1', bit)
  .out('result', bit)
  .out('cout', bit)
  .node('add', FullAdder)
  .node('op_and', And)
  .node('op_or', Or)
  .node('op_xor', Xor)
  .node('mux_lo', Mux)
  .node('mux_hi', Mux)
  .node('mux_out', Mux)
  .connect(({ in: inp, out, add, op_and, op_or, op_xor, mux_lo, mux_hi, mux_out }) => [
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
  ])
  .build()
`,
    dsl: `
const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()

const FullAdder = component('FullAdder')
  .in('a', bit)
  .in('b', bit)
  .in('cin', bit)
  .out('sum', bit)
  .out('cout', bit)
  .node('ha1', HalfAdder)
  .node('ha2', HalfAdder)
  .node('or1', Or)
  .connect(({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ])
  .build()

const ALU1 = component('ALU1')
  .in('a', bit)
  .in('b', bit)
  .in('cin', bit)
  .in('op0', bit)
  .in('op1', bit)
  .out('result', bit)
  .out('cout', bit)
  .node('add', FullAdder)
  .node('op_and', And)
  .node('op_or', Or)
  .node('op_xor', Xor)
  .node('mux_lo', Mux)
  .node('mux_hi', Mux)
  .node('mux_out', Mux)
  .connect(({ in: inp, out, add, op_and, op_or, op_xor, mux_lo, mux_hi, mux_out }) => [
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
  ])
  .build()

const DemoALU1 = component('DemoALU1')
  .node('sw_a', Switch)
  .node('sw_b', Switch)
  .node('sw_cin', Switch)
  .node('sw_op0', Switch)
  .node('sw_op1', Switch)
  .node('alu', ALU1)
  .node('led_result', Led)
  .node('led_cout', Led)
  .connect(({ in: inp, out, sw_a, sw_b, sw_cin, sw_op0, sw_op1, alu, led_result, led_cout }) => [
    sw_a.out.to(alu.a),
    sw_b.out.to(alu.b),
    sw_cin.out.to(alu.cin),
    sw_op0.out.to(alu.op0),
    sw_op1.out.to(alu.op1),
    alu.result.to(led_result.in),
    alu.cout.to(led_cout.in),
  ])
  .build()
`,
  },

  ram: {
    name: "RAM",
    description:
      "256x8 memory. Reads are instant (combinational). Writes happen on the clock edge when write-enable is on.",
    displayDsl: `
const DemoRAM = component('DemoRAM')
  .node('addr', Input)
  .node('data_in', Input)
  .node('we', Switch)
  .node('mem', RAM)
  .node('data_out', HexDisplay)
  .connect(({ in: inp, out, addr, data_in, we, mem, data_out }) => [
    addr.out.to(mem.addr),
    data_in.out.to(mem.data_in),
    we.out.to(mem.we),
    mem.data_out.to(data_out.in),
  ])
  .build()
`,
    dsl: `
const DemoRAM = component('DemoRAM')
  .node('addr', Input)
  .node('data_in', Input)
  .node('we', Switch)
  .node('mem', RAM)
  .node('data_out', HexDisplay)
  .connect(({ in: inp, out, addr, data_in, we, mem, data_out }) => [
    addr.out.to(mem.addr),
    data_in.out.to(mem.data_in),
    we.out.to(mem.we),
    mem.data_out.to(data_out.in),
  ])
  .build()
`,
  },
};
