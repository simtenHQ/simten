/** Reference solution for `register-file`. Proven by `__tests__/levels.test.ts`. */

import { bit, bus, circuit } from '@simten/core/circuit';
import {
  And,
  Combiner,
  DFlipFlop,
  HexDisplay,
  Input,
  Splitter,
  Switch,
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

export const RegFile2 = circuit('RegFile2', {
  nodes: {
    write: Switch,
    wsel: Switch,
    asel: Switch,
    bsel: Switch,
    d: Input({ width: 4 }),
    a: HexDisplay({ width: 4 }),
    b: HexDisplay({ width: 4 }),
    reg0: Register4,
    reg1: Register4,
    load1: And,
    load0: Xor,
    readA: BusMux2,
    readB: BusMux2,
  },
  connect: ({
    nodes: { write, wsel, asel, bsel, d, a, b, reg0, reg1, load1, load0, readA, readB },
  }) => [
    write.out.to(load1.a, load0.a),
    wsel.out.to(load1.b),
    load1.out.to(reg1.load, load0.b),
    load0.out.to(reg0.load),
    d.out.to(reg0.d, reg1.d),
    reg0.q.to(readA.a, readB.a),
    reg1.q.to(readA.b, readB.b),
    asel.out.to(readA.sel),
    bsel.out.to(readB.sel),
    readA.out.to(a.in),
    readB.out.to(b.in),
  ],
});
