/**
 * The campaign, in order.
 *
 * Levels 1–3 are self-contained: a `Switch` for each input, an `Led` for each
 * output, and the player's gates in between. Nothing is a port, so the canvas
 * draws exactly what they wrote and the switches are theirs to click. There is
 * no interface concept to explain before the first gate.
 *
 * Level 4 introduces ports, and the black box that comes with them is the
 * lesson rather than a wart: your circuit collapses into a single component
 * precisely because its insides have stopped being anyone else's problem. It
 * is also the gate to composition — a self-contained circuit cannot be reused,
 * so nothing later can build on your XOR until you have wrapped it.
 *
 * Stubs taper. Level 1 is everything-but-one-line because its job is to explain
 * the `connect` destructuring, which is the hardest thing in the DSL to read
 * cold. From level 2 the `nodes` are the player's to choose — handing them four
 * NANDs would give away both the answer and the point of `par`.
 */

import type { Level } from './types';

export const LEVELS: Level[] = [
  {
    id: 'first-wire',
    title: 'First Wire',
    brief:
      'This circuit is finished apart from one connection: nothing carries the gate’s result to the lamp. Add that line, then flip the switches.',
    target: 'And1',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['And'],
    stub: `// A circuit is a set of nodes and the wires between them.
// \`x.to(y)\` sends the value at x into y.
//
// Everything here is a node — the switches and the lamp too. This one is
// done except for the last wire: the AND gate has its answer, but nothing
// carries it to the lamp.

export default circuit('And1', {
  nodes: {
    a: Switch,
    b: Switch,
    and1: And,
    out: Led,
  },
  connect: ({ nodes: { a, b, and1, out } }) => [
    a.out.to(and1.a),
    b.out.to(and1.b),
    // One more line. Send and1.out to out.in
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 1 } },
    ],
    par: 1,
    outro: {
      headline: "That's a circuit",
      body: 'Two switches, a gate, and a lamp. Everything from here is that same idea repeated. Next you lose the AND gate: you get one gate from now on and build the rest yourself.',
    },
  },

  {
    id: 'not-from-nand',
    title: 'NOT from NAND',
    brief:
      'From here you get one gate: NAND, which outputs 0 only when both its inputs are 1. Every other gate gets built from it. Start with the simplest — turn a 1 into a 0.',
    target: 'Not1',
    inputs: ['a'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// One gate from here on: NAND.
// It outputs 0 only when both inputs are 1.
//
// The NAND is placed, and its output already
// runs to the lamp. What is missing is the input.
//
// Hint: it has two inputs. Nothing says they
// have to come from different places.

export default circuit('Not1', {
  nodes: {
    a: Switch,
    n1: Nand,
    out: Led,
  },
  connect: ({ nodes: { a, n1, out } }) => [
    n1.out.to(out.in),
  ],
});
`,
    vectors: [
      { inputs: { a: 0 }, expect: { out: 1 } },
      { inputs: { a: 1 }, expect: { out: 0 } },
    ],
    par: 1,
    outro: {
      headline: 'One gate down',
      body: 'You built NOT out of nothing but NAND. Every other gate works the same way. XOR is next, and it takes four of them.',
    },
  },

  {
    id: 'xor-from-nand',
    title: 'XOR from NAND',
    brief:
      'Light the lamp when the two switches disagree. This is the one that takes a minute — and it is the gate an adder is built from, so it pays off twice.',
    target: 'Xor1',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// Work out how many NANDs this needs. Fewer is better.
//
// A signal can drive more than one port:
//   a.out.to(n1.a, n2.a)

export default circuit('Xor1', {
  nodes: {
    a: Switch,
    b: Switch,
    out: Led,
  },
  connect: ({ nodes: { a, b, out } }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 0 } },
    ],
    par: 4,
    outro: {
      headline: 'Four NANDs, one XOR',
      body: "That's the gate an adder is built from, so you'll be reaching for it again. Next you wrap it up so other circuits can use it without seeing inside.",
    },
  },

  {
    id: 'half-adder',
    title: 'Making a Component',
    brief:
      'Same XOR, but this time give the circuit `inputs` and `outputs` instead of switches and a lamp. Watch what happens to the diagram: it becomes one box. That is the trade — you can no longer see inside, and in exchange anything can now use it.',
    target: 'Xor2',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// Ports, not switches.
//
// \`inputs\` and \`outputs\` are the circuit's edges — what it looks like from
// the outside. Wire them with \`inputs.a.to(...)\` and \`....to(outputs.out)\`.
//
// The canvas will collapse this into a single box with a switch and a lamp
// attached. That is the point: it is a component now, and a component is
// something other circuits can use without knowing how it works.

export default circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: {
    //
  },
  connect: ({ inputs, outputs, nodes }) => [
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 1 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 0 } },
    ],
    par: 4,
    outro: {
      headline: "It's a component now",
      body: 'Ports instead of switches, and the diagram collapsed into one box. That is what lets circuits build on each other, which is where this goes next.',
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
