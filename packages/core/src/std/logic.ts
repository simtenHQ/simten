/**
 * Standard Library — Logic Gates
 *
 * Defined using circuit() for full TypeScript type inference.
 * The simulation engine uses hand-written fast evaluators (EVALUATORS table)
 * for these — the eval functions here are fallbacks and documentation.
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

/**
 * Logical AND gate. Output is 1 when both inputs are 1, otherwise 0.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  0
 *  0  1 |  0
 *  1  0 |  0
 *  1  1 |  1
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Both', {
 *   inputs:  { x: bit, y: bit },
 *   outputs: { z: bit },
 *   nodes:   { g: And },
 *   connect: ({ inputs, outputs, nodes: { g } }) => [
 *     inputs.x.to(g.a),
 *     inputs.y.to(g.b),
 *     g.out.to(outputs.z),
 *   ],
 * })
 * ```
 */
export const And = circuit('And', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '&', description: 'Logical AND gate' },
  eval: ({ a, b }) => ({ out: a && b ? 1 : 0 }),
});

/**
 * Logical OR gate. Output is 1 when either input is 1.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  0
 *  0  1 |  1
 *  1  0 |  1
 *  1  1 |  1
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Either', {
 *   inputs:  { x: bit, y: bit },
 *   outputs: { z: bit },
 *   nodes:   { g: Or },
 *   connect: ({ inputs, outputs, nodes: { g } }) => [
 *     inputs.x.to(g.a),
 *     inputs.y.to(g.b),
 *     g.out.to(outputs.z),
 *   ],
 * })
 * ```
 */
export const Or = circuit('Or', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '≥1', description: 'Logical OR gate' },
  eval: ({ a, b }) => ({ out: a || b ? 1 : 0 }),
});

/**
 * Logical NOT gate (inverter). Flips a single bit.
 *
 * **Input:** `in` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  in | out
 *   0 |  1
 *   1 |  0
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Invert', {
 *   inputs:  { x: bit },
 *   outputs: { y: bit },
 *   nodes:   { n: Not },
 *   connect: ({ inputs, outputs, nodes: { n } }) => [
 *     inputs.x.to(n.in),
 *     n.out.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const Not = circuit('Not', {
  inputs: { in: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '¬', description: 'Logical NOT gate' },
  eval: ({ in: a }) => ({ out: a ? 0 : 1 }),
});

/**
 * Logical NAND gate. Equivalent to `Not(And(a, b))` — output is 0 only when
 * both inputs are 1. NAND is functionally complete: every Boolean circuit
 * can be expressed using only NAND gates.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  1
 *  0  1 |  1
 *  1  0 |  1
 *  1  1 |  0
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('NotBoth', {
 *   inputs:  { x: bit, y: bit },
 *   outputs: { z: bit },
 *   nodes:   { g: Nand },
 *   connect: ({ inputs, outputs, nodes: { g } }) => [
 *     inputs.x.to(g.a),
 *     inputs.y.to(g.b),
 *     g.out.to(outputs.z),
 *   ],
 * })
 * ```
 */
export const Nand = circuit('Nand', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊼', description: 'Logical NAND gate' },
  eval: ({ a, b }) => ({ out: a && b ? 0 : 1 }),
});

/**
 * Logical NOR gate. Equivalent to `Not(Or(a, b))` — output is 1 only when
 * both inputs are 0. Like NAND, NOR is functionally complete on its own.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  1
 *  0  1 |  0
 *  1  0 |  0
 *  1  1 |  0
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Neither', {
 *   inputs:  { x: bit, y: bit },
 *   outputs: { z: bit },
 *   nodes:   { g: Nor },
 *   connect: ({ inputs, outputs, nodes: { g } }) => [
 *     inputs.x.to(g.a),
 *     inputs.y.to(g.b),
 *     g.out.to(outputs.z),
 *   ],
 * })
 * ```
 */
export const Nor = circuit('Nor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊽', description: 'Logical NOR gate' },
  eval: ({ a, b }) => ({ out: a || b ? 0 : 1 }),
});

/**
 * Logical XOR gate (exclusive-or). Output is 1 when the inputs differ.
 * Building block for adders (sum bit), parity, equality, and gray-code logic.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  0
 *  0  1 |  1
 *  1  0 |  1
 *  1  1 |  0
 * ```
 *
 * **Example:** half-adder sum bit
 * ```ts
 * circuit('HalfAdderSum', {
 *   inputs:  { a: bit, b: bit },
 *   outputs: { sum: bit },
 *   nodes:   { x: Xor },
 *   connect: ({ inputs, outputs, nodes: { x } }) => [
 *     inputs.a.to(x.a),
 *     inputs.b.to(x.b),
 *     x.out.to(outputs.sum),
 *   ],
 * })
 * ```
 */
export const Xor = circuit('Xor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊕', description: 'Logical XOR gate' },
  eval: ({ a, b }) => ({ out: a !== b ? 1 : 0 }),
});

/**
 * Logical XNOR gate. Output is 1 when the inputs match — the boolean
 * equivalence operator. Useful for equality comparison: `Xnor(a, b) == (a == b)`.
 *
 * **Inputs:** `a`, `b` — `bit`
 * **Output:** `out` — `bit`
 *
 * ```
 *  a  b | out
 *  0  0 |  1
 *  0  1 |  0
 *  1  0 |  0
 *  1  1 |  1
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Equal', {
 *   inputs:  { a: bit, b: bit },
 *   outputs: { eq: bit },
 *   nodes:   { g: Xnor },
 *   connect: ({ inputs, outputs, nodes: { g } }) => [
 *     inputs.a.to(g.a),
 *     inputs.b.to(g.b),
 *     g.out.to(outputs.eq),
 *   ],
 * })
 * ```
 */
export const Xnor = circuit('Xnor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊙', description: 'Logical XNOR gate' },
  eval: ({ a, b }) => ({ out: a === b ? 1 : 0 }),
});

/**
 * Buffer — passes input through unchanged. The identity gate.
 *
 * In real hardware a buffer restores signal strength and isolates fanout; in
 * simulation it adds a propagation step. Useful when you need an explicit
 * point to probe or to break a combinational chain into smaller pieces.
 *
 * **Input:** `in` — `bit`
 * **Output:** `out` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('Probe', {
 *   inputs:  { signal: bit },
 *   outputs: { passthrough: bit },
 *   nodes:   { b: Buffer },
 *   connect: ({ inputs, outputs, nodes: { b } }) => [
 *     inputs.signal.to(b.in),
 *     b.out.to(outputs.passthrough),
 *   ],
 * })
 * ```
 */
export const Buffer = circuit('Buffer', {
  inputs: { in: bit },
  outputs: { out: bit },
  meta: {
    category: 'logic-gates',
    icon: '▷',
    description: 'Buffer — passes input through unchanged',
  },
  eval: ({ in: a }) => ({ out: a }),
});

// ============================================================================
// Bus-width logical & reduction operators (bus → bit) — the Verilog `&&`, `||`,
// `!`, `|a`, `&a`, `^a` an author writes directly. The importer lifts
// $logic_and/$logic_or/$logic_not and $reduce_* onto these (authoring stdlib).
// ============================================================================

/**
 * Logical AND (&&) — nonzero operands. `out = (a != 0) && (b != 0)`, a single
 * bit. Operand widths are independent.
 *
 * **Inputs:** `a` — `bus(aWidth)`, `b` — `bus(bWidth)`  **Output:** `out` — `bit`
 */
export const LogicAnd = circuit(
  'LogicAnd',
  ({ aWidth = 8, bWidth = 8 }: { aWidth?: number; bWidth?: number } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bit },
    meta: {
      category: 'logic-gates',
      icon: '&&',
      description: 'Logical AND (&&) — nonzero operands',
    },
    eval: ({ a, b }) => ({ out: (a as number) >>> 0 && (b as number) >>> 0 ? 1 : 0 }),
  }),
);

/**
 * Logical OR (||) — nonzero operands. `out = (a != 0) || (b != 0)`, a single bit.
 *
 * **Inputs:** `a` — `bus(aWidth)`, `b` — `bus(bWidth)`  **Output:** `out` — `bit`
 */
export const LogicOr = circuit(
  'LogicOr',
  ({ aWidth = 8, bWidth = 8 }: { aWidth?: number; bWidth?: number } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bit },
    meta: {
      category: 'logic-gates',
      icon: '||',
      description: 'Logical OR (||) — nonzero operands',
    },
    eval: ({ a, b }) => ({ out: (a as number) >>> 0 || (b as number) >>> 0 ? 1 : 0 }),
  }),
);

/**
 * Logical NOT (!) — 1 iff input is zero. `out = (a == 0)`, a single bit.
 *
 * **Input:** `a` — `bus(width)`  **Output:** `out` — `bit`
 */
export const LogicNot = circuit('LogicNot', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width) },
  outputs: { out: bit },
  meta: {
    category: 'logic-gates',
    icon: '!',
    description: 'Logical NOT (!) — 1 iff input is zero',
  },
  eval: ({ a }) => ({ out: (a as number) >>> 0 === 0 ? 1 : 0 }),
}));

/**
 * Reduction OR (|a) — 1 iff any bit set. `out = |a`, a single bit.
 *
 * **Input:** `a` — `bus(width)`  **Output:** `out` — `bit`
 */
export const ReduceOr = circuit('ReduceOr', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width) },
  outputs: { out: bit },
  meta: {
    category: 'bus-operations',
    icon: '|a',
    description: 'Reduction OR (|a) — 1 iff any bit set',
  },
  eval: ({ a }) => ({ out: (a as number) >>> 0 !== 0 ? 1 : 0 }),
}));

/**
 * Reduction AND (&a) — 1 iff all bits set. `out = &a`, a single bit.
 *
 * **Input:** `a` — `bus(width)`  **Output:** `out` — `bit`
 */
export const ReduceAnd = circuit('ReduceAnd', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width) },
  outputs: { out: bit },
  meta: {
    category: 'bus-operations',
    icon: '&a',
    description: 'Reduction AND (&a) — 1 iff all bits set',
  },
  // Literal default and an inlined mask, so nothing here reads the factory
  // scope — the registry keys by name and last write wins (see Adder).
  eval: ({ a, width: w = 8 }) => {
    const wn = w as number;
    const m = (wn >= 32 ? 0xffffffff : (1 << wn) - 1) >>> 0;
    // `& m` is a signed 32-bit op; coerce back to unsigned before comparing.
    return { out: (((a as number) >>> 0) & m) >>> 0 === m ? 1 : 0 };
  },
}));

/**
 * Reduction XOR (^a) — parity of all bits. `out = ^a`, a single bit.
 *
 * **Input:** `a` — `bus(width)`  **Output:** `out` — `bit`
 */
export const ReduceXor = circuit('ReduceXor', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width) },
  outputs: { out: bit },
  meta: {
    category: 'bus-operations',
    icon: '^a',
    description: 'Reduction XOR (^a) — parity of all bits',
  },
  eval: ({ a }) => {
    let x = (a as number) >>> 0;
    let p = 0;
    while (x) {
      p ^= x & 1;
      x >>>= 1;
    }
    return { out: p };
  },
}));

/**
 * Reduction XNOR (~^a) — 1 when an even number of bits are set. `out = ~^a`,
 * a single bit: the complement of reduction XOR.
 *
 * **Input:** `a` — `bus(width)`  **Output:** `out` — `bit`
 */
export const ReduceXnor = circuit('ReduceXnor', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width) },
  outputs: { out: bit },
  meta: {
    category: 'bus-operations',
    icon: '~^a',
    description: 'Reduction XNOR (~^a) — 1 when an even number of bits are set',
  },
  eval: ({ a }) => {
    let x = (a as number) >>> 0;
    let p = 0;
    while (x) {
      p ^= x & 1;
      x >>>= 1;
    }
    return { out: p ^ 1 };
  },
}));
