/**
 * The campaign, in order.
 *
 * Levels 1–7 are self-contained: a `Switch` for each input, an `Led` for each
 * output, and the player's gates in between. Nothing is a port, so the canvas
 * draws exactly what they wrote and the switches are theirs to click. There is
 * no interface concept to explain before the first gate.
 *
 * Level 8 introduces ports, and the black box that comes with them is the
 * lesson rather than a wart: your circuit collapses into a single component
 * precisely because its insides have stopped being anyone else's problem. It
 * is also the gate to composition: a self-contained circuit cannot be reused,
 * so nothing later can build on your XOR until you have wrapped it.
 *
 * The middle of the act follows NAND → NOT → AND → OR → NOR → XOR → XNOR. Each
 * gate is reachable from the one before it, so the act reads as a single line
 * of reasoning rather than seven unrelated puzzles, and OR lands De Morgan in
 * the middle where there is enough behind it for the trick to mean something.
 *
 * Stubs taper. Level 1 is written out in full with two wires commented out,
 * because its job is to explain the `connect` destructuring (the hardest thing
 * in the DSL to read cold) and uncommenting a line someone can already see
 * working asks less of them than writing one from a blank list. Levels 2 and 3 still place a NAND and wire one side of it. From level 4
 * the `nodes` are the player's to choose; handing them the right number of
 * NANDs would give away both the answer and the point of `par`.
 *
 * Level 1 is a NAND rather than a friendlier AND, even though its lesson is
 * pure syntax. "You get one gate" has to be true from the first screen: handing
 * over an AND and withdrawing it a level later reads as a confiscation, and it
 * made the completion card announce NAND as an unlock when it was really a
 * swap. Nothing is reasoned about here anyway (you uncomment two lines and
 * click) so the player meets NAND by watching it, which is exactly the setup
 * level 2 needs.
 */

import type { Level } from './types';

/**
 * What the arithmetic band may use.
 *
 * Every gate the player built from NAND, handed back once they have proved they
 * can make it. This is the first time `allowed` grows, which is what makes the
 * completion card's unlock line fire; it is derived from exactly this
 * difference, so it can never promise something the grader would reject.
 *
 * The honest version of this is reusing the circuits they actually wrote, which
 * needs composition. Until then the stdlib equivalents stand in: same logic,
 * same gate counts, and the lesson, that what you build makes the next thing
 * cheaper, survives intact.
 */
const ARITHMETIC_GATES = ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor', 'Xnor'];

/**
 * What the memory levels past the counter may use: every logic gate, and the
 * flip-flop the toggle level handed over.
 */
const MEMORY_GATES = [...ARITHMETIC_GATES, 'DFlipFlop'];

/**
 * Finished parts handed over in later stubs, written once so every stub that
 * hands one over hands over the same thing. Each is the reference answer to
 * the level that introduced it, rewritten with ports so it can be used as a
 * component. The matching files in `solutions/` repeat them, because each
 * solution has to run on its own.
 */
const MUX2 = `const Mux2 = circuit('Mux2', {
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
});`;

const MUX4 = `const Mux4 = circuit('Mux4', {
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
});`;

const HALF_ADDER = `const HalfAdder = circuit('HalfAdder', {
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
});`;

const FULL_ADDER = `const FullAdder = circuit('FullAdder', {
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
});`;

const INVERT4 = `const Invert4 = circuit('Invert4', {
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
});`;

const ADDER4 = `const Adder4 = circuit('Adder4', {
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
});`;

const SUBTRACT4 = `const Subtract4 = circuit('Subtract4', {
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
});`;

const LESS_THAN4 = `const LessThan4 = circuit('LessThan4', {
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
});`;

const BITWISE_AND = `const BitwiseAnd = circuit('BitwiseAnd', {
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
});`;

const BITWISE_OR = `const BitwiseOr = circuit('BitwiseOr', {
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
});`;

const BUS_MUX4 = `const BusMux4 = circuit('BusMux4', {
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
  connect: ({ inputs, outputs, nodes: { d0Bits, d1Bits, d2Bits, d3Bits, outBits, m0, m1, m2, m3 } }) => [
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
});`;

const ALU4 = `const Alu4 = circuit('Alu4', {
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
});`;

const REGISTER_BIT = `const RegisterBit = circuit('RegisterBit', {
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
});`;

const REGISTER4 = `const Register4 = circuit('Register4', {
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
});`;

const BUS_MUX2 = `const BusMux2 = circuit('BusMux2', {
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
});`;

const REGFILE2 = `const RegFile2 = circuit('RegFile2', {
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
});`;

const COUNTER_BIT = `const CounterBit = circuit('CounterBit', {
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
});`;

const PC4 = `const ProgramCounter4 = circuit('ProgramCounter4', {
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
});`;

const CPU_INSTRUCTION = `const Instruction = circuit('Instruction', {
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
});`;

export const LEVELS: Level[] = [
  {
    id: 'nand',
    title: 'NAND',
    tagline: 'Light the led unless both switches are on.',
    brief: 'Get started with the platform by wiring up a `NAND` gate',
    target: 'Nand1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand'],
    stub: `// A circuit is built from two things:
// - nodes: the parts you are using
// - connect: the wires between them
//
// A wire reads left to right: \`a.out.to(n1.a)\` runs a wire from a's
// 'out' port into n1's 'a' port.

export default circuit('Nand1', {
  nodes: {
    a: Switch,
    b: Switch,
    n1: Nand,
    result: Led,
  },
  connect: ({ nodes: { a, b, n1, result } }) => [
    // Uncomment the lines below and see the circuit draw itself
    // then hit Submit when you're done
    a.out.to(n1.a),
    // b.out.to(n1.b),
    // n1.out.to(result.in),
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 0 } },
    ],
    par: 1,
    outro: {
      headline: "That's a circuit",
      body: `Nice, you unlocked the NAND gate. Let's use it to build the next gates.`,
    },
  },

  {
    id: 'not',
    title: 'NOT',
    tagline: 'Turn a 1 into a 0.',
    brief: 'Make a `NOT` gate i.e. invert the signal from a to the result',
    target: 'Not1',
    inputs: ['a'],
    outputs: ['result'],
    allowed: ['Nand'],
    stub: `// Let's use the NAND gate from the last level to make a NOT gate.
// Hint: .to() can take multiple arguments to save you some typing

export default circuit('Not1', {
  nodes: {
    a: Switch,
    n1: Nand,
    result: Led,
  },
  connect: ({ nodes: { a, n1, result } }) => [
    a.out.to(n1.a),
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0 }, expect: { result: 1 } },
      { inputs: { a: 1 }, expect: { result: 0 } },
    ],
    par: 1,
    outro: {
      headline: 'One gate down',
      body: 'You built NOT out of nothing but NAND. AND is next.',
    },
  },

  {
    id: 'and',
    title: 'AND',
    tagline: 'Light the led only when both switches are on.',
    brief: 'Make an `AND` gate i.e. light the result only when a and b are both on',
    target: 'And2',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not'],
    stub: `// You built NOT last level, so it is yours to use now.
// Add it to nodes:
//   n: Not,
//
// Then add n to the destructuring in connect:
//   ({ nodes: { a, b, n1, n, result } })

export default circuit('And2', {
  nodes: {
    a: Switch,
    b: Switch,
    n1: Nand,
    result: Led,
  },
  connect: ({ nodes: { a, b, n1, result } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 1 } },
    ],
    par: 2,
    outro: {
      headline: 'AND, rebuilt',
      body: "OR is next. It's a bit tougher.",
    },
  },

  {
    id: 'or',
    title: 'OR',
    tagline: 'Light the led when either switch is on.',
    brief: 'Make an `OR` gate i.e. light the result when either a or b is on',
    target: 'Or1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And'],
    stub: `// From here on, you add the gates yourself. Do it the same way you
// added Not last level: put each gate in nodes, then add its name
// to the destructuring in connect.

export default circuit('Or1', {
  nodes: {
    a: Switch,
    b: Switch,
    result: Led,
  },
  connect: ({ nodes: { a, b, result } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 1 } },
    ],
    par: 3,
    outro: {
      headline: "You just used De Morgan's law",
      body: 'NOT a and NOT b are both on only when both switches are off. Your NAND flips that, so the light is on whenever either switch is on. That is OR: invert the inputs and flip the gate.',
    },
  },

  {
    id: 'nor',
    title: 'NOR',
    tagline: 'Light the led only when both switches are off.',
    brief: 'Make a `NOR` gate i.e. light the result only when a and b are both off',
    target: 'Nor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or'],
    stub: `export default circuit('Nor1', {
  nodes: {
    a: Switch,
    b: Switch,
    result: Led,
  },
  connect: ({ nodes: { a, b, result } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 0 } },
    ],
    par: 2,
    outro: {
      headline: 'Four gates deep',
      body: 'XOR is next. It takes more thought than the others.',
    },
  },

  {
    id: 'xor',
    title: 'XOR',
    tagline: 'Light the led when the switches disagree.',
    brief:
      'Make an `XOR` gate i.e. light the result when a and b are different. This one takes a minute.',
    target: 'Xor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor'],
    stub: `export default circuit('Xor1', {
  nodes: {
    a: Switch,
    b: Switch,
    result: Led,
  },
  connect: ({ nodes: { a, b, result } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 0 } },
    ],
    par: 3,
    outro: {
      headline: 'Three gates, one XOR',
      body: "XNOR is next. It's XOR flipped.",
    },
  },

  {
    id: 'xnor',
    title: 'XNOR',
    tagline: 'Light the led when the switches agree.',
    brief: 'Make an `XNOR` gate i.e. light the result when a and b are the same',
    target: 'Xnor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor'],
    stub: `export default circuit('Xnor1', {
  nodes: {
    a: Switch,
    b: Switch,
    result: Led,
  },
  connect: ({ nodes: { a, b, result } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 1 } },
    ],
    par: 2,
    outro: {
      headline: 'Every gate, from one gate',
      body: 'Six gates built from the NAND you started with. Next you turn one into a part other circuits can use.',
    },
  },

  {
    id: 'making-a-component',
    title: 'Making a Component',
    tagline: 'Give a circuit ports, so other circuits can use it.',
    brief:
      'Rebuild your `XOR` with `inputs` and `outputs` instead of switches and leds, so other circuits can use it',
    target: 'Xor2',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor', 'Xnor'],
    stub: `// The same XOR, but with ports instead of switches and leds:
// - inputs: a and b, coming in from outside
// - outputs: result, going back out
//
// A port wires like anything else: \`a.to(xor.a)\` runs a wire from the
// circuit's 'a' input into xor, and \`xor.out.to(result)\` runs one back out.
//
// The box on the right is your circuit seen from outside. Double-click it
// to look in.

export default circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { result: bit },
  nodes: {
    xor: Xor,
  },
  connect: ({ inputs: { a, b }, outputs: { result }, nodes: { xor } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { result: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { result: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { result: 0 } },
    ],
    par: 1,
    outro: {
      headline: "It's a component now",
      body: 'Ports instead of switches, and the diagram collapsed into one box. That is what lets circuits build on each other, which is where this goes next.',
    },
  },

  {
    id: 'multiplexer',
    title: 'Multiplexer',
    tagline: 'Choose which of two signals gets through.',
    brief: 'Send `a` to the led while `sel` is off, and `b` while it is on',
    target: 'Mux2',
    inputs: ['a', 'b', 'sel'],
    outputs: ['out'],
    allowed: ARITHMETIC_GATES,
    stub: `// sel decides which input reaches out: a when sel is 0,
// b when sel is 1.
//
// One way in: give a and b an AND each, so each one only
// gets through when sel lets it, then OR the two together.

export default circuit('Mux2', {
  nodes: {
    a: Switch,
    b: Switch,
    sel: Switch,
    out: Led,
  },
  connect: ({ nodes: { a, b, sel, out } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0, sel: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 0, sel: 1 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1, sel: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1, sel: 1 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 0, sel: 0 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 0, sel: 1 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 1, sel: 0 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 1, sel: 1 }, expect: { out: 1 } },
    ],
    par: 3,
    outro: {
      headline: 'A switch made of gates',
      body: "You'll use this whenever a circuit has to choose between values. Par is three, so if you used four, try XOR.",
    },
  },

  {
    id: 'buses',
    title: 'Buses',
    tagline: 'Carry a whole number on one wire.',
    brief:
      'Show `a` with every bit flipped on `out`. 5 is 0101, so `out` should be 1010, which is 10',
    target: 'Invert4',
    inputs: ['a'],
    outputs: ['out'],
    allowed: ARITHMETIC_GATES,
    stub: `// A bus is several bits on one wire. a carries a 4-bit
// number, 0 to 15, and out shows one.
//
// A Splitter takes a bus apart into its bits: bits.bit0 is
// the lowest bit of a and bits.bit3 the highest. A Combiner
// puts bits back together into a bus. Both are wired up
// already. You connect the middle.

export default circuit('Invert4', {
  nodes: {
    a: Input({ width: 4 }),
    bits: Splitter({ width: 4 }),
    join: Combiner({ width: 4 }),
    out: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { a, bits, join, out } }) => [
    a.out.to(bits.in),
    join.out.to(out.in),
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0 }, expect: { out: 15 } },
      { inputs: { a: 1 }, expect: { out: 14 } },
      { inputs: { a: 2 }, expect: { out: 13 } },
      { inputs: { a: 3 }, expect: { out: 12 } },
      { inputs: { a: 4 }, expect: { out: 11 } },
      { inputs: { a: 5 }, expect: { out: 10 } },
      { inputs: { a: 6 }, expect: { out: 9 } },
      { inputs: { a: 7 }, expect: { out: 8 } },
      { inputs: { a: 8 }, expect: { out: 7 } },
      { inputs: { a: 9 }, expect: { out: 6 } },
      { inputs: { a: 10 }, expect: { out: 5 } },
      { inputs: { a: 11 }, expect: { out: 4 } },
      { inputs: { a: 12 }, expect: { out: 3 } },
      { inputs: { a: 13 }, expect: { out: 2 } },
      { inputs: { a: 14 }, expect: { out: 1 } },
      { inputs: { a: 15 }, expect: { out: 0 } },
    ],
    par: 4,
    outro: {
      headline: 'Numbers on wires',
      body: 'From here on, numbers travel on one wire, and you split them wherever you need the bits. When you need the same wire four times, a node can be a list, like Array.from({ length: 4 }, () => Not), and connect can loop over it.',
    },
  },

  {
    id: 'majority-vote',
    title: 'Majority Vote',
    tagline: 'Light the led when at least two of three switches are on.',
    brief: 'Light `out` when two or more of `a`, `b` and `c` are on',
    target: 'Majority3',
    inputs: ['a', 'b', 'c'],
    outputs: ['out'],
    allowed: ARITHMETIC_GATES,
    stub: `// Nothing new here, just gates you already have. Work out
// which switches can light the led between them.

export default circuit('Majority3', {
  nodes: {
    a: Switch,
    b: Switch,
    c: Switch,
    out: Led,
  },
  connect: ({ nodes: { a, b, c, out } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0, c: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 0, c: 1 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1, c: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1, c: 1 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 0, c: 0 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 0, c: 1 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 1, c: 0 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 1, c: 1 }, expect: { out: 1 } },
    ],
    par: 4,
    outro: {
      headline: 'Two out of three',
      body: 'Some spacecraft run three copies of the same computer and go with the majority, so one faulty copy gets outvoted.',
    },
  },

  {
    id: 'wider-gates',
    title: 'Wider Gates',
    tagline: 'Check four signals at once.',
    brief: 'Light `all` when every switch is on, and `any` when at least one is',
    target: 'Gates4',
    inputs: ['a', 'b', 'c', 'd'],
    outputs: ['all', 'any'],
    allowed: ARITHMETIC_GATES,
    stub: `// Every gate you have takes two inputs. A gate's output can
// be another gate's input, though, so two-input gates can
// add up to wider ones.

export default circuit('Gates4', {
  nodes: {
    a: Switch,
    b: Switch,
    c: Switch,
    d: Switch,
    all: Led,
    any: Led,
  },
  connect: ({ nodes: { a, b, c, d, all, any } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0, c: 0, d: 0 }, expect: { all: 0, any: 0 } },
      { inputs: { a: 0, b: 0, c: 0, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 0, c: 1, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 0, c: 1, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 1, c: 0, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 1, c: 0, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 1, c: 1, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 0, b: 1, c: 1, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 0, c: 0, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 0, c: 0, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 0, c: 1, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 0, c: 1, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 1, c: 0, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 1, c: 0, d: 1 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 1, c: 1, d: 0 }, expect: { all: 0, any: 1 } },
      { inputs: { a: 1, b: 1, c: 1, d: 1 }, expect: { all: 1, any: 1 } },
    ],
    par: 6,
    outro: {
      headline: 'Any width you like',
      body: "Pairing a with b and c with d is faster in a real chip than a chain. You'll need this again for the equality check.",
    },
  },

  {
    id: 'decoder',
    title: 'Decoder',
    tagline: 'Turn a 2-bit number into one of four lines.',
    brief:
      'Two switches give four combinations. Light one output for each: `y0` when both are off, `y1` when only `a0` is on, `y2` when only `a1` is on, `y3` when both are on. The others stay off',
    target: 'Decoder2',
    inputs: ['a1', 'a0'],
    outputs: ['y0', 'y1', 'y2', 'y3'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned' },
    stub: `// That's counting. Read a1 a0 as a binary number, 00 to 11,
// and the output that lights is that number.
//
// y0 and y3 are one gate each. Once you have them, look at what
// they can tell you about the other two.

export default circuit('Decoder2', {
  nodes: {
    a1: Switch,
    a0: Switch,
    y0: Led,
    y1: Led,
    y2: Led,
    y3: Led,
  },
  connect: ({ nodes: { a1, a0, y0, y1, y2, y3 } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a1: 0, a0: 0 }, expect: { y0: 1, y1: 0, y2: 0, y3: 0 } },
      { inputs: { a1: 0, a0: 1 }, expect: { y0: 0, y1: 1, y2: 0, y3: 0 } },
      { inputs: { a1: 1, a0: 0 }, expect: { y0: 0, y1: 0, y2: 1, y3: 0 } },
      { inputs: { a1: 1, a0: 1 }, expect: { y0: 0, y1: 0, y2: 0, y3: 1 } },
    ],
    par: 4,
    outro: {
      headline: 'One line per number',
      body: 'Memory uses one of these to pick a cell, and a CPU to pick a register. Par is one gate per output: y1 and y2 can each be one gate built from y0 or y3.',
    },
  },

  {
    id: 'four-way-multiplexer',
    title: 'Four-Way Multiplexer',
    tagline: 'Choose one of four signals with a 2-bit select.',
    brief: 'Send whichever of `d0` to `d3` is numbered by `s1 s0` through to `out`',
    target: 'Mux4',
    inputs: ['d0', 'd1', 'd2', 'd3', 's1', 's0'],
    outputs: ['out'],
    allowed: ARITHMETIC_GATES,
    numbers: { s: 'unsigned' },
    stub: `// Your multiplexer from earlier, finished, with ports so it
// works as a part.

// #region Your parts, finished (click the arrow to read them)
${MUX2}
// #endregion

// s1 s0 is a number from 0 to 3, like the decoder's input.
// One Mux2 can narrow d0 and d1 down to one signal.

export default circuit('Mux4', {
  nodes: {
    d0: Switch,
    d1: Switch,
    d2: Switch,
    d3: Switch,
    s1: Switch,
    s0: Switch,
    out: Led,
  },
  connect: ({ nodes: { d0, d1, d2, d3, s1, s0, out } }) => [
    //
  ],
});
`,
    // 16 of the 64 combinations. For each select value: the chosen input on
    // with the rest off, the reverse, and two mixed patterns. The first two
    // mean a circuit that reads the wrong input fails whichever one it reads.
    vectors: [
      { inputs: { d0: 1, d1: 0, d2: 0, d3: 0, s1: 0, s0: 0 }, expect: { out: 1 } },
      { inputs: { d0: 0, d1: 1, d2: 1, d3: 1, s1: 0, s0: 0 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 0, d2: 1, d3: 0, s1: 0, s0: 0 }, expect: { out: 1 } },
      { inputs: { d0: 1, d1: 1, d2: 0, d3: 0, s1: 0, s0: 0 }, expect: { out: 1 } },
      { inputs: { d0: 0, d1: 1, d2: 0, d3: 0, s1: 0, s0: 1 }, expect: { out: 1 } },
      { inputs: { d0: 1, d1: 0, d2: 1, d3: 1, s1: 0, s0: 1 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 0, d2: 1, d3: 0, s1: 0, s0: 1 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 1, d2: 0, d3: 0, s1: 0, s0: 1 }, expect: { out: 1 } },
      { inputs: { d0: 0, d1: 0, d2: 1, d3: 0, s1: 1, s0: 0 }, expect: { out: 1 } },
      { inputs: { d0: 1, d1: 1, d2: 0, d3: 1, s1: 1, s0: 0 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 0, d2: 1, d3: 0, s1: 1, s0: 0 }, expect: { out: 1 } },
      { inputs: { d0: 1, d1: 1, d2: 0, d3: 0, s1: 1, s0: 0 }, expect: { out: 0 } },
      { inputs: { d0: 0, d1: 0, d2: 0, d3: 1, s1: 1, s0: 1 }, expect: { out: 1 } },
      { inputs: { d0: 1, d1: 1, d2: 1, d3: 0, s1: 1, s0: 1 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 0, d2: 1, d3: 0, s1: 1, s0: 1 }, expect: { out: 0 } },
      { inputs: { d0: 1, d1: 1, d2: 0, d3: 0, s1: 1, s0: 1 }, expect: { out: 0 } },
    ],
    par: 9,
    outro: {
      headline: 'Built from parts',
      body: 'Three multiplexers in a tree. The decoder plus some ANDs and an OR works too, but the tree is cheaper.',
    },
  },

  {
    id: 'equality',
    title: 'Equality',
    tagline: 'Light the led when two 4-bit numbers are the same.',
    brief: 'Light `eq` when `a` and `b` are the same number',
    target: 'Equal4',
    inputs: ['a', 'b'],
    outputs: ['eq'],
    allowed: ARITHMETIC_GATES,
    stub: `// Two numbers are the same when every bit matches the bit
// in the same place in the other one.

export default circuit('Equal4', {
  nodes: {
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    b: Input({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    eq: Led,
  },
  connect: ({ nodes: { a, aBits, b, bBits, eq } }) => [
    a.out.to(aBits.in),
    b.out.to(bBits.in),
    //
  ],
});
`,
    // Four equal pairs, then pairs that differ in exactly one bit, each
    // position twice, so a bit left out of the comparison gets caught.
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { eq: 1 } },
      { inputs: { a: 15, b: 15 }, expect: { eq: 1 } },
      { inputs: { a: 9, b: 9 }, expect: { eq: 1 } },
      { inputs: { a: 6, b: 6 }, expect: { eq: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { eq: 0 } },
      { inputs: { a: 0, b: 2 }, expect: { eq: 0 } },
      { inputs: { a: 0, b: 4 }, expect: { eq: 0 } },
      { inputs: { a: 0, b: 8 }, expect: { eq: 0 } },
      { inputs: { a: 15, b: 14 }, expect: { eq: 0 } },
      { inputs: { a: 15, b: 13 }, expect: { eq: 0 } },
      { inputs: { a: 15, b: 11 }, expect: { eq: 0 } },
      { inputs: { a: 15, b: 7 }, expect: { eq: 0 } },
    ],
    par: 7,
    outro: {
      headline: 'Bit for bit',
      body: 'Most CPUs get this from subtraction instead: subtract one number from the other and check that every bit of the result is 0.',
    },
  },

  {
    id: 'parity',
    title: 'Parity',
    tagline: 'Light the led when an odd number of switches are on.',
    brief: 'Light `odd` when one or three of the switches are on',
    target: 'Parity4',
    inputs: ['a', 'b', 'c', 'd'],
    outputs: ['odd'],
    allowed: ARITHMETIC_GATES,
    stub: `// There's a three-gate answer.

export default circuit('Parity4', {
  nodes: {
    a: Switch,
    b: Switch,
    c: Switch,
    d: Switch,
    odd: Led,
  },
  connect: ({ nodes: { a, b, c, d, odd } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0, c: 0, d: 0 }, expect: { odd: 0 } },
      { inputs: { a: 0, b: 0, c: 0, d: 1 }, expect: { odd: 1 } },
      { inputs: { a: 0, b: 0, c: 1, d: 0 }, expect: { odd: 1 } },
      { inputs: { a: 0, b: 0, c: 1, d: 1 }, expect: { odd: 0 } },
      { inputs: { a: 0, b: 1, c: 0, d: 0 }, expect: { odd: 1 } },
      { inputs: { a: 0, b: 1, c: 0, d: 1 }, expect: { odd: 0 } },
      { inputs: { a: 0, b: 1, c: 1, d: 0 }, expect: { odd: 0 } },
      { inputs: { a: 0, b: 1, c: 1, d: 1 }, expect: { odd: 1 } },
      { inputs: { a: 1, b: 0, c: 0, d: 0 }, expect: { odd: 1 } },
      { inputs: { a: 1, b: 0, c: 0, d: 1 }, expect: { odd: 0 } },
      { inputs: { a: 1, b: 0, c: 1, d: 0 }, expect: { odd: 0 } },
      { inputs: { a: 1, b: 0, c: 1, d: 1 }, expect: { odd: 1 } },
      { inputs: { a: 1, b: 1, c: 0, d: 0 }, expect: { odd: 0 } },
      { inputs: { a: 1, b: 1, c: 0, d: 1 }, expect: { odd: 1 } },
      { inputs: { a: 1, b: 1, c: 1, d: 0 }, expect: { odd: 1 } },
      { inputs: { a: 1, b: 1, c: 1, d: 1 }, expect: { odd: 0 } },
    ],
    par: 3,
    outro: {
      headline: 'Odd one out',
      body: 'XOR is on when an odd number of its inputs are, and that holds when you chain them. Send this bit with your data and you can spot a single flipped bit.',
    },
  },

  {
    id: 'half-adder',
    title: 'Half Adder',
    tagline: 'Add two bits, and keep what carries.',
    brief: 'Add two bits i.e. sum is the bit you keep, carry is the one that spills over',
    target: 'HalfAdder',
    inputs: ['a', 'b'],
    outputs: ['sum', 'carry'],
    allowed: ARITHMETIC_GATES,
    stub: `// Adding two bits gives 0, 1 or 2, and 2 does not fit in
// one bit, so the answer needs two leds.
//
// You proved you could build these gates, so you have them
// now.

export default circuit('HalfAdder', {
  nodes: {
    a: Switch,
    b: Switch,
    sum: Led,
    carry: Led,
  },
  connect: ({ nodes: { a, b, sum, carry } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { sum: 0, carry: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { sum: 1, carry: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { sum: 1, carry: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { sum: 0, carry: 1 } },
    ],
    par: 2,
    outro: {
      headline: 'That is addition',
      body: 'Sum is XOR, carry is AND. Half an adder, because it cannot take a carry coming in.',
    },
  },

  {
    id: 'full-adder',
    title: 'Full Adder',
    tagline: 'Add two bits and a carry coming in.',
    brief: 'Use the `HalfAdder` from the last level to add three bits now',
    target: 'FullAdder',
    inputs: ['a', 'b', 'cin'],
    outputs: ['sum', 'cout'],
    allowed: ARITHMETIC_GATES,
    stub: `// Completed HalfAdder for reuse below

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x1: Xor, a1: And },
  connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
    inputs.a.to(x1.a, a1.a),
    inputs.b.to(x1.b, a1.b),
    x1.out.to(outputs.sum),
    a1.out.to(outputs.carry),
  ],
});

// Add a and b with h1, then add cin to that with h2.
// Either can carry, so cout is one gate away.

export default circuit('FullAdder', {
  nodes: {
    a: Switch,
    b: Switch,
    cin: Switch,
    h1: HalfAdder,
    h2: HalfAdder,
    sum: Led,
    cout: Led,
  },
  connect: ({ nodes: { a, b, cin, h1, h2, sum, cout } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0, cin: 0 }, expect: { sum: 0, cout: 0 } },
      { inputs: { a: 0, b: 0, cin: 1 }, expect: { sum: 1, cout: 0 } },
      { inputs: { a: 0, b: 1, cin: 0 }, expect: { sum: 1, cout: 0 } },
      { inputs: { a: 0, b: 1, cin: 1 }, expect: { sum: 0, cout: 1 } },
      { inputs: { a: 1, b: 0, cin: 0 }, expect: { sum: 1, cout: 0 } },
      { inputs: { a: 1, b: 0, cin: 1 }, expect: { sum: 0, cout: 1 } },
      { inputs: { a: 1, b: 1, cin: 0 }, expect: { sum: 0, cout: 1 } },
      { inputs: { a: 1, b: 1, cin: 1 }, expect: { sum: 1, cout: 1 } },
    ],
    par: 5,
    outro: {
      headline: 'Full adder',
      body: 'Chain these end to end and you can add any width.',
    },
  },

  {
    id: '4-bit-adder',
    title: '4-Bit Adder',
    tagline: 'Add two 4-bit numbers.',
    brief: 'Add `a` to `b`. The sum goes on `s`, and anything too big for four bits lights `cout`',
    target: 'Adder4',
    inputs: ['a', 'b'],
    outputs: ['s', 'cout'],
    allowed: ARITHMETIC_GATES,
    stub: `// Your half adder and full adder, finished, with ports.

// #region Your parts, finished (click the arrow to read them)
${HALF_ADDER}

${FULL_ADDER}
// #endregion

// One adder per bit, the same way you add on paper: start at
// bit 0 and carry into the next column. Nothing carries into
// bit 0, so it does not need a full adder.
//
// aBits.bit0 is the lowest bit of a, and sBits.bit0 the lowest
// bit of the sum.

export default circuit('Adder4', {
  nodes: {
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    b: Input({ width: 4 }),
    bBits: Splitter({ width: 4 }),
    s: HexDisplay({ width: 4 }),
    sBits: Combiner({ width: 4 }),
    cout: Led,
  },
  connect: ({ nodes: { a, aBits, b, bBits, s, sBits, cout } }) => [
    a.out.to(aBits.in),
    b.out.to(bBits.in),
    sBits.out.to(s.in),
    //
  ],
});
`,
    // 12 of the 256 sums, picked so every carry gets used: 15 + 1 ripples
    // through all four bits, and 15 + 15 overflows with every bit set.
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { s: 0, cout: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { s: 2, cout: 0 } },
      { inputs: { a: 5, b: 3 }, expect: { s: 8, cout: 0 } },
      { inputs: { a: 7, b: 8 }, expect: { s: 15, cout: 0 } },
      { inputs: { a: 15, b: 1 }, expect: { s: 0, cout: 1 } },
      { inputs: { a: 15, b: 15 }, expect: { s: 14, cout: 1 } },
      { inputs: { a: 8, b: 8 }, expect: { s: 0, cout: 1 } },
      { inputs: { a: 6, b: 9 }, expect: { s: 15, cout: 0 } },
      { inputs: { a: 10, b: 5 }, expect: { s: 15, cout: 0 } },
      { inputs: { a: 3, b: 13 }, expect: { s: 0, cout: 1 } },
      { inputs: { a: 7, b: 1 }, expect: { s: 8, cout: 0 } },
      { inputs: { a: 12, b: 4 }, expect: { s: 0, cout: 1 } },
    ],
    par: 17,
    outro: {
      headline: 'Ripple carry',
      body: 'Each bit waits for the carry from the one below. Real CPUs spend extra gates working the carries out early, because waiting on 64 of them is slow.',
    },
  },

  {
    id: 'negative-numbers',
    title: 'Negative Numbers',
    tagline: 'Turn a number into its negative.',
    brief: "Put the negative of `a` on `n`, in two's complement. In four bits, -3 is written as 13",
    target: 'Negate4',
    inputs: ['a'],
    outputs: ['n'],
    allowed: ARITHMETIC_GATES,
    stub: `// Four bits count up to 15 and then wrap round to 0. So the
// negative of 3 is whatever you add to 3 to get 16: that's 13.
// This way of writing negatives is called two's complement.
//
// The recipe: flip every bit, then add 1.
//
// You could build that from NOTs and adders. It comes out much
// smaller if you work out what the recipe does to each bit,
// starting from bit 0.

export default circuit('Negate4', {
  nodes: {
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    n: HexDisplay({ width: 4 }),
    nBits: Combiner({ width: 4 }),
  },
  connect: ({ nodes: { a, aBits, n, nBits } }) => [
    a.out.to(aBits.in),
    nBits.out.to(n.in),
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0 }, expect: { n: 0 } },
      { inputs: { a: 1 }, expect: { n: 15 } },
      { inputs: { a: 2 }, expect: { n: 14 } },
      { inputs: { a: 3 }, expect: { n: 13 } },
      { inputs: { a: 4 }, expect: { n: 12 } },
      { inputs: { a: 5 }, expect: { n: 11 } },
      { inputs: { a: 6 }, expect: { n: 10 } },
      { inputs: { a: 7 }, expect: { n: 9 } },
      { inputs: { a: 8 }, expect: { n: 8 } },
      { inputs: { a: 9 }, expect: { n: 7 } },
      { inputs: { a: 10 }, expect: { n: 6 } },
      { inputs: { a: 11 }, expect: { n: 5 } },
      { inputs: { a: 12 }, expect: { n: 4 } },
      { inputs: { a: 13 }, expect: { n: 3 } },
      { inputs: { a: 14 }, expect: { n: 2 } },
      { inputs: { a: 15 }, expect: { n: 1 } },
    ],
    par: 5,
    outro: {
      headline: 'Negatives that add',
      body: '5 + 13 is 18, which wraps to 2, the same as 5 - 3. So an adder can subtract, which is next.',
    },
  },

  {
    id: 'subtractor',
    title: 'Subtractor',
    tagline: 'Take one 4-bit number away from another.',
    brief: 'Put `a - b` on `d`, and light `borrow` when `b` is bigger than `a`',
    target: 'Subtract4',
    inputs: ['a', 'b'],
    outputs: ['d', 'borrow'],
    allowed: ARITHMETIC_GATES,
    stub: `// Your 4-bit adder, finished, and Invert4, your circuit from
// Buses that flips every bit of a number.

// #region Your parts, finished (click the arrow to read them)
${HALF_ADDER}

${FULL_ADDER}

${INVERT4}

${ADDER4}
// #endregion

// a - b is a plus the negative of b. You could negate b and add,
// but then cout would not tell you when b was the bigger one.
// Flipping both ends works out better: invert a, add b, then
// invert the sum. Try 5 - 3 on paper.
//
// Done that way, cout comes on exactly when b is bigger than a,
// so it is your borrow with no gate needed.

export default circuit('Subtract4', {
  nodes: {
    a: Input({ width: 4 }),
    b: Input({ width: 4 }),
    d: HexDisplay({ width: 4 }),
    borrow: Led,
  },
  connect: ({ nodes: { a, b, d, borrow } }) => [
    //
  ],
});
`,
    // Includes a below b (borrow set), a equal to b (zero), and 0 - 1.
    vectors: [
      { inputs: { a: 5, b: 3 }, expect: { d: 2, borrow: 0 } },
      { inputs: { a: 3, b: 5 }, expect: { d: 14, borrow: 1 } },
      { inputs: { a: 7, b: 7 }, expect: { d: 0, borrow: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { d: 15, borrow: 1 } },
      { inputs: { a: 0, b: 0 }, expect: { d: 0, borrow: 0 } },
      { inputs: { a: 15, b: 15 }, expect: { d: 0, borrow: 0 } },
      { inputs: { a: 15, b: 0 }, expect: { d: 15, borrow: 0 } },
      { inputs: { a: 8, b: 1 }, expect: { d: 7, borrow: 0 } },
      { inputs: { a: 1, b: 8 }, expect: { d: 9, borrow: 1 } },
      { inputs: { a: 12, b: 4 }, expect: { d: 8, borrow: 0 } },
      { inputs: { a: 9, b: 6 }, expect: { d: 3, borrow: 0 } },
      { inputs: { a: 6, b: 13 }, expect: { d: 9, borrow: 1 } },
    ],
    par: 25,
    outro: {
      headline: 'Two rows of NOTs',
      body: 'Real CPUs use one adder for both: a control line flips b and feeds in a carry of 1 when the instruction is a subtract.',
    },
  },

  {
    id: 'less-than',
    title: 'Less Than',
    tagline: 'Light the led when one number is smaller than another.',
    brief: 'Light `lt` when `a` is smaller than `b`',
    target: 'LessThan4',
    inputs: ['a', 'b'],
    outputs: ['lt'],
    allowed: ARITHMETIC_GATES,
    stub: `// Your subtractor, finished, with the parts it is made of.

// #region Your parts, finished (click the arrow to read them)
${HALF_ADDER}

${FULL_ADDER}

${INVERT4}

${ADDER4}

${SUBTRACT4}
// #endregion

// Both numbers run from 0 to 15 here, no negatives. You already
// have something that knows when b is bigger than a.

export default circuit('LessThan4', {
  nodes: {
    a: Input({ width: 4 }),
    b: Input({ width: 4 }),
    lt: Led,
  },
  connect: ({ nodes: { a, b, lt } }) => [
    //
  ],
});
`,
    // Includes a equal to b, a one below b, and 0 and 15 at both ends.
    vectors: [
      { inputs: { a: 5, b: 5 }, expect: { lt: 0 } },
      { inputs: { a: 4, b: 5 }, expect: { lt: 1 } },
      { inputs: { a: 5, b: 4 }, expect: { lt: 0 } },
      { inputs: { a: 0, b: 0 }, expect: { lt: 0 } },
      { inputs: { a: 0, b: 15 }, expect: { lt: 1 } },
      { inputs: { a: 15, b: 0 }, expect: { lt: 0 } },
      { inputs: { a: 15, b: 15 }, expect: { lt: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { lt: 1 } },
      { inputs: { a: 14, b: 15 }, expect: { lt: 1 } },
      { inputs: { a: 7, b: 8 }, expect: { lt: 1 } },
      { inputs: { a: 8, b: 7 }, expect: { lt: 0 } },
      { inputs: { a: 3, b: 10 }, expect: { lt: 1 } },
    ],
    par: 25,
    outro: {
      headline: 'Less than, from a borrow',
      body: 'CPUs compare by subtracting and keeping only the flags. The difference bits go nowhere here, so there are gates to save.',
    },
  },

  {
    id: 'sr-latch',
    title: 'SR Latch',
    tagline: 'Remember a bit after the input goes away.',
    brief:
      'Make a latch i.e. `s` low turns the result on, `r` low turns it off, and both high holds whatever it was last told',
    target: 'Latch1',
    inputs: ['s', 'r'],
    outputs: ['q'],
    allowed: ['Nand'],
    sequential: true,
    stub: `// The led has to remember.
//
// Everything you have built answers only to its inputs. A
// circuit that remembers has to answer to its own output too,
// so the answer has to come back round and feed the thing
// that produced it.
//
// Two gates. Both switches high means hold.
//
// Note: both switches low at once is the state to avoid. It
// forces an answer the circuit cannot hold on to, which is
// why nothing below asks for it.

export default circuit('Latch1', {
  nodes: {
    s: Switch,
    r: Switch,
    q: Led,
  },
  connect: ({ nodes: { s, r, q } }) => [
    //
  ],
});
`,
    // Ordered steps, not a truth table. Steps 2 and 4 carry the same inputs as
    // each other and expect different answers, which is what proves no
    // combinational circuit can pass this level. Step 1 sets deliberately, so
    // the run does not depend on whatever state the circuit powers up in.
    vectors: [
      { inputs: { s: 0, r: 1 }, expect: { q: 1 } },
      { inputs: { s: 1, r: 1 }, expect: { q: 1 } },
      { inputs: { s: 1, r: 0 }, expect: { q: 0 } },
      { inputs: { s: 1, r: 1 }, expect: { q: 0 } },
    ],
    par: 2,
    outro: {
      headline: 'It remembers',
      body: "Two NANDs, each reading the other's output, and it holds a bit. Next you fix the state you were told to avoid.",
    },
  },

  {
    id: 'd-latch',
    title: 'D Latch',
    tagline: 'Store one bit, only while you allow it.',
    brief:
      'Make a d latch i.e. the result follows `d` while `en` is high, and holds when `en` is low',
    target: 'DLatch1',
    inputs: ['d', 'en'],
    outputs: ['q'],
    allowed: ['Nand'],
    sequential: true,
    stub: `// Keep your latch. Put a gate in front of each input.
//
// The pair you built holds when both its inputs are high. So
// the job of the two new gates is: when \`en\` is low, force
// both high no matter what \`d\` is, and when \`en\` is high,
// send \`d\` to one side and its opposite to the other.
//
// A NAND already gives you the opposite of something for
// free. Look at what the first new gate produces before you
// reach for another one.

export default circuit('DLatch1', {
  nodes: {
    d: Switch,
    en: Switch,
    n1: Nand,
    n2: Nand,
    n3: Nand,
    n4: Nand,
    q: Led,
  },
  connect: ({ nodes: { d, en, n1, n2, n3, n4, q } }) => [
    //
  ],
});
`,
    // Steps 2 and 5 carry identical inputs and demand different answers,
    // which is the proof no combinational circuit can pass, without a repeat
    // like that, `XNOR(d, en)` satisfies the whole table with no memory at
    // all. Step 1 stores deliberately, so the run does not depend on whatever
    // state the circuit powers up in.
    vectors: [
      { inputs: { d: 1, en: 1 }, expect: { q: 1 } },
      { inputs: { d: 0, en: 0 }, expect: { q: 1 } },
      { inputs: { d: 0, en: 1 }, expect: { q: 0 } },
      { inputs: { d: 1, en: 0 }, expect: { q: 0 } },
      { inputs: { d: 0, en: 0 }, expect: { q: 0 } },
    ],
    par: 4,
    outro: {
      headline: 'One bit, on demand',
      body: 'One input to store, one to decide when. You get a flip-flop next level.',
    },
  },

  {
    id: 'toggle',
    title: 'Toggle',
    tagline: 'Alternate the led between on and off, every tick.',
    brief: 'Flip the led between on and off once per clock tick, with no switches at all',
    target: 'Toggle1',
    inputs: [],
    outputs: ['q'],
    allowed: ['Nand', 'DFlipFlop'],
    sequential: true,
    intro: {
      headline: 'Sequential circuits',
      body:
        'Everything so far has been **combinational**: the output depends only on the inputs right now. Flip one, the output follows instantly.\n\n' +
        "A flip-flop is **sequential**. It watches a clock, a signal ticking steadily on and off, and only looks at its input at the instant the clock goes from off to on. That instant is called a rising edge. In between, it ignores its input and holds the value it captured. That's memory: your circuit can now remember something.\n\n" +
        "Simten runs on a single clock and wires it to every sequential component for you, so there's nothing to connect. The wire is real; it is just handled, the same way it is in real hardware design. Every flip-flop in your circuit ticks on the same edge, at the same moment.\n\n" +
        'Use the clock controls at the bottom to step one cycle at a time and watch the output change only on the tick.',
      link: {
        label: 'Sequential logic',
        href: 'https://en.wikipedia.org/wiki/Sequential_logic',
      },
    },
    stub: `// A flip-flop is memory with a clock.
//
// Your latch followed \`d\` the whole time \`en\` was high. A D
// flip-flop only looks at \`d\` on a clock edge, and holds it
// steady until the next one, so what it stores this tick is
// what \`d\` was last tick.
//
// Your latch could not do this. Wire its output back to its
// own input and, while \`en\` was high, the loop would run as
// fast as the gates allow. Looking once, on the edge, is what
// turns that race into a single flip.
//
// \`dff.q\` is what it currently holds. \`dff.d\` is what it
// will hold next. Give it the opposite of what it has and it
// can never settle.
//
// One wire does it. Look at what else the flip-flop already
// gives you before reaching for a gate.

export default circuit('Toggle1', {
  nodes: {
    dff: DFlipFlop(),
    q: Led,
  },
  connect: ({ nodes: { dff, q } }) => [
    //
  ],
});
`,
    // No inputs at all, so every step drives nothing and only the clock moves.
    // Identical inputs with alternating answers is exactly the memory proof the
    // suite looks for, and here it is the entire level.
    vectors: [
      { inputs: {}, expect: { q: 1 } },
      { inputs: {}, expect: { q: 0 } },
      { inputs: {}, expect: { q: 1 } },
      { inputs: {}, expect: { q: 0 } },
    ],
    par: 1,
    outro: {
      headline: 'It toggles',
      body: 'One flip-flop and one wire. Add a second flip-flop and some logic and you can count, which is next.',
    },
  },

  {
    id: 'counter',
    title: 'Counter',
    tagline: 'Count 0, 1, 2, 3, and back to 0.',
    brief: 'Count 0, 1, 2, 3 and wrap, reading `bit1` and `bit0` as a binary number',
    target: 'Counter2',
    inputs: [],
    outputs: ['bit0', 'bit1'],
    allowed: ['Nand', 'DFlipFlop'],
    sequential: true,
    stub: `// One clock drives every flip-flop, so bit1 cannot be clocked off
// bit0. Both tick together, and the logic decides which one changes.
// Work out what each \`d\` should be from what the two of them hold now.
const Counter2 = circuit('Counter2', {
  nodes: {
    dff0: DFlipFlop(),
    dff1: DFlipFlop(),
    bit0: Led,
    bit1: Led,
  },
  connect: ({ nodes: { dff0, dff1, bit0, bit1 } }) => [
    dff0.q.to(bit0.in),
    dff1.q.to(bit1.in),
  ],
});
`,
    vectors: [
      { inputs: {}, expect: { bit0: 1, bit1: 0 } },
      { inputs: {}, expect: { bit0: 0, bit1: 1 } },
      { inputs: {}, expect: { bit0: 1, bit1: 1 } },
      { inputs: {}, expect: { bit0: 0, bit1: 0 } },
      { inputs: {}, expect: { bit0: 1, bit1: 0 } },
    ],
    par: 6,
    outro: {
      headline: 'It counts',
      body: "Flip-flops hold the number and logic works out the next one. A CPU's program counter is the same thing, only wider.",
    },
  },

  {
    id: 'register',
    title: 'Register',
    tagline: 'Hold four bits until you are told to change them.',
    brief:
      'Show the stored number on `q`. On each tick, store `d` if `load` is on, and keep the old number if it is off',
    target: 'Register4',
    inputs: ['load', 'd'],
    outputs: ['q'],
    allowed: MEMORY_GATES,
    sequential: true,
    stub: `// Your multiplexer, finished, below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}
// #endregion

// One flip-flop per bit. A flip-flop stores whatever is on its d
// input every tick, so to keep a bit, feed it its own q. To load,
// feed it the new bit instead. A Mux2 picks which, with load.
//
// Build one bit as its own circuit(), with load and d in and q
// out. Then the register is four of them.

export default circuit('Register4', {
  nodes: {
    load: Switch,
    d: Input({ width: 4 }),
    dBits: Splitter({ width: 4 }),
    q: HexDisplay({ width: 4 }),
    qBits: Combiner({ width: 4 }),
  },
  connect: ({ nodes: { load, d, dBits, q, qBits } }) => [
    d.out.to(dBits.in),
    qBits.out.to(q.in),
    //
  ],
});
`,
    // Ordered steps. Steps 2 and 10 carry the same inputs and expect different
    // numbers, and so do 5 and 8: what comes out depends on what was stored.
    vectors: [
      { inputs: { load: 1, d: 5 }, expect: { q: 5 } },
      { inputs: { load: 0, d: 10 }, expect: { q: 5 } },
      { inputs: { load: 0, d: 0 }, expect: { q: 5 } },
      { inputs: { load: 1, d: 10 }, expect: { q: 10 } },
      { inputs: { load: 0, d: 5 }, expect: { q: 10 } },
      { inputs: { load: 0, d: 15 }, expect: { q: 10 } },
      { inputs: { load: 1, d: 15 }, expect: { q: 15 } },
      { inputs: { load: 0, d: 5 }, expect: { q: 15 } },
      { inputs: { load: 1, d: 0 }, expect: { q: 0 } },
      { inputs: { load: 0, d: 10 }, expect: { q: 0 } },
    ],
    par: 16,
    outro: {
      headline: 'Memory you control',
      body: 'Four flip-flops that only change when you say so. Every register in a CPU works like this, just wider.',
    },
  },

  {
    id: 'register-file',
    title: 'Register File',
    tagline: 'Two registers: write one, read both.',
    brief:
      'When `write` is on, store `d` in the register `wsel` picks. Show the register `asel` picks on `a`, and the one `bsel` picks on `b`',
    target: 'RegFile2',
    inputs: ['write', 'wsel', 'asel', 'bsel', 'd'],
    outputs: ['a', 'b'],
    allowed: MEMORY_GATES,
    sequential: true,
    stub: `// Your register, finished, below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${REGISTER_BIT}

${REGISTER4}
// #endregion

// Two registers, numbered 0 and 1. Each needs its own load line,
// on only when write is on and wsel names it.
//
// There are two ways out, a and b, each picking a register with
// its own select, so you can read both at once. Picking between
// two 4-bit numbers is four of your Mux2s side by side: build that
// as its own circuit(), then use it once for each way out. Its
// ports can carry numbers, like inputs: { a: bus(4), b: bus(4) }.

export default circuit('RegFile2', {
  nodes: {
    write: Switch,
    wsel: Switch,
    asel: Switch,
    bsel: Switch,
    d: Input({ width: 4 }),
    a: HexDisplay({ width: 4 }),
    b: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { write, wsel, asel, bsel, d, a, b } }) => [
    //
  ],
});
`,
    // Ordered steps. Steps 4, 6 and 12 carry the same inputs, reading register
    // 0 on both ports each time, and expect 5, then 3, then 9 as it gets
    // overwritten.
    vectors: [
      { inputs: { write: 1, wsel: 0, asel: 0, bsel: 1, d: 5 }, expect: { a: 5, b: 0 } },
      { inputs: { write: 1, wsel: 1, asel: 0, bsel: 1, d: 10 }, expect: { a: 5, b: 10 } },
      { inputs: { write: 0, wsel: 0, asel: 1, bsel: 0, d: 0 }, expect: { a: 10, b: 5 } },
      { inputs: { write: 0, wsel: 0, asel: 0, bsel: 0, d: 0 }, expect: { a: 5, b: 5 } },
      { inputs: { write: 1, wsel: 0, asel: 1, bsel: 1, d: 3 }, expect: { a: 10, b: 10 } },
      { inputs: { write: 0, wsel: 0, asel: 0, bsel: 0, d: 0 }, expect: { a: 3, b: 3 } },
      { inputs: { write: 0, wsel: 1, asel: 1, bsel: 0, d: 15 }, expect: { a: 10, b: 3 } },
      { inputs: { write: 1, wsel: 1, asel: 0, bsel: 1, d: 12 }, expect: { a: 3, b: 12 } },
      { inputs: { write: 0, wsel: 0, asel: 1, bsel: 1, d: 12 }, expect: { a: 12, b: 12 } },
      { inputs: { write: 1, wsel: 0, asel: 0, bsel: 1, d: 9 }, expect: { a: 9, b: 12 } },
      { inputs: { write: 0, wsel: 0, asel: 1, bsel: 0, d: 0 }, expect: { a: 12, b: 9 } },
      { inputs: { write: 0, wsel: 0, asel: 0, bsel: 0, d: 0 }, expect: { a: 9, b: 9 } },
    ],
    par: 58,
    outro: {
      headline: 'Write one, read two',
      body: "Real CPUs read two registers at once and write one, the same as this, just with more of them: the 6502 has three and a RISC-V core has 32. With four, you'd pick which to write with your decoder and which to read with your four-way multiplexer.",
    },
  },

  {
    id: 'program-counter',
    title: 'Program Counter',
    tagline: 'Count up, unless told to jump somewhere else.',
    brief: 'Add 1 to `pc` every tick. When `jump` is on, load `a` instead',
    target: 'ProgramCounter4',
    inputs: ['jump', 'a'],
    outputs: ['pc'],
    allowed: MEMORY_GATES,
    sequential: true,
    stub: `// Your multiplexer and half adder, finished, below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${HALF_ADDER}
// #endregion

// Your counter, four bits wide, with a way to jump. Each bit's
// next value is either the count plus one or the jump address,
// and jump picks.
//
// Adding 1 flips bit 0 every tick (its flip-flop's q_bar is the
// flipped bit). Each bit above adds the carry from the bit below,
// which is what a half adder does. Bits 1 to 3 all work the same
// way, so one of them makes a good circuit() of its own.

export default circuit('ProgramCounter4', {
  nodes: {
    jump: Switch,
    a: Input({ width: 4 }),
    aBits: Splitter({ width: 4 }),
    pc: HexDisplay({ width: 4 }),
    pcBits: Combiner({ width: 4 }),
  },
  connect: ({ nodes: { jump, a, aBits, pc, pcBits } }) => [
    a.out.to(aBits.in),
    pcBits.out.to(pc.in),
    //
  ],
});
`,
    // Ordered steps from 0: count to 3, jump to 12, count through 15 and wrap
    // to 0, then jumps with counting between. Step 11 sets an address with
    // jump off, which has to be ignored.
    vectors: [
      { inputs: { jump: 0, a: 0 }, expect: { pc: 1 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 2 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 3 } },
      { inputs: { jump: 1, a: 12 }, expect: { pc: 12 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 13 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 14 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 15 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 0 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 1 } },
      { inputs: { jump: 1, a: 6 }, expect: { pc: 6 } },
      { inputs: { jump: 0, a: 9 }, expect: { pc: 7 } },
      { inputs: { jump: 1, a: 3 }, expect: { pc: 3 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 4 } },
      { inputs: { jump: 1, a: 10 }, expect: { pc: 10 } },
      { inputs: { jump: 0, a: 0 }, expect: { pc: 11 } },
    ],
    par: 22,
    outro: {
      headline: 'Where the program is',
      body: 'A CPU keeps the address of its next instruction in one of these. Counting moves on to the next instruction, and loading is how a jump or a loop works.',
    },
  },

  {
    id: 'arithmetic-logic-unit',
    title: 'Arithmetic Logic Unit',
    tagline: 'One circuit that adds, subtracts, ANDs or ORs.',
    brief:
      'Put the result of the operation `op1 op0` picks on `r`: 00 is a + b, 01 is a - b, 10 is a AND b, and 11 is a OR b, bit by bit',
    target: 'Alu4',
    inputs: ['op1', 'op0', 'a', 'b'],
    outputs: ['r'],
    allowed: ARITHMETIC_GATES,
    stub: `// Your multiplexers, adder and subtractor, finished, below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${MUX4}

${HALF_ADDER}

${FULL_ADDER}

${INVERT4}

${ADDER4}

${SUBTRACT4}
// #endregion

// Work out all four answers at once, whatever op says, then let
// op1 op0 pick one.
//
// Adder4 and Subtract4 take whole numbers. For AND, OR and the
// picking, build your own parts: a circuit() that ANDs two 4-bit
// numbers bit by bit, one that ORs them, and one that picks one of
// four numbers (a Mux4 for each bit). Their ports can carry
// numbers, like inputs: { a: bus(4), b: bus(4) }. Then the ALU
// is five parts.

export default circuit('Alu4', {
  nodes: {
    op1: Switch,
    op0: Switch,
    a: Input({ width: 4 }),
    b: Input({ width: 4 }),
    r: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { op1, op0, a, b, r } }) => [
    //
  ],
});
`,
    // Four per operation. 12 and 10, and 5 and 3, appear under every op, so a
    // circuit that ignores op, or swaps two of them, gets caught.
    vectors: [
      { inputs: { op1: 0, op0: 0, a: 12, b: 10 }, expect: { r: 6 } },
      { inputs: { op1: 0, op0: 0, a: 5, b: 3 }, expect: { r: 8 } },
      { inputs: { op1: 0, op0: 0, a: 15, b: 1 }, expect: { r: 0 } },
      { inputs: { op1: 0, op0: 0, a: 9, b: 9 }, expect: { r: 2 } },
      { inputs: { op1: 0, op0: 1, a: 12, b: 10 }, expect: { r: 2 } },
      { inputs: { op1: 0, op0: 1, a: 5, b: 3 }, expect: { r: 2 } },
      { inputs: { op1: 0, op0: 1, a: 3, b: 5 }, expect: { r: 14 } },
      { inputs: { op1: 0, op0: 1, a: 0, b: 1 }, expect: { r: 15 } },
      { inputs: { op1: 1, op0: 0, a: 12, b: 10 }, expect: { r: 8 } },
      { inputs: { op1: 1, op0: 0, a: 5, b: 3 }, expect: { r: 1 } },
      { inputs: { op1: 1, op0: 0, a: 15, b: 6 }, expect: { r: 6 } },
      { inputs: { op1: 1, op0: 0, a: 9, b: 6 }, expect: { r: 0 } },
      { inputs: { op1: 1, op0: 1, a: 12, b: 10 }, expect: { r: 14 } },
      { inputs: { op1: 1, op0: 1, a: 5, b: 3 }, expect: { r: 7 } },
      { inputs: { op1: 1, op0: 1, a: 0, b: 0 }, expect: { r: 0 } },
      { inputs: { op1: 1, op0: 1, a: 8, b: 1 }, expect: { r: 9 } },
    ],
    par: 86,
    outro: {
      headline: 'An ALU',
      body: 'Every CPU has one of these. Add registers and a counter to step through a program and you have most of a computer.',
    },
  },

  {
    id: 'load',
    title: 'Load',
    tagline: 'Make your CPU load a number into a register.',
    brief:
      'Each step feeds your CPU one instruction, `i`. Make `LOAD ra, n` work, putting n into register ra: finish Control so it says when to write, then wire Instruction, Control and the register file. This is the program it runs:',
    target: 'Cpu4',
    inputs: ['i'],
    outputs: ['r0', 'r1'],
    allowed: MEMORY_GATES,
    sequential: true,
    program: [
      'LOAD r0, 5',
      'LOAD r1, 3',
      'LOAD r0, 9',
      'LOAD r1, 12',
      'LOAD r0, 0',
      'LOAD r1, 3',
      'LOAD r0, 5',
      'LOAD r0, 15',
    ],
    labels: [
      'LOAD r0, 5',
      'LOAD r1, 3',
      'LOAD r0, 9',
      'LOAD r1, 12',
      'LOAD r0, 0',
      'LOAD r1, 3',
      'LOAD r0, 5',
      'LOAD r0, 15',
    ],
    stub: `// Your register file is folded away below, with r0 and r1 outputs
// added so you can watch both registers, and Instruction, a new
// part that splits an instruction into named fields.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${REGISTER_BIT}

${REGISTER4}

${BUS_MUX2}

${REGFILE2}

${CPU_INSTRUCTION}
// #endregion

// An instruction is 8 bits. Instruction splits it into:
//   op1 op0  what kind it is. 00 is LOAD, the only kind so far.
//   ra, rb   registers: 0 for r0, 1 for r1
//   n        a number
//
// LOAD ra, n puts n into register ra. Control decides whether a
// register gets written: only for a LOAD.

const Control = circuit('Control', {
  inputs: { op1: bit, op0: bit },
  outputs: { write: bit },
  nodes: {},
  connect: ({ inputs, outputs, nodes: {} }) => [
    //
  ],
});

// Then wire Instruction, Control and the register file.
// regs writes d into register wsel when write is on.
export default circuit('Cpu4', {
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
    // New this level: Control needs the kind of instruction, and
    // the register file needs to know which register to write,
    // what to write into it, and when.
    //
  ],
});
`,
    // Ordered steps. The grader plays memory: each step's input is the
    // instruction at the address the last step left in pc.
    vectors: [
      { inputs: { i: 5 }, expect: { r0: 5, r1: 0 } },
      { inputs: { i: 35 }, expect: { r0: 5, r1: 3 } },
      { inputs: { i: 9 }, expect: { r0: 9, r1: 3 } },
      { inputs: { i: 44 }, expect: { r0: 9, r1: 12 } },
      { inputs: { i: 0 }, expect: { r0: 0, r1: 12 } },
      { inputs: { i: 35 }, expect: { r0: 0, r1: 3 } },
      { inputs: { i: 5 }, expect: { r0: 5, r1: 3 } },
      { inputs: { i: 15 }, expect: { r0: 15, r1: 3 } },
    ],
    par: 59,
    outro: {
      headline: 'It loads',
      body: 'Instructions are just bits, and Control turns those bits into the wire that says what to do. Next it calculates.',
    },
  },

  {
    id: 'compute',
    title: 'Compute',
    tagline: 'Make your CPU add, subtract, AND and OR.',
    brief:
      'Your CPU can load. Make it calculate: give Control a `useAlu` output, and wire the ALU in, so `ADD ra, rb` leaves ra + rb in ra, and the same for `SUB`, `AND` and `OR`. This is the program it runs:',
    target: 'Cpu4',
    inputs: ['i'],
    outputs: ['r0', 'r1'],
    allowed: MEMORY_GATES,
    sequential: true,
    program: [
      'LOAD r0, 12',
      'LOAD r1, 10',
      'ADD r0, r1',
      'SUB r0, r1',
      'SUB r0, r1',
      'LOAD r0, 12',
      'AND r0, r1',
      'LOAD r0, 5',
      'OR r0, r1',
      'ADD r1, r0',
      'AND r1, r0',
    ],
    labels: [
      'LOAD r0, 12',
      'LOAD r1, 10',
      'ADD r0, r1',
      'SUB r0, r1',
      'SUB r0, r1',
      'LOAD r0, 12',
      'AND r0, r1',
      'LOAD r0, 5',
      'OR r0, r1',
      'ADD r1, r0',
      'AND r1, r0',
    ],
    stub: `// Your CPU from the last level, with your ALU and BusMux2 added.
// The parts are folded away below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${MUX4}

${HALF_ADDER}

${FULL_ADDER}

${INVERT4}

${ADDER4}

${SUBTRACT4}

${BITWISE_AND}

${BITWISE_OR}

${BUS_MUX4}

${ALU4}

${REGISTER_BIT}

${REGISTER4}

${BUS_MUX2}

${REGFILE2}

${CPU_INSTRUCTION}
// #endregion

// ALU instructions have op1 op0 = 01. They run the ALU on
// registers ra and rb, and write the answer back into ra.
// aluOp1 aluOp0 (the low bits of n) say which operation.
//
// So ALU instructions write too, and Control needs a second
// output, useAlu: write the ALU's answer instead of n.

const Control = circuit('Control', {
  inputs: { op1: bit, op0: bit },
  outputs: { write: bit, useAlu: bit },
  nodes: { isLoad: Nor },
  connect: ({ inputs, outputs, nodes: { isLoad } }) => [
    inputs.op1.to(isLoad.a),
    inputs.op0.to(isLoad.b),
    isLoad.out.to(outputs.write),
    // New: useAlu, on for ALU instructions (01), so the ALU's
    // answer is written instead of n. They write too, so write
    // needs to be on for them as well as for LOAD.
  ],
});

// regs shows register asel on a and bsel on b. choose is your
// BusMux2 from Register File: a when sel is 0, b when sel is 1.
export default circuit('Cpu4', {
  nodes: {
    i: Input({ width: 8 }),
    fields: Instruction,
    control: Control,
    regs: RegFile2,
    alu: Alu4,
    choose: BusMux2,
    r0: HexDisplay({ width: 4 }),
    r1: HexDisplay({ width: 4 }),
  },
  connect: ({ nodes: { i, fields, control, regs, alu, choose, r0, r1 } }) => [
    i.out.to(fields.i),
    regs.r0.to(r0.in),
    regs.r1.to(r1.in),

    // From the last level.
    fields.ra.to(regs.wsel),
    fields.op1.to(control.op1),
    fields.op0.to(control.op0),
    control.write.to(regs.write),
    fields.n.to(regs.d),

    // New this level:
    //   the ALU works on registers ra and rb, read out on regs.a
    //   and regs.b
    //   aluOp1 and aluOp0 pick the ALU's operation
    //   choose decides what regs.d gets: n, or the ALU's answer
    //   when useAlu is on. So n no longer goes straight to regs.d.
    //
  ],
});
`,
    // Ordered steps. The grader plays memory: each step's input is the
    // instruction at the address the last step left in pc.
    vectors: [
      { inputs: { i: 12 }, expect: { r0: 12, r1: 0 } },
      { inputs: { i: 42 }, expect: { r0: 12, r1: 10 } },
      { inputs: { i: 80 }, expect: { r0: 6, r1: 10 } },
      { inputs: { i: 81 }, expect: { r0: 12, r1: 10 } },
      { inputs: { i: 81 }, expect: { r0: 2, r1: 10 } },
      { inputs: { i: 12 }, expect: { r0: 12, r1: 10 } },
      { inputs: { i: 82 }, expect: { r0: 8, r1: 10 } },
      { inputs: { i: 5 }, expect: { r0: 5, r1: 10 } },
      { inputs: { i: 83 }, expect: { r0: 15, r1: 10 } },
      { inputs: { i: 96 }, expect: { r0: 15, r1: 9 } },
      { inputs: { i: 98 }, expect: { r0: 15, r1: 9 } },
    ],
    par: 157,
    outro: {
      headline: 'It calculates',
      body: 'Load numbers, then do maths on them. One thing missing: every program runs straight through once. Next, jumps.',
    },
  },

  {
    id: 'jump',
    title: 'Jump',
    tagline: 'Make your CPU jump, and loop.',
    brief:
      'Your CPU so far is wired up. Finish it so it can jump: give Control a `jump` output, then wire up the program counter and LessThan. Then it runs this program, a loop that adds up Fibonacci numbers:',
    target: 'Cpu4',
    inputs: ['i'],
    outputs: ['pc', 'r0', 'r1'],
    allowed: MEMORY_GATES,
    sequential: true,
    program: [
      'LOAD r0, 1',
      'LOAD r1, 1',
      'ADD r0, r1',
      'ADD r1, r0',
      'JUMP IF LESS r0, r1, 2',
      'SUB r0, r1',
      'AND r0, r1',
      'OR r0, r1',
      'JUMP 8',
    ],
    labels: [
      'LOAD r0, 1',
      'LOAD r1, 1',
      'ADD r0, r1',
      'ADD r1, r0',
      'JUMP IF LESS r0, r1, 2',
      'ADD r0, r1',
      'ADD r1, r0',
      'JUMP IF LESS r0, r1, 2',
      'ADD r0, r1',
      'ADD r1, r0',
      'JUMP IF LESS r0, r1, 2',
      'SUB r0, r1',
      'AND r0, r1',
      'OR r0, r1',
      'JUMP 8',
      'JUMP 8',
    ],
    stub: `// Your CPU so far, with your program counter and LessThan added.
// The parts are folded away below.

// #region Your parts, finished (click the arrow to read them)
${MUX2}

${MUX4}

${HALF_ADDER}

${FULL_ADDER}

${INVERT4}

${ADDER4}

${SUBTRACT4}

${LESS_THAN4}

${BITWISE_AND}

${BITWISE_OR}

${BUS_MUX4}

${ALU4}

${REGISTER_BIT}

${REGISTER4}

${BUS_MUX2}

${REGFILE2}

${COUNTER_BIT}

${PC4}

${CPU_INSTRUCTION}
// #endregion

// The program counter says which instruction comes next. It
// counts up each step, or loads a when jump is on.
//
// JUMP n (op1 op0 = 10) jumps to n. JUMP IF LESS ra, rb, n
// (11) jumps only if ra < rb. Neither writes a register.
//
// Control gets a new input, less, and a new output, jump.

const Control = circuit('Control', {
  inputs: { op1: bit, op0: bit, less: bit },
  outputs: { write: bit, useAlu: bit, jump: bit },
  nodes: { notOp1: Not },
  connect: ({ inputs, outputs, nodes: { notOp1 } }) => [
    inputs.op1.to(notOp1.in),
    notOp1.out.to(outputs.write),
    inputs.op0.to(outputs.useAlu),
    // New: jump. JUMP (10) always jumps; JUMP IF LESS (11)
    // jumps only when less is on. Nothing else jumps.
  ],
});

// less.lt is on when its a is smaller than its b.
export default circuit('Cpu4', {
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

    // From the last levels.
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

    // New this level:
    //   less compares registers ra and rb: give it regs.a and regs.b
    //   its answer, less.lt, goes into control.less
    //   the counter jumps to n when control.jump is on
    //
  ],
});
`,
    // Ordered steps. The grader plays memory: each step's input is the
    // instruction at the address the last step left in pc.
    vectors: [
      { inputs: { i: 1 }, expect: { pc: 1, r0: 1, r1: 0 } },
      { inputs: { i: 33 }, expect: { pc: 2, r0: 1, r1: 1 } },
      { inputs: { i: 80 }, expect: { pc: 3, r0: 2, r1: 1 } },
      { inputs: { i: 96 }, expect: { pc: 4, r0: 2, r1: 3 } },
      { inputs: { i: 210 }, expect: { pc: 2, r0: 2, r1: 3 } },
      { inputs: { i: 80 }, expect: { pc: 3, r0: 5, r1: 3 } },
      { inputs: { i: 96 }, expect: { pc: 4, r0: 5, r1: 8 } },
      { inputs: { i: 210 }, expect: { pc: 2, r0: 5, r1: 8 } },
      { inputs: { i: 80 }, expect: { pc: 3, r0: 13, r1: 8 } },
      { inputs: { i: 96 }, expect: { pc: 4, r0: 13, r1: 5 } },
      { inputs: { i: 210 }, expect: { pc: 5, r0: 13, r1: 5 } },
      { inputs: { i: 81 }, expect: { pc: 6, r0: 8, r1: 5 } },
      { inputs: { i: 82 }, expect: { pc: 7, r0: 0, r1: 5 } },
      { inputs: { i: 83 }, expect: { pc: 8, r0: 5, r1: 5 } },
      { inputs: { i: 136 }, expect: { pc: 8, r0: 5, r1: 5 } },
      { inputs: { i: 136 }, expect: { pc: 8, r0: 5, r1: 5 } },
    ],
    par: 207,
    outro: {
      headline: 'It runs',
      body: 'Every part of that was built from the NAND gate you started with, and it just ran a loop. Real CPUs are the same idea, with wider numbers and more instructions.',
    },
  },
];

export const LEVELS_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}

export function nextLevel(id: string): Level | undefined {
  const i = levelIndex(id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}

/**
 * Every gate the campaign hands over, in unlock order.
 *
 * Walked out of LEVELS rather than written down, so it cannot drift from what
 * the grader actually permits. The completion card shows the whole list with
 * the unearned ones dimmed: a row that only grows tells you what you have, but
 * a row with gaps in it tells you there is more to come.
 */
export const ALL_GATES: string[] = (() => {
  const seen: string[] = [];
  for (const level of LEVELS) {
    for (const name of level.allowed) if (!seen.includes(name)) seen.push(name);
  }
  return seen;
})();

/**
 * Gates the player walks away from `level` holding that they did not have on
 * arrival: what the completion card announces as unlocked.
 *
 * Normally that is whatever the next level adds that no earlier level allowed.
 * Comparing with this level alone was right while the campaign was one line,
 * but the map branches now and the list does not: the counter is followed by
 * the multiplexer, and the counter's `Nand` and `DFlipFlop` against the
 * multiplexer's full gate set announced six gates the player has held since
 * the gate levels.
 *
 * The first level is the exception: its baseline is nothing at all, so the
 * gate it hands over is its own `allowed` set. Without that case the opening card claimed in prose to
 * have unlocked NAND while showing no unlock at all, which is the one card
 * every player sees.
 */
export function gatesGainedAfter(level: Level, next: Level | undefined): string[] {
  if (levelIndex(level.id) === 0) return level.allowed;
  if (!next) return [];
  const earlier = LEVELS.slice(0, levelIndex(next.id));
  return next.allowed.filter((name) => !earlier.some((l) => l.allowed.includes(name)));
}
