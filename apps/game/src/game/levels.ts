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
 * is also the gate to composition — a self-contained circuit cannot be reused,
 * so nothing later can build on your XOR until you have wrapped it.
 *
 * The middle of the act follows NAND → NOT → AND → OR → NOR → XOR → XNOR. Each
 * gate is reachable from the one before it, so the act reads as a single line
 * of reasoning rather than seven unrelated puzzles, and OR lands De Morgan in
 * the middle where there is enough behind it for the trick to mean something.
 *
 * Stubs taper. Level 1 is everything-but-one-line because its job is to explain
 * the `connect` destructuring, which is the hardest thing in the DSL to read
 * cold. Levels 2 and 3 still place a NAND and wire one side of it. From level 4
 * the `nodes` are the player's to choose — handing them the right number of
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
      body: 'You built NOT out of nothing but NAND. Every other gate works the same way. AND is next, and it takes two of them.',
    },
  },

  {
    id: 'and-from-nand',
    title: 'AND from NAND',
    brief:
      'A NAND is an AND gate with its answer flipped. You spent the last level learning to flip an answer. Light the lamp only when both switches are on.',
    target: 'And2',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// The NAND already sees both switches. Its answer
// is the one you want, upside down.
//
// You need a second gate, so add one to the list:
//   n2: Nand,
//
// Anything you add to \`nodes\` has to be named in the
// \`connect\` line below before you can wire it.

export default circuit('And2', {
  nodes: {
    a: Switch,
    b: Switch,
    n1: Nand,
    out: Led,
  },
  connect: ({ nodes: { a, b, n1, out } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    //
  ],
});
`,
    vectors: [
      { inputs: { a: 0, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 1 } },
    ],
    par: 2,
    outro: {
      headline: 'AND, rebuilt',
      body: 'A NAND and the NOT you worked out last level. The gate you were handed in level one, this time made of parts. OR will not come this directly.',
    },
  },

  {
    id: 'or-from-nand',
    title: 'OR from NAND',
    brief:
      'Light the lamp when either switch is on. There is no way to get there by flipping a NAND, so come at it from the other end: work out when the lamp should stay off.',
    target: 'Or1',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// The lamp is off in exactly one case: both switches down.
//
// A NAND says "not both". Stop feeding it the switches
// and feed it their opposites instead, then read what
// comes out.
//
// You know how to make an opposite. You did it two
// levels ago.

export default circuit('Or1', {
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
      { inputs: { a: 1, b: 1 }, expect: { out: 1 } },
    ],
    par: 3,
    outro: {
      headline: 'You just used De Morgan',
      body: 'Not-a and not-b are both true only when everything is off, so denying that gives you OR. Swapping a gate for its opposite with the inputs flipped is a trick that keeps working, and the next level is the easy version of it.',
    },
  },

  {
    id: 'nor-from-nand',
    title: 'NOR from NAND',
    brief:
      'NOR is OR with the answer flipped: the lamp is on only when both switches are off. You built OR a minute ago, so most of this is already done.',
    target: 'Nor1',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// Nothing new here. Build the OR you already
// worked out, then flip what comes out of it.
//
// Four NANDs is the target.

export default circuit('Nor1', {
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
      { inputs: { a: 0, b: 0 }, expect: { out: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 0 } },
    ],
    par: 4,
    outro: {
      headline: 'Four gates deep',
      body: 'Every gate you finish makes the next one cheaper, because you stop solving it from scratch and start bolting a NOT onto something that already works. XOR does not give you that. It needs a shape you have not built yet.',
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
      body: "That's the gate an adder is built from, so you'll be reaching for it again. One left in the set, and it is XOR with the answer flipped.",
    },
  },

  {
    id: 'xnor-from-nand',
    title: 'XNOR from NAND',
    brief:
      'The last gate in the set, and the opposite of the one you just built: light the lamp when the two switches agree. You already know the move.',
    target: 'Xnor1',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand'],
    stub: `// Your XOR, with the answer flipped.
//
// Five NANDs. Nothing here is new — this level is
// the one where you find out how much of the last
// six you actually kept.

export default circuit('Xnor1', {
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
      { inputs: { a: 0, b: 0 }, expect: { out: 1 } },
      { inputs: { a: 0, b: 1 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 0 }, expect: { out: 0 } },
      { inputs: { a: 1, b: 1 }, expect: { out: 1 } },
    ],
    par: 5,
    outro: {
      headline: 'Every gate, from one gate',
      body: 'NOT, AND, OR, NOR, XOR, XNOR. Six gates out of the only one you were given. What you cannot do yet is use any of them again: each one is sealed inside the level that built it. That is what the last level fixes.',
    },
  },

  {
    id: 'half-adder',
    title: 'Making a Component',
    brief:
      'The XOR from two levels back, but this time give the circuit `inputs` and `outputs` instead of switches and a lamp. Watch what happens to the diagram: it becomes one box. That is the trade — you can no longer see inside, and in exchange anything can now use it.',
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
