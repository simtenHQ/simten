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
 *
 * Level 1 is a NAND rather than a friendlier AND, even though its lesson is
 * pure syntax. "You get one gate" has to be true from the first screen: handing
 * over an AND and withdrawing it a level later reads as a confiscation, and it
 * made the completion card announce NAND as an unlock when it was really a
 * swap. Nothing is reasoned about here anyway — you add one wire and click —
 * so the player meets NAND by watching it, which is exactly the setup level 2
 * needs.
 */

import type { Level } from './types';

/**
 * What the arithmetic band may use.
 *
 * Every gate the player built from NAND, handed back once they have proved they
 * can make it. This is the first time `allowed` grows, which is what makes the
 * completion card's unlock line fire — it is derived from exactly this
 * difference, so it can never promise something the grader would reject.
 *
 * The honest version of this is reusing the circuits they actually wrote, which
 * needs composition. Until then the stdlib equivalents stand in: same logic,
 * same gate counts, and the lesson — that what you build makes the next thing
 * cheaper — survives intact.
 */
const ARITHMETIC_GATES = ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor', 'Xnor'];

export const LEVELS: Level[] = [
  {
    id: 'first-wire',
    title: 'NAND',
    brief:
      'This circuit is finished apart from one connection: nothing carries the gate’s result to the lamp. Add that line, then flip the switches.',
    target: 'Nand1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand'],
    stub: `// A circuit is a set of nodes and the wires between them.
// \`x.to(y)\` sends the value at x into y.
//
// Everything here is a node — the switches and the lamp too. This one is
// done except for the last wire: the gate has its answer, but nothing
// carries it to the lamp.

export default circuit('Nand1', {
  nodes: {
    a: Switch,
    b: Switch,
    n1: Nand,
    result: Led,
  },
  connect: ({ nodes: { a, b, n1, result } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    // One more line. Send n1.out to result.in
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
    brief:
      'You have seen what NAND does: it outputs 0 only when both its inputs are 1. It is the only gate you get, so every other gate gets built from it. Start with the simplest — turn a 1 into a 0.',
    target: 'Not1',
    inputs: ['a'],
    outputs: ['result'],
    allowed: ['Nand'],
    stub: `// The same gate as last level, and the only one there is.
// NAND outputs 0 only when both inputs are 1.
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
    result: Led,
  },
  connect: ({ nodes: { a, n1, result } }) => [
    n1.out.to(result.in),
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
      body: 'You built NOT out of nothing but NAND. Every other gate works the same way. AND is next.',
    },
  },

  {
    id: 'and',
    title: 'AND',
    brief:
      'A NAND is an AND gate with its answer flipped. You spent the last level learning to flip an answer. Light the lamp only when both switches are on.',
    target: 'And2',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not'],
    stub: `// The NAND already sees both switches. Its answer
// is the one you want, upside down.
//
// You built NOT last level, so it is yours to use now.
// Add it to the list:
//   n: Not,
//
// Anything you add to \`nodes\` has to be named in the
// \`connect\` line below before you can wire it.

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
      body: 'A NAND and the NOT you worked out last level. The gate you were handed in level one, this time made of parts. OR will not come this directly.',
    },
  },

  {
    id: 'or',
    title: 'OR',
    brief:
      'Light the lamp when either switch is on. There is no way to get there by flipping a NAND, so come at it from the other end: work out when the lamp should stay off.',
    target: 'Or1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And'],
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
      body: 'Not-a and not-b are both true only when everything is off, so denying that gives you OR. Swapping a gate for its opposite with the inputs flipped is a trick that keeps working, and the next level is the easy version of it.',
    },
  },

  {
    id: 'nor',
    title: 'NOR',
    brief:
      'NOR is OR with the answer flipped: the lamp is on only when both switches are off. You built OR a minute ago, so most of this is already done.',
    target: 'Nor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or'],
    stub: `// Nothing new here. Take the OR you built and flip
// what comes out of it.
//
// You have both of those now, so this is two gates.
// Four NANDs if you would rather do it the long way.

export default circuit('Nor1', {
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
      body: 'Every gate you finish makes the next one cheaper, because you stop solving it from scratch and start bolting a NOT onto something that already works. XOR does not give you that. It needs a shape you have not built yet.',
    },
  },

  {
    id: 'xor',
    title: 'XOR',
    brief:
      'Light the lamp when the two switches disagree. This is the one that takes a minute — and it is the gate an adder is built from, so it pays off twice.',
    target: 'Xor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor'],
    stub: `// Work out how many NANDs this needs. Fewer is better.
//
// A signal can drive more than one port:
//   a.out.to(n1.a, n2.a)

export default circuit('Xor1', {
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
      body: "Three if you used what you have earned, four if you stuck to NAND alone. Either way it's the gate an adder is built from, so you'll be reaching for it again. One left in the set, and it is XOR with the answer flipped.",
    },
  },

  {
    id: 'xnor',
    title: 'XNOR',
    brief:
      'The last gate in the set, and the opposite of the one you just built: light the lamp when the two switches agree. You already know the move.',
    target: 'Xnor1',
    inputs: ['a', 'b'],
    outputs: ['result'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor'],
    stub: `// Your XOR, with the answer flipped.
//
// Two gates, now that XOR is yours. The long way
// round is five NANDs, if you want to prove you
// still can.

export default circuit('Xnor1', {
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
      body: 'NOT, AND, OR, NOR, XOR, XNOR. Six gates out of the only one you were given, and each one stayed with you as you went. What none of them can do yet is leave: a circuit made of switches and a lamp is something you look at, not something another circuit can use. That is what the next level fixes.',
    },
  },

  {
    id: 'making-a-component',
    title: 'Making a Component',
    brief:
      'The XOR from two levels back, but this time give the circuit `inputs` and `outputs` instead of switches and a lamp. You have XOR now, so the inside is a single node: the lesson here is the edges, not the wiring. Watch what happens to the diagram. It becomes one box, and that is the trade: you can no longer see inside, and in exchange anything can now use it.',
    target: 'Xor2',
    inputs: ['a', 'b'],
    outputs: ['out'],
    allowed: ['Nand', 'Not', 'And', 'Or', 'Nor', 'Xor', 'Xnor'],
    stub: `// Ports, not switches. Every gate you have built is available.
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
    par: 1,
    outro: {
      headline: "It's a component now",
      body: 'Ports instead of switches, and the diagram collapsed into one box. That is what lets circuits build on each other, which is where this goes next.',
    },
  },

  {
    id: 'half-adder',
    title: 'Half Adder',
    brief:
      'Add two bits. Two of them make 0, 1 or 2, which needs two lamps: sum is the bit you keep, carry is the one that spills over. You have built every gate this needs.',
    target: 'HalfAdder',
    inputs: ['a', 'b'],
    outputs: ['sum', 'carry'],
    allowed: ARITHMETIC_GATES,
    stub: `// Adding two bits gives 0, 1 or 2 — and 2 does not fit in
// one bit, so the answer needs two lamps.
//
//   0 + 0 = 0    sum 0, carry 0
//   0 + 1 = 1    sum 1, carry 0
//   1 + 1 = 2    sum 0, carry 1
//
// You proved you could build these gates, so you have them
// now. Two of them is enough.

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
      body: 'Sum is XOR, carry is AND, and together they add. It is called half an adder because it cannot take a carry coming in — which is the next problem, and the reason one of these is never enough.',
    },
  },

  {
    id: 'full-adder',
    title: 'Full Adder',
    brief:
      'The same sum, but with a carry arriving from the bit below. Do not build it out of gates — build it out of two of the half adders you just made.',
    target: 'FullAdder',
    inputs: ['a', 'b', 'cin'],
    outputs: ['sum', 'cout'],
    allowed: ARITHMETIC_GATES,
    stub: `// Your half adder, wrapped in ports so it can be used as a
// component. That is what the last level was for — a circuit
// with ports is one other circuits can build with.

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

// Two of them are placed. Add a and b with the first, then add
// cin to that answer with the second.
//
// Either of those additions can carry, and the answer carries
// out if either did — so you need one more gate for that.

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
      body: "That's the last level for now. More to come.",
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
 * arrival — what the completion card announces as unlocked.
 *
 * Normally that is whatever the next level adds. The first level is the
 * exception: its baseline is nothing at all, so the gate it hands over is its
 * own `allowed` set. Without that case the opening card claimed in prose to
 * have unlocked NAND while showing no unlock at all, which is the one card
 * every player sees.
 */
export function gatesGainedAfter(level: Level, next: Level | undefined): string[] {
  if (levelIndex(level.id) === 0) return level.allowed;
  return next ? next.allowed.filter((name) => !level.allowed.includes(name)) : [];
}
