/** Reference solution for `cpu-jumps`. Proven by `__tests__/levels.test.ts`. */

import { bit, bus, circuit } from '@simten/core/circuit';
import {
  And,
  Combiner,
  DFlipFlop,
  HexDisplay,
  Input,
  Not,
  Or,
  Splitter,
  Xor,
} from '@simten/core/std';

const Mux2 = circuit('Mux2', {
  inputs: { a: bit, b: bit, sel: bit },
  outputs: { out: bit },
  nodes: {
    x1: Xor,
    a1: And,
    x2: Xor,
  },
  connect: ({ inputs, outputs, nodes: { x1, a1, x2 } }) => [
    inputs.a.to(x1.a, x2.a),
    inputs.b.to(x1.b),
    inputs.sel.to(a1.b),
    x1.out.to(a1.a),
    a1.out.to(x2.b),
    x2.out.to(outputs.out),
  ],
});

const Mux4 = circuit('Mux4', {
  inputs: { d0: bit, d1: bit, d2: bit, d3: bit, s1: bit, s0: bit },
  outputs: { out: bit },
  nodes: {
    low: Mux2,
    high: Mux2,
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { low, high, pick } }) => [
    inputs.d0.to(low.a),
    inputs.d1.to(low.b),
    inputs.d2.to(high.a),
    inputs.d3.to(high.b),
    inputs.s0.to(low.sel, high.sel),
    low.out.to(pick.a),
    high.out.to(pick.b),
    inputs.s1.to(pick.sel),
    pick.out.to(outputs.out),
  ],
});

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: {
    x1: Xor,
    a1: And,
  },
  connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
    inputs.a.to(x1.a, a1.a),
    inputs.b.to(x1.b, a1.b),
    x1.out.to(outputs.sum),
    a1.out.to(outputs.carry),
  ],
});

const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: {
    h1: HalfAdder,
    h2: HalfAdder,
    o1: Or,
  },
  connect: ({ inputs, outputs, nodes: { h1, h2, o1 } }) => [
    inputs.a.to(h1.a),
    inputs.b.to(h1.b),
    h1.sum.to(h2.a),
    inputs.cin.to(h2.b),
    h2.sum.to(outputs.sum),
    h1.carry.to(o1.a),
    h2.carry.to(o1.b),
    o1.out.to(outputs.cout),
  ],
});

const Invert4 = circuit('Invert4', {
  inputs: { a: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    bits: Splitter({ width: 4 }),
    join: Combiner({ width: 4 }),
    n0: Not,
    n1: Not,
    n2: Not,
    n3: Not,
  },
  connect: ({ inputs, outputs, nodes: { bits, join, n0, n1, n2, n3 } }) => [
    inputs.a.to(bits.in),
    bits.bit0.to(n0.in),
    bits.bit1.to(n1.in),
    bits.bit2.to(n2.in),
    bits.bit3.to(n3.in),
    n0.out.to(join.bit0),
    n1.out.to(join.bit1),
    n2.out.to(join.bit2),
    n3.out.to(join.bit3),
    join.out.to(outputs.out),
  ],
});

const Adder4 = circuit('Adder4', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { s: bus(4), cout: bit },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    sBits: Combiner({ width: 4 }),
    add0: HalfAdder,
    add1: FullAdder,
    add2: FullAdder,
    add3: FullAdder,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, sBits, add0, add1, add2, add3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    sBits.out.to(outputs.s),
    aBits.bit0.to(add0.a),
    bBits.bit0.to(add0.b),
    add0.sum.to(sBits.bit0),
    add0.carry.to(add1.cin),
    aBits.bit1.to(add1.a),
    bBits.bit1.to(add1.b),
    add1.sum.to(sBits.bit1),
    add1.cout.to(add2.cin),
    aBits.bit2.to(add2.a),
    bBits.bit2.to(add2.b),
    add2.sum.to(sBits.bit2),
    add2.cout.to(add3.cin),
    aBits.bit3.to(add3.a),
    bBits.bit3.to(add3.b),
    add3.sum.to(sBits.bit3),
    add3.cout.to(outputs.cout),
  ],
});

const Subtract4 = circuit('Subtract4', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { d: bus(4), borrow: bit },
  nodes: {
    flipA: Invert4,
    add: Adder4,
    flipSum: Invert4,
  },
  connect: ({ inputs, outputs, nodes: { flipA, add, flipSum } }) => [
    inputs.a.to(flipA.a),
    flipA.out.to(add.a),
    inputs.b.to(add.b),
    add.s.to(flipSum.a),
    flipSum.out.to(outputs.d),
    add.cout.to(outputs.borrow),
  ],
});

const LessThan4 = circuit('LessThan4', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { lt: bit },
  nodes: {
    sub: Subtract4,
  },
  connect: ({ inputs, outputs, nodes: { sub } }) => [
    inputs.a.to(sub.a),
    inputs.b.to(sub.b),
    sub.borrow.to(outputs.lt),
  ],
});

const BitwiseAnd = circuit('BitwiseAnd', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    g0: And,
    g1: And,
    g2: And,
    g3: And,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, outBits, g0, g1, g2, g3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    outBits.out.to(outputs.out),
    aBits.bit0.to(g0.a),
    bBits.bit0.to(g0.b),
    g0.out.to(outBits.bit0),
    aBits.bit1.to(g1.a),
    bBits.bit1.to(g1.b),
    g1.out.to(outBits.bit1),
    aBits.bit2.to(g2.a),
    bBits.bit2.to(g2.b),
    g2.out.to(outBits.bit2),
    aBits.bit3.to(g3.a),
    bBits.bit3.to(g3.b),
    g3.out.to(outBits.bit3),
  ],
});

const BitwiseOr = circuit('BitwiseOr', {
  inputs: { a: bus(4), b: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    g0: Or,
    g1: Or,
    g2: Or,
    g3: Or,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, outBits, g0, g1, g2, g3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    outBits.out.to(outputs.out),
    aBits.bit0.to(g0.a),
    bBits.bit0.to(g0.b),
    g0.out.to(outBits.bit0),
    aBits.bit1.to(g1.a),
    bBits.bit1.to(g1.b),
    g1.out.to(outBits.bit1),
    aBits.bit2.to(g2.a),
    bBits.bit2.to(g2.b),
    g2.out.to(outBits.bit2),
    aBits.bit3.to(g3.a),
    bBits.bit3.to(g3.b),
    g3.out.to(outBits.bit3),
  ],
});

const BusMux4 = circuit('BusMux4', {
  inputs: { s1: bit, s0: bit, d0: bus(4), d1: bus(4), d2: bus(4), d3: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    d0Bits: Splitter({ width: 4 }),
    d1Bits: Splitter({ width: 4 }),
    d2Bits: Splitter({ width: 4 }),
    d3Bits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    m0: Mux4,
    m1: Mux4,
    m2: Mux4,
    m3: Mux4,
  },
  connect: ({
    inputs,
    outputs,
    nodes: { d0Bits, d1Bits, d2Bits, d3Bits, outBits, m0, m1, m2, m3 },
  }) => [
    inputs.d0.to(d0Bits.in),
    inputs.d1.to(d1Bits.in),
    inputs.d2.to(d2Bits.in),
    inputs.d3.to(d3Bits.in),
    outBits.out.to(outputs.out),
    inputs.s1.to(m0.s1, m1.s1, m2.s1, m3.s1),
    inputs.s0.to(m0.s0, m1.s0, m2.s0, m3.s0),
    d0Bits.bit0.to(m0.d0),
    d1Bits.bit0.to(m0.d1),
    d2Bits.bit0.to(m0.d2),
    d3Bits.bit0.to(m0.d3),
    m0.out.to(outBits.bit0),
    d0Bits.bit1.to(m1.d0),
    d1Bits.bit1.to(m1.d1),
    d2Bits.bit1.to(m1.d2),
    d3Bits.bit1.to(m1.d3),
    m1.out.to(outBits.bit1),
    d0Bits.bit2.to(m2.d0),
    d1Bits.bit2.to(m2.d1),
    d2Bits.bit2.to(m2.d2),
    d3Bits.bit2.to(m2.d3),
    m2.out.to(outBits.bit2),
    d0Bits.bit3.to(m3.d0),
    d1Bits.bit3.to(m3.d1),
    d2Bits.bit3.to(m3.d2),
    d3Bits.bit3.to(m3.d3),
    m3.out.to(outBits.bit3),
  ],
});

const Alu4 = circuit('Alu4', {
  inputs: { op1: bit, op0: bit, a: bus(4), b: bus(4) },
  outputs: { r: bus(4) },
  nodes: {
    add: Adder4,
    sub: Subtract4,
    and: BitwiseAnd,
    or: BitwiseOr,
    pick: BusMux4,
  },
  connect: ({ inputs, outputs, nodes: { add, sub, and, or, pick } }) => [
    inputs.a.to(add.a, sub.a, and.a, or.a),
    inputs.b.to(add.b, sub.b, and.b, or.b),
    add.s.to(pick.d0),
    sub.d.to(pick.d1),
    and.out.to(pick.d2),
    or.out.to(pick.d3),
    inputs.op1.to(pick.s1),
    inputs.op0.to(pick.s0),
    pick.out.to(outputs.r),
  ],
});

const RegisterBit = circuit('RegisterBit', {
  inputs: { load: bit, d: bit },
  outputs: { q: bit },
  nodes: {
    ff: DFlipFlop(),
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { ff, pick } }) => [
    ff.q.to(pick.a, outputs.q),
    inputs.d.to(pick.b),
    inputs.load.to(pick.sel),
    pick.out.to(ff.d),
  ],
});

const Register4 = circuit('Register4', {
  inputs: { load: bit, d: bus(4) },
  outputs: { q: bus(4) },
  nodes: {
    dBits: Splitter({ width: 4 }),
    qBits: Combiner({ width: 4 }),
    b0: RegisterBit,
    b1: RegisterBit,
    b2: RegisterBit,
    b3: RegisterBit,
  },
  connect: ({ inputs, outputs, nodes: { dBits, qBits, b0, b1, b2, b3 } }) => [
    inputs.d.to(dBits.in),
    qBits.out.to(outputs.q),
    inputs.load.to(b0.load, b1.load, b2.load, b3.load),
    dBits.bit0.to(b0.d),
    b0.q.to(qBits.bit0),
    dBits.bit1.to(b1.d),
    b1.q.to(qBits.bit1),
    dBits.bit2.to(b2.d),
    b2.q.to(qBits.bit2),
    dBits.bit3.to(b3.d),
    b3.q.to(qBits.bit3),
  ],
});

const BusMux2 = circuit('BusMux2', {
  inputs: { sel: bit, a: bus(4), b: bus(4) },
  outputs: { out: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    outBits: Combiner({ width: 4 }),
    m0: Mux2,
    m1: Mux2,
    m2: Mux2,
    m3: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { aBits, bBits, outBits, m0, m1, m2, m3 } }) => [
    inputs.a.to(aBits.in),
    inputs.b.to(bBits.in),
    outBits.out.to(outputs.out),
    inputs.sel.to(m0.sel, m1.sel, m2.sel, m3.sel),
    aBits.bit0.to(m0.a),
    bBits.bit0.to(m0.b),
    m0.out.to(outBits.bit0),
    aBits.bit1.to(m1.a),
    bBits.bit1.to(m1.b),
    m1.out.to(outBits.bit1),
    aBits.bit2.to(m2.a),
    bBits.bit2.to(m2.b),
    m2.out.to(outBits.bit2),
    aBits.bit3.to(m3.a),
    bBits.bit3.to(m3.b),
    m3.out.to(outBits.bit3),
  ],
});

const RegFile2 = circuit('RegFile2', {
  inputs: { write: bit, wsel: bit, asel: bit, bsel: bit, d: bus(4) },
  outputs: { a: bus(4), b: bus(4), r0: bus(4), r1: bus(4) },
  nodes: {
    reg0: Register4,
    reg1: Register4,
    load1: And,
    load0: Xor,
    readA: BusMux2,
    readB: BusMux2,
  },
  connect: ({ inputs, outputs, nodes: { reg0, reg1, load1, load0, readA, readB } }) => [
    inputs.write.to(load1.a, load0.a),
    inputs.wsel.to(load1.b),
    load1.out.to(reg1.load, load0.b),
    load0.out.to(reg0.load),
    inputs.d.to(reg0.d, reg1.d),
    reg0.q.to(readA.a, readB.a),
    reg1.q.to(readA.b, readB.b),
    inputs.asel.to(readA.sel),
    inputs.bsel.to(readB.sel),
    readA.out.to(outputs.a),
    readB.out.to(outputs.b),
    reg0.q.to(outputs.r0),
    reg1.q.to(outputs.r1),
  ],
});

const CounterBit = circuit('CounterBit', {
  inputs: { carry: bit, jump: bit, a: bit },
  outputs: { q: bit, carryOut: bit },
  nodes: {
    ff: DFlipFlop(),
    add: HalfAdder,
    pick: Mux2,
  },
  connect: ({ inputs, outputs, nodes: { ff, add, pick } }) => [
    ff.q.to(add.a, outputs.q),
    inputs.carry.to(add.b),
    add.sum.to(pick.a),
    inputs.a.to(pick.b),
    inputs.jump.to(pick.sel),
    pick.out.to(ff.d),
    add.carry.to(outputs.carryOut),
  ],
});

const ProgramCounter4 = circuit('ProgramCounter4', {
  inputs: { jump: bit, a: bus(4) },
  outputs: { pc: bus(4) },
  nodes: {
    aBits: Splitter({ width: 4 }),
    pcBits: Combiner({ width: 4 }),
    ff0: DFlipFlop(),
    pick0: Mux2,
    bit1: CounterBit,
    bit2: CounterBit,
    bit3: CounterBit,
  },
  connect: ({ inputs, outputs, nodes: { aBits, pcBits, ff0, pick0, bit1, bit2, bit3 } }) => [
    inputs.a.to(aBits.in),
    pcBits.out.to(outputs.pc),
    // Bit 0 flips every tick; q_bar is already the flipped bit.
    ff0.q_bar.to(pick0.a),
    aBits.bit0.to(pick0.b),
    inputs.jump.to(pick0.sel, bit1.jump, bit2.jump, bit3.jump),
    pick0.out.to(ff0.d),
    ff0.q.to(pcBits.bit0, bit1.carry),
    bit1.carryOut.to(bit2.carry),
    bit2.carryOut.to(bit3.carry),
    aBits.bit1.to(bit1.a),
    aBits.bit2.to(bit2.a),
    aBits.bit3.to(bit3.a),
    bit1.q.to(pcBits.bit1),
    bit2.q.to(pcBits.bit2),
    bit3.q.to(pcBits.bit3),
  ],
});

const Instruction = circuit('Instruction', {
  inputs: { i: bus(8) },
  outputs: { op1: bit, op0: bit, ra: bit, rb: bit, n: bus(4), aluOp1: bit, aluOp0: bit },
  nodes: { bits: Splitter({ width: 8 }), number: Combiner({ width: 4 }) },
  connect: ({ inputs, outputs, nodes: { bits, number } }) => [
    inputs.i.to(bits.in),
    bits.bit7.to(outputs.op1),
    bits.bit6.to(outputs.op0),
    bits.bit5.to(outputs.ra),
    bits.bit4.to(outputs.rb),
    bits.bit3.to(number.bit3),
    bits.bit2.to(number.bit2),
    bits.bit1.to(number.bit1, outputs.aluOp1),
    bits.bit0.to(number.bit0, outputs.aluOp0),
    number.out.to(outputs.n),
  ],
});

const Control = circuit('Control', {
  inputs: { op1: bit, op0: bit, less: bit },
  outputs: { write: bit, useAlu: bit, jump: bit },
  nodes: { notOp1: Not, notOp0: Not, either: Or, both: And },
  connect: ({ inputs, outputs, nodes: { notOp1, notOp0, either, both } }) => [
    // LOAD (00) and the ALU instructions (01) write; jumps (1x) do not.
    inputs.op1.to(notOp1.in, both.a),
    notOp1.out.to(outputs.write),
    inputs.op0.to(outputs.useAlu, notOp0.in),
    // JUMP (10) always jumps; JUMP IF LESS (11) jumps when less is on.
    notOp0.out.to(either.a),
    inputs.less.to(either.b),
    either.out.to(both.b),
    both.out.to(outputs.jump),
  ],
});

export const Cpu4 = circuit('Cpu4', {
  nodes: {
    i: Input({ width: 8 }),
    fields: Instruction,
    control: Control,
    regs: RegFile2,
    alu: Alu4,
    choose: BusMux2,
    less: LessThan4,
    counter: ProgramCounter4,
    pc: HexDisplay({ width: 4 }),
    r0: HexDisplay({ width: 4 }),
    r1: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { i, fields, control, regs, alu, choose, less, counter, pc, r0, r1 } }) => [
    i.out.to(fields.i),
    counter.pc.to(pc.in),
    regs.r0.to(r0.in),
    regs.r1.to(r1.in),

    fields.ra.to(regs.wsel),
    fields.op1.to(control.op1),
    fields.op0.to(control.op0),
    control.write.to(regs.write),
    fields.ra.to(regs.asel),
    fields.rb.to(regs.bsel),
    regs.a.to(alu.a),
    regs.b.to(alu.b),
    fields.aluOp1.to(alu.op1),
    fields.aluOp0.to(alu.op0),
    control.useAlu.to(choose.sel),
    fields.n.to(choose.a),
    alu.r.to(choose.b),
    choose.out.to(regs.d),

    regs.a.to(less.a),
    regs.b.to(less.b),
    less.lt.to(control.less),
    control.jump.to(counter.jump),
    fields.n.to(counter.a),
  ],
});
