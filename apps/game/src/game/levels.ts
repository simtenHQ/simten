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
// Add it to the list:
//   n: Not,
//
// Then add n to the nodes in the connect function below:
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
      headline: 'You just used De Morgan',
      body: 'Not-a and not-b are both true only when everything is off. Deny that and you have OR.',
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
      body: 'Each gate makes the next one cheaper. XOR will not: it needs a shape you have not built yet.',
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
      body: 'Six gates out of the one you were given. None of them can leave this screen yet.',
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
    stub: `// Ports, not switches. Every gate you have built is available.
//
// \`inputs\` and \`outputs\` are the circuit's edges: what it looks like from
// the outside. Wire them with \`inputs.a.to(...)\` and \`....to(outputs.result)\`.

export default circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { result: bit },
  nodes: {
    //
  },
  connect: ({ inputs, outputs, nodes }) => [
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
      body: "Two NANDs, each reading the other's answer. That loop is what every memory is made of, but it has a state you were told to avoid, and the next level gets rid of it.",
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
      headline: 'A clock, and something that counts it',
      body: 'Nothing drives this but time. Flip a second one every time the first falls and you are counting in binary.',
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
      body: 'Memory holds the number and logic works out the next one. Widen it and that is every counter in every clock, every program counter in every CPU.',
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
 * Gates the player walks away from `level` holding that they did not have on
 * arrival: what the completion card announces as unlocked.
 *
 * Normally that is whatever the next level adds. The first level is the
 * exception: its baseline is nothing at all, so the gate it hands over is its
 * own `allowed` set. Without that case the opening card claimed in prose to
 * have unlocked NAND while showing no unlock at all, which is the one card
 * every player sees.
 */
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

export function gatesGainedAfter(level: Level, next: Level | undefined): string[] {
  if (levelIndex(level.id) === 0) return level.allowed;
  return next ? next.allowed.filter((name) => !level.allowed.includes(name)) : [];
}
