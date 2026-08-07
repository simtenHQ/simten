/**
 * Reference solutions, one per level.
 *
 * These are the validation gate's known-good answers — `__tests__/levels.test.ts`
 * asserts every one of them passes its level, and that the set matches `LEVELS`
 * exactly. Keeping them here rather than in the test file means one copy, and
 * the copy the suite proves correct is the copy the app renders.
 *
 * ⚠️ These are the answers, and this module ships to the browser. Anyone can
 * read them out of the bundle. That is deliberate and temporary: the map's
 * drilldown needs *some* circuit to draw before progress is persisted, and
 * showing the reference answer is how the interaction gets evaluated without
 * waiting on a save system. Once `simten:game:drafts` exists, the drilldown
 * should read the player's own source and this module goes back to being
 * test-only — a player's own circuit is the whole point of the feature, and it
 * is also not a spoiler.
 */

export const SOLUTIONS: Record<string, string> = {
  'first-wire': `
export const Nand1 = circuit('Nand1', {
  nodes: { a: Switch, b: Switch, n1: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, out } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    n1.out.to(out.in),
  ],
});`,

  'not-from-nand': `
export const Not1 = circuit('Not1', {
  nodes: { a: Switch, n1: Nand, out: Led },
  connect: ({ nodes: { a, n1, out } }) => [
    a.out.to(n1.a, n1.b),
    n1.out.to(out.in),
  ],
});`,

  'and-from-nand': `
export const And2 = circuit('And2', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, out } }) => [
    a.out.to(n1.a),
    b.out.to(n1.b),
    n1.out.to(n2.a, n2.b),
    n2.out.to(out.in),
  ],
});`,

  'or-from-nand': `
export const Or1 = circuit('Or1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, out } }) => [
    a.out.to(n1.a, n1.b),
    b.out.to(n2.a, n2.b),
    n1.out.to(n3.a),
    n2.out.to(n3.b),
    n3.out.to(out.in),
  ],
});`,

  'nor-from-nand': `
export const Nor1 = circuit('Nor1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, n4, out } }) => [
    a.out.to(n1.a, n1.b),
    b.out.to(n2.a, n2.b),
    n1.out.to(n3.a),
    n2.out.to(n3.b),
    n3.out.to(n4.a, n4.b),
    n4.out.to(out.in),
  ],
});`,

  'xor-from-nand': `
export const Xor1 = circuit('Xor1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, n4, out } }) => [
    a.out.to(n1.a, n2.a),
    b.out.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(out.in),
  ],
});`,

  'xnor-from-nand': `
export const Xnor1 = circuit('Xnor1', {
  nodes: { a: Switch, b: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, n5: Nand, out: Led },
  connect: ({ nodes: { a, b, n1, n2, n3, n4, n5, out } }) => [
    a.out.to(n1.a, n2.a),
    b.out.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(n5.a, n5.b),
    n5.out.to(out.in),
  ],
});`,

  'half-adder': `
export const Xor2 = circuit('Xor2', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  nodes: { n1: Nand, n2: Nand, n3: Nand, n4: Nand },
  connect: ({ inputs, outputs, nodes: { n1, n2, n3, n4 } }) => [
    inputs.a.to(n1.a, n2.a),
    inputs.b.to(n1.b, n3.b),
    n1.out.to(n2.b, n3.a),
    n2.out.to(n4.a),
    n3.out.to(n4.b),
    n4.out.to(outputs.out),
  ],
});`,
};
