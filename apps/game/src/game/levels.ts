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
  nodes: { x1: Xor, a1: And, x2: Xor },
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
  nodes: { low: Mux2, high: Mux2, pick: Mux2 },
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
  nodes: { x1: Xor, a1: And },
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
  nodes: { h1: HalfAdder, h2: HalfAdder, o1: Or },
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

const ADDER4 = `const Adder4 = circuit('Adder4', {
  inputs: { a3: bit, a2: bit, a1: bit, a0: bit, b3: bit, b2: bit, b1: bit, b0: bit },
  outputs: { s3: bit, s2: bit, s1: bit, s0: bit, cout: bit },
  nodes: { add0: HalfAdder, add1: FullAdder, add2: FullAdder, add3: FullAdder },
  connect: ({ inputs, outputs, nodes: { add0, add1, add2, add3 } }) => [
    inputs.a0.to(add0.a),
    inputs.b0.to(add0.b),
    add0.sum.to(outputs.s0),
    add0.carry.to(add1.cin),
    inputs.a1.to(add1.a),
    inputs.b1.to(add1.b),
    add1.sum.to(outputs.s1),
    add1.cout.to(add2.cin),
    inputs.a2.to(add2.a),
    inputs.b2.to(add2.b),
    add2.sum.to(outputs.s2),
    add2.cout.to(add3.cin),
    inputs.a3.to(add3.a),
    inputs.b3.to(add3.b),
    add3.sum.to(outputs.s3),
    add3.cout.to(outputs.cout),
  ],
});`;

const SUBTRACT4 = `const Subtract4 = circuit('Subtract4', {
  inputs: { a3: bit, a2: bit, a1: bit, a0: bit, b3: bit, b2: bit, b1: bit, b0: bit },
  outputs: { d3: bit, d2: bit, d1: bit, d0: bit, borrow: bit },
  nodes: {
    na3: Not,
    na2: Not,
    na1: Not,
    na0: Not,
    add: Adder4,
    ns3: Not,
    ns2: Not,
    ns1: Not,
    ns0: Not,
  },
  connect: ({ inputs, outputs, nodes: { na3, na2, na1, na0, add, ns3, ns2, ns1, ns0 } }) => [
    inputs.a3.to(na3.in),
    inputs.a2.to(na2.in),
    inputs.a1.to(na1.in),
    inputs.a0.to(na0.in),
    na3.out.to(add.a3),
    na2.out.to(add.a2),
    na1.out.to(add.a1),
    na0.out.to(add.a0),
    inputs.b3.to(add.b3),
    inputs.b2.to(add.b2),
    inputs.b1.to(add.b1),
    inputs.b0.to(add.b0),
    add.s3.to(ns3.in),
    add.s2.to(ns2.in),
    add.s1.to(ns1.in),
    add.s0.to(ns0.in),
    ns3.out.to(outputs.d3),
    ns2.out.to(outputs.d2),
    ns1.out.to(outputs.d1),
    ns0.out.to(outputs.d0),
    add.cout.to(outputs.borrow),
  ],
});`;

const REGISTER_BIT = `const RegisterBit = circuit('RegisterBit', {
  inputs: { load: bit, d: bit },
  outputs: { q: bit },
  nodes: { ff: DFlipFlop(), x1: Xor, a1: And, x2: Xor },
  connect: ({ inputs, outputs, nodes: { ff, x1, a1, x2 } }) => [
    ff.q.to(x1.a, x2.a, outputs.q),
    inputs.d.to(x1.b),
    x1.out.to(a1.a),
    inputs.load.to(a1.b),
    a1.out.to(x2.b),
    x2.out.to(ff.d),
  ],
});`;

const REGISTER4 = `const Register4 = circuit('Register4', {
  inputs: { load: bit, d3: bit, d2: bit, d1: bit, d0: bit },
  outputs: { q3: bit, q2: bit, q1: bit, q0: bit },
  nodes: { b3: RegisterBit, b2: RegisterBit, b1: RegisterBit, b0: RegisterBit },
  connect: ({ inputs, outputs, nodes: { b3, b2, b1, b0 } }) => [
    inputs.load.to(b3.load, b2.load, b1.load, b0.load),
    inputs.d3.to(b3.d),
    inputs.d2.to(b2.d),
    inputs.d1.to(b1.d),
    inputs.d0.to(b0.d),
    b3.q.to(outputs.q3),
    b2.q.to(outputs.q2),
    b1.q.to(outputs.q1),
    b0.q.to(outputs.q0),
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
    stub: `export default circuit('Or1', {
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
    id: 'latch',
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

  // The combinational column. Appended after the counter rather than slotted in
  // beside the arithmetic levels, so every existing level keeps its number.
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
    id: 'majority',
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
    id: 'wide-gates',
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
    id: 'equal',
    title: 'Equality',
    tagline: 'Light the led when two 4-bit numbers are the same.',
    brief: 'Light `eq` when `a3 a2 a1 a0` and `b3 b2 b1 b0` are the same number',
    target: 'Equal4',
    inputs: ['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0'],
    outputs: ['eq'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', b: 'unsigned' },
    stub: `// Two numbers are the same when every bit matches the bit
// in the same place in the other one.

export default circuit('Equal4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    eq: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, eq } }) => [
    //
  ],
});
`,
    // Four equal pairs, then pairs that differ in exactly one bit, each
    // position twice, so a bit left out of the comparison gets caught.
    vectors: [
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 0 }, expect: { eq: 1 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 1, b0: 1 }, expect: { eq: 1 } },
      { inputs: { a3: 1, a2: 0, a1: 0, a0: 1, b3: 1, b2: 0, b1: 0, b0: 1 }, expect: { eq: 1 } },
      { inputs: { a3: 0, a2: 1, a1: 1, a0: 0, b3: 0, b2: 1, b1: 1, b0: 0 }, expect: { eq: 1 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 }, expect: { eq: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 1, b0: 0 }, expect: { eq: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 1, b1: 0, b0: 0 }, expect: { eq: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 1, b2: 0, b1: 0, b0: 0 }, expect: { eq: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 1, b0: 0 }, expect: { eq: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 0, b0: 1 }, expect: { eq: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 0, b1: 1, b0: 1 }, expect: { eq: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 1, b1: 1, b0: 1 }, expect: { eq: 0 } },
    ],
    par: 7,
    outro: {
      headline: 'Bit for bit',
      body: 'Most CPUs get this from subtraction instead: subtract one number from the other and check that every bit of the result is 0.',
    },
  },

  {
    id: 'decoder',
    title: 'Decoder',
    tagline: 'Turn a 2-bit number into one of four lines.',
    brief: 'Light exactly one of `y0` to `y3`, the one numbered by `a1 a0` read as binary',
    target: 'Decoder2',
    inputs: ['a1', 'a0'],
    outputs: ['y0', 'y1', 'y2', 'y3'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned' },
    stub: `// a1 is worth 2 and a0 is worth 1, so a1 on and a0 off is
// the number 2, and only y2 should light.

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
      body: 'Memory uses one of these to pick a cell, and a CPU to pick a register. Par is one gate per output. If y1 and y2 cost more, try using y0.',
    },
  },

  {
    id: 'mux-4',
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

${MUX2}

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
    id: 'adder-4',
    title: '4-Bit Adder',
    tagline: 'Add two 4-bit numbers.',
    brief:
      'Add `a3 a2 a1 a0` to `b3 b2 b1 b0`. The sum goes on `s3` to `s0`, and anything too big for four bits lights `cout`',
    target: 'Adder4',
    inputs: ['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0'],
    outputs: ['s3', 's2', 's1', 's0', 'cout'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', b: 'unsigned', s: 'unsigned' },
    stub: `// Your half adder and full adder, finished, with ports.

${HALF_ADDER}

${FULL_ADDER}

// One adder per bit, the same way you add on paper: start at
// bit 0 and carry into the next column. Nothing carries into
// bit 0, so it does not need a full adder.

export default circuit('Adder4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    s3: Led,
    s2: Led,
    s1: Led,
    s0: Led,
    cout: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, s3, s2, s1, s0, cout } }) => [
    //
  ],
});
`,
    // 12 of the 256 sums, picked so every carry gets used: 15 + 1 ripples
    // through all four bits, and 15 + 15 overflows with every bit set.
    vectors: [
      {
        inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 0 },
        expect: { s3: 0, s2: 0, s1: 0, s0: 0, cout: 0 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 0, a0: 1, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { s3: 0, s2: 0, s1: 1, s0: 0, cout: 0 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { s3: 1, s2: 0, s1: 0, s0: 0, cout: 0 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 1, a0: 1, b3: 1, b2: 0, b1: 0, b0: 0 },
        expect: { s3: 1, s2: 1, s1: 1, s0: 1, cout: 0 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { s3: 0, s2: 0, s1: 0, s0: 0, cout: 1 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 1, b0: 1 },
        expect: { s3: 1, s2: 1, s1: 1, s0: 0, cout: 1 },
      },
      {
        inputs: { a3: 1, a2: 0, a1: 0, a0: 0, b3: 1, b2: 0, b1: 0, b0: 0 },
        expect: { s3: 0, s2: 0, s1: 0, s0: 0, cout: 1 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 1, a0: 0, b3: 1, b2: 0, b1: 0, b0: 1 },
        expect: { s3: 1, s2: 1, s1: 1, s0: 1, cout: 0 },
      },
      {
        inputs: { a3: 1, a2: 0, a1: 1, a0: 0, b3: 0, b2: 1, b1: 0, b0: 1 },
        expect: { s3: 1, s2: 1, s1: 1, s0: 1, cout: 0 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 1, a0: 1, b3: 1, b2: 1, b1: 0, b0: 1 },
        expect: { s3: 0, s2: 0, s1: 0, s0: 0, cout: 1 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 1, a0: 1, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { s3: 1, s2: 0, s1: 0, s0: 0, cout: 0 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 0, a0: 0, b3: 0, b2: 1, b1: 0, b0: 0 },
        expect: { s3: 0, s2: 0, s1: 0, s0: 0, cout: 1 },
      },
    ],
    par: 17,
    outro: {
      headline: 'Ripple carry',
      body: 'Each bit waits for the carry from the one below. Real CPUs spend extra gates working the carries out early, because waiting on 64 of them is slow.',
    },
  },

  {
    id: 'negate',
    title: 'Negative Numbers',
    tagline: 'Turn a number into its negative.',
    brief: "Put the negative of `a3 a2 a1 a0` on `n3` to `n0`, in two's complement",
    target: 'Negate4',
    inputs: ['a3', 'a2', 'a1', 'a0'],
    outputs: ['n3', 'n2', 'n1', 'n0'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', n: 'signed' },
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
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    n3: Led,
    n2: Led,
    n1: Led,
    n0: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, n3, n2, n1, n0 } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0 }, expect: { n3: 0, n2: 0, n1: 0, n0: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 1 }, expect: { n3: 1, n2: 1, n1: 1, n0: 1 } },
      { inputs: { a3: 0, a2: 0, a1: 1, a0: 0 }, expect: { n3: 1, n2: 1, n1: 1, n0: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 1, a0: 1 }, expect: { n3: 1, n2: 1, n1: 0, n0: 1 } },
      { inputs: { a3: 0, a2: 1, a1: 0, a0: 0 }, expect: { n3: 1, n2: 1, n1: 0, n0: 0 } },
      { inputs: { a3: 0, a2: 1, a1: 0, a0: 1 }, expect: { n3: 1, n2: 0, n1: 1, n0: 1 } },
      { inputs: { a3: 0, a2: 1, a1: 1, a0: 0 }, expect: { n3: 1, n2: 0, n1: 1, n0: 0 } },
      { inputs: { a3: 0, a2: 1, a1: 1, a0: 1 }, expect: { n3: 1, n2: 0, n1: 0, n0: 1 } },
      { inputs: { a3: 1, a2: 0, a1: 0, a0: 0 }, expect: { n3: 1, n2: 0, n1: 0, n0: 0 } },
      { inputs: { a3: 1, a2: 0, a1: 0, a0: 1 }, expect: { n3: 0, n2: 1, n1: 1, n0: 1 } },
      { inputs: { a3: 1, a2: 0, a1: 1, a0: 0 }, expect: { n3: 0, n2: 1, n1: 1, n0: 0 } },
      { inputs: { a3: 1, a2: 0, a1: 1, a0: 1 }, expect: { n3: 0, n2: 1, n1: 0, n0: 1 } },
      { inputs: { a3: 1, a2: 1, a1: 0, a0: 0 }, expect: { n3: 0, n2: 1, n1: 0, n0: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 0, a0: 1 }, expect: { n3: 0, n2: 0, n1: 1, n0: 1 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 0 }, expect: { n3: 0, n2: 0, n1: 1, n0: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1 }, expect: { n3: 0, n2: 0, n1: 0, n0: 1 } },
    ],
    par: 5,
    outro: {
      headline: 'Negatives that add',
      body: '5 + 13 is 18, which wraps to 2, the same as 5 - 3. So an adder can subtract, which is next.',
    },
  },

  {
    id: 'subtract',
    title: 'Subtractor',
    tagline: 'Take one 4-bit number away from another.',
    brief: 'Put `a - b` on `d3` to `d0`, and light `borrow` when `b` is bigger than `a`',
    target: 'Subtract4',
    inputs: ['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0'],
    outputs: ['d3', 'd2', 'd1', 'd0', 'borrow'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', b: 'unsigned', d: 'signed' },
    stub: `// Your 4-bit adder, finished, with the parts it is made of.

${HALF_ADDER}

${FULL_ADDER}

${ADDER4}

// a - b is a plus the negative of b. You could negate b and add,
// but then cout would not tell you when b was the bigger one.
// Flipping both ends works out better: NOT every bit of a, add
// b, then NOT every bit of the sum. Try 5 - 3 on paper.
//
// Done that way, cout comes on exactly when b is bigger than a,
// so it is your borrow with no gate needed.

export default circuit('Subtract4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    d3: Led,
    d2: Led,
    d1: Led,
    d0: Led,
    borrow: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, d3, d2, d1, d0, borrow } }) => [
    //
  ],
});
`,
    // Includes a below b (borrow set), a equal to b (zero), and 0 - 1.
    vectors: [
      {
        inputs: { a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { d3: 0, d2: 0, d1: 1, d0: 0, borrow: 0 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 1, a0: 1, b3: 0, b2: 1, b1: 0, b0: 1 },
        expect: { d3: 1, d2: 1, d1: 1, d0: 0, borrow: 1 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 1, a0: 1, b3: 0, b2: 1, b1: 1, b0: 1 },
        expect: { d3: 0, d2: 0, d1: 0, d0: 0, borrow: 0 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { d3: 1, d2: 1, d1: 1, d0: 1, borrow: 1 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 0 },
        expect: { d3: 0, d2: 0, d1: 0, d0: 0, borrow: 0 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 1, b0: 1 },
        expect: { d3: 0, d2: 0, d1: 0, d0: 0, borrow: 0 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 0, b1: 0, b0: 0 },
        expect: { d3: 1, d2: 1, d1: 1, d0: 1, borrow: 0 },
      },
      {
        inputs: { a3: 1, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { d3: 0, d2: 1, d1: 1, d0: 1, borrow: 0 },
      },
      {
        inputs: { a3: 0, a2: 0, a1: 0, a0: 1, b3: 1, b2: 0, b1: 0, b0: 0 },
        expect: { d3: 1, d2: 0, d1: 0, d0: 1, borrow: 1 },
      },
      {
        inputs: { a3: 1, a2: 1, a1: 0, a0: 0, b3: 0, b2: 1, b1: 0, b0: 0 },
        expect: { d3: 1, d2: 0, d1: 0, d0: 0, borrow: 0 },
      },
      {
        inputs: { a3: 1, a2: 0, a1: 0, a0: 1, b3: 0, b2: 1, b1: 1, b0: 0 },
        expect: { d3: 0, d2: 0, d1: 1, d0: 1, borrow: 0 },
      },
      {
        inputs: { a3: 0, a2: 1, a1: 1, a0: 0, b3: 1, b2: 1, b1: 0, b0: 1 },
        expect: { d3: 1, d2: 0, d1: 0, d0: 1, borrow: 1 },
      },
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
    brief: 'Light `lt` when `a3 a2 a1 a0` is smaller than `b3 b2 b1 b0`',
    target: 'LessThan4',
    inputs: ['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0'],
    outputs: ['lt'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', b: 'unsigned' },
    stub: `// Your subtractor, finished, with the parts it is made of.

${HALF_ADDER}

${FULL_ADDER}

${ADDER4}

${SUBTRACT4}

// Both numbers run from 0 to 15 here, no negatives. You already
// have something that knows when b is bigger than a.

export default circuit('LessThan4', {
  nodes: {
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    lt: Led,
  },
  connect: ({ nodes: { a3, a2, a1, a0, b3, b2, b1, b0, lt } }) => [
    //
  ],
});
`,
    // Includes a equal to b, a one below b, and 0 and 15 at both ends.
    vectors: [
      { inputs: { a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 1, b1: 0, b0: 1 }, expect: { lt: 0 } },
      { inputs: { a3: 0, a2: 1, a1: 0, a0: 0, b3: 0, b2: 1, b1: 0, b0: 1 }, expect: { lt: 1 } },
      { inputs: { a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 1, b1: 0, b0: 0 }, expect: { lt: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 0 }, expect: { lt: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 1, b2: 1, b1: 1, b0: 1 }, expect: { lt: 1 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 0, b1: 0, b0: 0 }, expect: { lt: 0 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 1, b3: 1, b2: 1, b1: 1, b0: 1 }, expect: { lt: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 }, expect: { lt: 1 } },
      { inputs: { a3: 1, a2: 1, a1: 1, a0: 0, b3: 1, b2: 1, b1: 1, b0: 1 }, expect: { lt: 1 } },
      { inputs: { a3: 0, a2: 1, a1: 1, a0: 1, b3: 1, b2: 0, b1: 0, b0: 0 }, expect: { lt: 1 } },
      { inputs: { a3: 1, a2: 0, a1: 0, a0: 0, b3: 0, b2: 1, b1: 1, b0: 1 }, expect: { lt: 0 } },
      { inputs: { a3: 0, a2: 0, a1: 1, a0: 1, b3: 1, b2: 0, b1: 1, b0: 0 }, expect: { lt: 1 } },
    ],
    par: 25,
    outro: {
      headline: 'Less than, from a borrow',
      body: 'CPUs compare by subtracting and keeping only the flags. The difference bits go nowhere here, so there are gates to save.',
    },
  },

  {
    id: 'alu-4',
    title: 'Arithmetic Logic Unit',
    tagline: 'One circuit that adds, subtracts, ANDs or ORs.',
    brief:
      'Put the result of the operation `op1 op0` picks on `r3` to `r0`: 00 is a + b, 01 is a - b, 10 is a AND b, and 11 is a OR b, bit by bit',
    target: 'Alu4',
    inputs: ['op1', 'op0', 'a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0'],
    outputs: ['r3', 'r2', 'r1', 'r0'],
    allowed: ARITHMETIC_GATES,
    numbers: { a: 'unsigned', b: 'unsigned', r: 'unsigned' },
    stub: `// Everything you need is below, finished: your multiplexers,
// your adder and your subtractor.

${MUX2}

${MUX4}

${HALF_ADDER}

${FULL_ADDER}

${ADDER4}

${SUBTRACT4}

// Work out all four answers at once, whatever op says. Then,
// for each output bit, let op1 op0 pick which answer it shows.

export default circuit('Alu4', {
  nodes: {
    op1: Switch,
    op0: Switch,
    a3: Switch,
    a2: Switch,
    a1: Switch,
    a0: Switch,
    b3: Switch,
    b2: Switch,
    b1: Switch,
    b0: Switch,
    r3: Led,
    r2: Led,
    r1: Led,
    r0: Led,
  },
  connect: ({ nodes: { op1, op0, a3, a2, a1, a0, b3, b2, b1, b0, r3, r2, r1, r0 } }) => [
    //
  ],
});
`,
    // Four per operation. 12 and 10, and 5 and 3, appear under every op, so a
    // circuit that ignores op, or swaps two of them, gets caught.
    vectors: [
      {
        inputs: { op1: 0, op0: 0, a3: 1, a2: 1, a1: 0, a0: 0, b3: 1, b2: 0, b1: 1, b0: 0 },
        expect: { r3: 0, r2: 1, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 0, a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { r3: 1, r2: 0, r1: 0, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 0, a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { r3: 0, r2: 0, r1: 0, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 0, a3: 1, a2: 0, a1: 0, a0: 1, b3: 1, b2: 0, b1: 0, b0: 1 },
        expect: { r3: 0, r2: 0, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 1, a3: 1, a2: 1, a1: 0, a0: 0, b3: 1, b2: 0, b1: 1, b0: 0 },
        expect: { r3: 0, r2: 0, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 1, a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { r3: 0, r2: 0, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 1, a3: 0, a2: 0, a1: 1, a0: 1, b3: 0, b2: 1, b1: 0, b0: 1 },
        expect: { r3: 1, r2: 1, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 0, op0: 1, a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { r3: 1, r2: 1, r1: 1, r0: 1 },
      },
      {
        inputs: { op1: 1, op0: 0, a3: 1, a2: 1, a1: 0, a0: 0, b3: 1, b2: 0, b1: 1, b0: 0 },
        expect: { r3: 1, r2: 0, r1: 0, r0: 0 },
      },
      {
        inputs: { op1: 1, op0: 0, a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { r3: 0, r2: 0, r1: 0, r0: 1 },
      },
      {
        inputs: { op1: 1, op0: 0, a3: 1, a2: 1, a1: 1, a0: 1, b3: 0, b2: 1, b1: 1, b0: 0 },
        expect: { r3: 0, r2: 1, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 1, op0: 0, a3: 1, a2: 0, a1: 0, a0: 1, b3: 0, b2: 1, b1: 1, b0: 0 },
        expect: { r3: 0, r2: 0, r1: 0, r0: 0 },
      },
      {
        inputs: { op1: 1, op0: 1, a3: 1, a2: 1, a1: 0, a0: 0, b3: 1, b2: 0, b1: 1, b0: 0 },
        expect: { r3: 1, r2: 1, r1: 1, r0: 0 },
      },
      {
        inputs: { op1: 1, op0: 1, a3: 0, a2: 1, a1: 0, a0: 1, b3: 0, b2: 0, b1: 1, b0: 1 },
        expect: { r3: 0, r2: 1, r1: 1, r0: 1 },
      },
      {
        inputs: { op1: 1, op0: 1, a3: 0, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 0 },
        expect: { r3: 0, r2: 0, r1: 0, r0: 0 },
      },
      {
        inputs: { op1: 1, op0: 1, a3: 1, a2: 0, a1: 0, a0: 0, b3: 0, b2: 0, b1: 0, b0: 1 },
        expect: { r3: 1, r2: 0, r1: 0, r0: 1 },
      },
    ],
    par: 86,
    outro: {
      headline: 'An ALU',
      body: 'Every CPU has one of these. Add registers and a counter to step through a program and you have most of a computer.',
    },
  },

  {
    id: 'register',
    title: 'Register',
    tagline: 'Hold four bits until you are told to change them.',
    brief:
      'Show the stored number on `q3` to `q0`. On each tick, store `d3` to `d0` if `load` is on, and keep the old number if it is off',
    target: 'Register4',
    inputs: ['load', 'd3', 'd2', 'd1', 'd0'],
    outputs: ['q3', 'q2', 'q1', 'q0'],
    allowed: MEMORY_GATES,
    numbers: { d: 'unsigned', q: 'unsigned' },
    sequential: true,
    stub: `// One flip-flop per bit. A flip-flop stores whatever is on
// its d input every tick, so to keep a bit, feed it its own q.
// To load, feed it the new bit instead. load picks which,
// the same job your multiplexer did.

export default circuit('Register4', {
  nodes: {
    load: Switch,
    d3: Switch,
    d2: Switch,
    d1: Switch,
    d0: Switch,
    q3: Led,
    q2: Led,
    q1: Led,
    q0: Led,
  },
  connect: ({ nodes: { load, d3, d2, d1, d0, q3, q2, q1, q0 } }) => [
    //
  ],
});
`,
    // Ordered steps. Steps 2 and 10 carry the same inputs and expect different
    // numbers, and so do 5 and 8: what comes out depends on what was stored.
    vectors: [
      { inputs: { load: 1, d3: 0, d2: 1, d1: 0, d0: 1 }, expect: { q3: 0, q2: 1, q1: 0, q0: 1 } },
      { inputs: { load: 0, d3: 1, d2: 0, d1: 1, d0: 0 }, expect: { q3: 0, q2: 1, q1: 0, q0: 1 } },
      { inputs: { load: 0, d3: 0, d2: 0, d1: 0, d0: 0 }, expect: { q3: 0, q2: 1, q1: 0, q0: 1 } },
      { inputs: { load: 1, d3: 1, d2: 0, d1: 1, d0: 0 }, expect: { q3: 1, q2: 0, q1: 1, q0: 0 } },
      { inputs: { load: 0, d3: 0, d2: 1, d1: 0, d0: 1 }, expect: { q3: 1, q2: 0, q1: 1, q0: 0 } },
      { inputs: { load: 0, d3: 1, d2: 1, d1: 1, d0: 1 }, expect: { q3: 1, q2: 0, q1: 1, q0: 0 } },
      { inputs: { load: 1, d3: 1, d2: 1, d1: 1, d0: 1 }, expect: { q3: 1, q2: 1, q1: 1, q0: 1 } },
      { inputs: { load: 0, d3: 0, d2: 1, d1: 0, d0: 1 }, expect: { q3: 1, q2: 1, q1: 1, q0: 1 } },
      { inputs: { load: 1, d3: 0, d2: 0, d1: 0, d0: 0 }, expect: { q3: 0, q2: 0, q1: 0, q0: 0 } },
      { inputs: { load: 0, d3: 1, d2: 0, d1: 1, d0: 0 }, expect: { q3: 0, q2: 0, q1: 0, q0: 0 } },
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
    tagline: 'Two registers, and a choice of which to read and write.',
    brief:
      'When `write` is on, store `d3` to `d0` in the register `wsel` picks. Show the register `rsel` picks on `q3` to `q0`',
    target: 'RegFile2',
    inputs: ['write', 'wsel', 'rsel', 'd3', 'd2', 'd1', 'd0'],
    outputs: ['q3', 'q2', 'q1', 'q0'],
    allowed: MEMORY_GATES,
    numbers: { d: 'unsigned', q: 'unsigned' },
    sequential: true,
    stub: `// Your register, finished, with ports.

${REGISTER_BIT}

${REGISTER4}

// Two of them, numbered 0 and 1. Each needs its own load line,
// on only when write is on and wsel names it. Then pick which
// one reaches q3 to q0 with rsel.

export default circuit('RegFile2', {
  nodes: {
    write: Switch,
    wsel: Switch,
    rsel: Switch,
    d3: Switch,
    d2: Switch,
    d1: Switch,
    d0: Switch,
    q3: Led,
    q2: Led,
    q1: Led,
    q0: Led,
  },
  connect: ({ nodes: { write, wsel, rsel, d3, d2, d1, d0, q3, q2, q1, q0 } }) => [
    //
  ],
});
`,
    // Ordered steps. Steps 4, 6 and 12 carry the same inputs, reading register
    // 0 each time, and expect 5, then 3, then 9 as it gets overwritten.
    vectors: [
      {
        inputs: { write: 1, wsel: 0, rsel: 0, d3: 0, d2: 1, d1: 0, d0: 1 },
        expect: { q3: 0, q2: 1, q1: 0, q0: 1 },
      },
      {
        inputs: { write: 1, wsel: 1, rsel: 0, d3: 1, d2: 0, d1: 1, d0: 0 },
        expect: { q3: 0, q2: 1, q1: 0, q0: 1 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 1, d3: 0, d2: 0, d1: 0, d0: 0 },
        expect: { q3: 1, q2: 0, q1: 1, q0: 0 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 0, d3: 0, d2: 0, d1: 0, d0: 0 },
        expect: { q3: 0, q2: 1, q1: 0, q0: 1 },
      },
      {
        inputs: { write: 1, wsel: 0, rsel: 1, d3: 0, d2: 0, d1: 1, d0: 1 },
        expect: { q3: 1, q2: 0, q1: 1, q0: 0 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 0, d3: 0, d2: 0, d1: 0, d0: 0 },
        expect: { q3: 0, q2: 0, q1: 1, q0: 1 },
      },
      {
        inputs: { write: 0, wsel: 1, rsel: 1, d3: 1, d2: 1, d1: 1, d0: 1 },
        expect: { q3: 1, q2: 0, q1: 1, q0: 0 },
      },
      {
        inputs: { write: 1, wsel: 1, rsel: 1, d3: 1, d2: 1, d1: 0, d0: 0 },
        expect: { q3: 1, q2: 1, q1: 0, q0: 0 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 0, d3: 1, d2: 1, d1: 0, d0: 0 },
        expect: { q3: 0, q2: 0, q1: 1, q0: 1 },
      },
      {
        inputs: { write: 1, wsel: 0, rsel: 0, d3: 1, d2: 0, d1: 0, d0: 1 },
        expect: { q3: 1, q2: 0, q1: 0, q0: 1 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 1, d3: 0, d2: 0, d1: 0, d0: 0 },
        expect: { q3: 1, q2: 1, q1: 0, q0: 0 },
      },
      {
        inputs: { write: 0, wsel: 0, rsel: 0, d3: 0, d2: 0, d1: 0, d0: 0 },
        expect: { q3: 1, q2: 0, q1: 0, q0: 1 },
      },
    ],
    par: 46,
    outro: {
      headline: 'A set of registers',
      body: "Real CPUs have more: the 6502 has three and a RISC-V core has 32. With four, you'd pick which to write with your decoder and which to read with your four-way multiplexer.",
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
