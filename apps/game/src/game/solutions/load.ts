/** Reference solution for `load`. Proven by `__tests__/levels.test.ts`. */

import { bit, bus, circuit } from '@simten/core';
import { And, Combiner, DFlipFlop, HexDisplay, Input, Nor, Splitter, Xor } from '@simten/core/std';

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
  inputs: { op1: bit, op0: bit },
  outputs: { write: bit },
  nodes: { isLoad: Nor },
  connect: ({ inputs, outputs, nodes: { isLoad } }) => [
    inputs.op1.to(isLoad.a),
    inputs.op0.to(isLoad.b),
    // Only a LOAD (00) writes.
    isLoad.out.to(outputs.write),
  ],
});

export const Cpu4 = circuit('Cpu4', {
  nodes: {
    i: Input({ width: 8 }),
    fields: Instruction,
    control: Control,
    regs: RegFile2,
    r0: HexDisplay({ width: 4 }),
    r1: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { i, fields, control, regs, r0, r1 } }) => [
    i.out.to(fields.i),
    regs.r0.to(r0.in),
    regs.r1.to(r1.in),

    fields.ra.to(regs.wsel),
    fields.op1.to(control.op1),
    fields.op0.to(control.op0),
    control.write.to(regs.write),
    fields.n.to(regs.d),
  ],
});
