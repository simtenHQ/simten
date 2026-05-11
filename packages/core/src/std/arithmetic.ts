/**
 * Standard Library — Arithmetic Operations
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

/**
 * Adds 1 to the input. 8-bit value, wraps at 256 (`(in + 1) & 0xFF`).
 *
 * **Input:** `in` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** counter increment stage
 * ```ts
 * circuit('NextValue', {
 *   inputs:  { value: bus(8) },
 *   outputs: { next: bus(8) },
 *   nodes:   { inc: Incrementer },
 *   connect: ({ inputs, outputs, nodes: { inc } }) => [
 *     inputs.value.to(inc.in),
 *     inc.out.to(outputs.next),
 *   ],
 * })
 * ```
 */
export const Incrementer = circuit('Incrementer', {
  inputs: { in: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'arithmetic', icon: '+1', description: 'Adds 1 to the input' },
  eval: ({ in: a }) => ({ out: (a + 1) & 0xFF }),
});

/**
 * N-bit adder with carry. Computes `a + b + carry_in`, returning the low
 * 8 bits as `sum` and the 9th bit as `carry_out`. Chain `carry_out` →
 * `carry_in` of a higher-order Adder to build wider adders.
 *
 * **Inputs:** `a`, `b` — `bus(8)`; `carry_in` — `bit`
 * **Outputs:** `sum` — `bus(8)`; `carry_out` — `bit`
 *
 * **Example:** ripple-carry 16-bit adder
 * ```ts
 * circuit('Adder16', {
 *   inputs:  { aLo: bus(8), aHi: bus(8), bLo: bus(8), bHi: bus(8) },
 *   outputs: { sumLo: bus(8), sumHi: bus(8), cout: bit },
 *   nodes:   { lo: Adder, hi: Adder, zero: Constant },
 *   connect: ({ inputs, outputs, nodes: { lo, hi, zero } }) => [
 *     zero.out.to(lo.carry_in),
 *     inputs.aLo.to(lo.a), inputs.bLo.to(lo.b),
 *     inputs.aHi.to(hi.a), inputs.bHi.to(hi.b),
 *     lo.carry_out.to(hi.carry_in),
 *     lo.sum.to(outputs.sumLo),
 *     hi.sum.to(outputs.sumHi),
 *     hi.carry_out.to(outputs.cout),
 *   ],
 * })
 * ```
 */
export const Adder = circuit('Adder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), carry_out: bit },
  meta: { category: 'arithmetic', icon: '+', description: 'N-bit adder with carry' },
  eval: ({ a, b, carry_in }) => {
    const result = a + b + carry_in;
    return { sum: result & 0xFF, carry_out: (result >> 8) & 1 };
  },
});

/**
 * N-bit subtractor with borrow. Computes `a - b - borrow_in` and produces
 * the 8-bit `difference`. `borrow_out` is 1 when the result underflowed
 * (i.e. `a < b + borrow_in`).
 *
 * **Inputs:** `a`, `b` — `bus(8)`; `borrow_in` — `bit`
 * **Outputs:** `difference` — `bus(8)`; `borrow_out` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('Diff', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   outputs: { d: bus(8), underflow: bit },
 *   nodes:   { sub: Subtractor, zero: Constant },
 *   connect: ({ inputs, outputs, nodes: { sub, zero } }) => [
 *     zero.out.to(sub.borrow_in),
 *     inputs.x.to(sub.a),
 *     inputs.y.to(sub.b),
 *     sub.difference.to(outputs.d),
 *     sub.borrow_out.to(outputs.underflow),
 *   ],
 * })
 * ```
 */
export const Subtractor = circuit('Subtractor', {
  inputs: { a: bus(8), b: bus(8), borrow_in: bit },
  outputs: { difference: bus(8), borrow_out: bit },
  meta: { category: 'arithmetic', icon: '−', description: 'N-bit subtractor with borrow' },
  eval: ({ a, b, borrow_in }) => {
    const result = a - b - borrow_in;
    return { difference: result & 0xFF, borrow_out: result < 0 ? 1 : 0 };
  },
});

/**
 * N-bit multiplier. Output is a 16-bit unsigned product so two 8-bit
 * inputs never overflow.
 *
 * **Inputs:** `a`, `b` — `bus(8)`
 * **Output:** `product` — `bus(16)`
 *
 * **Example:**
 * ```ts
 * circuit('Mul', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   outputs: { p: bus(16) },
 *   nodes:   { m: Multiplier },
 *   connect: ({ inputs, outputs, nodes: { m } }) => [
 *     inputs.x.to(m.a),
 *     inputs.y.to(m.b),
 *     m.product.to(outputs.p),
 *   ],
 * })
 * ```
 */
export const Multiplier = circuit('Multiplier', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { product: bus(16) },
  meta: { category: 'arithmetic', icon: '×', description: 'N-bit multiplier' },
  eval: ({ a, b }) => ({ product: (a * b) & 0xFFFF }),
});

/**
 * Unsigned comparator. Emits three one-hot flags relating `a` and `b`.
 * Exactly one of `eq`/`lt`/`gt` is high at any time.
 *
 * **Inputs:** `a`, `b` — `bus(8)`
 * **Outputs:** `eq`, `lt`, `gt` — `bit`
 *
 * **Example:** branch-if-not-equal
 * ```ts
 * circuit('CheckEq', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   outputs: { same: bit, diff: bit },
 *   nodes:   { cmp: Comparator, n: Not },
 *   connect: ({ inputs, outputs, nodes: { cmp, n } }) => [
 *     inputs.x.to(cmp.a),
 *     inputs.y.to(cmp.b),
 *     cmp.eq.to(outputs.same, n.in),
 *     n.out.to(outputs.diff),
 *   ],
 * })
 * ```
 */
export const Comparator = circuit('Comparator', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { eq: bit, lt: bit, gt: bit },
  meta: { category: 'arithmetic', icon: '⋚', description: 'Unsigned comparator' },
  eval: ({ a, b }) => ({ eq: a === b ? 1 : 0, lt: a < b ? 1 : 0, gt: a > b ? 1 : 0 }),
});

/**
 * Left bit shifter. Computes `(value << shift) & 0xFF`. Bits shifted out
 * the top are lost; vacated bottom bits fill with 0.
 *
 * **Inputs:** `value`, `shift` — `bus(8)`
 * **Output:** `result` — `bus(8)`
 *
 * **Example:** multiply by 4
 * ```ts
 * circuit('Times4', {
 *   inputs:  { x: bus(8) },
 *   outputs: { y: bus(8) },
 *   nodes:   { sh: LeftShifter, two: Constant },
 *   connect: ({ inputs, outputs, nodes: { sh, two } }) => [
 *     inputs.x.to(sh.value),
 *     two.out.to(sh.shift),
 *     sh.result.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const LeftShifter = circuit('LeftShifter', {
  inputs: { value: bus(8), shift: bus(8) },
  outputs: { result: bus(8) },
  meta: { category: 'arithmetic', icon: '≪', description: 'Left bit shifter' },
  eval: ({ value, shift }) => ({ result: (value << shift) & 0xFF }),
});

/**
 * Right bit shifter (logical / unsigned). Computes `value >>> shift`.
 * Vacated top bits fill with 0 — use a signed shift for arithmetic
 * (sign-extending) semantics.
 *
 * **Inputs:** `value`, `shift` — `bus(8)`
 * **Output:** `result` — `bus(8)`
 *
 * **Example:**
 * ```ts
 * circuit('DivBy8', {
 *   inputs:  { x: bus(8) },
 *   outputs: { y: bus(8) },
 *   nodes:   { sh: RightShifter, three: Constant },
 *   connect: ({ inputs, outputs, nodes: { sh, three } }) => [
 *     inputs.x.to(sh.value),
 *     three.out.to(sh.shift),
 *     sh.result.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const RightShifter = circuit('RightShifter', {
  inputs: { value: bus(8), shift: bus(8) },
  outputs: { result: bus(8) },
  meta: { category: 'arithmetic', icon: '≫', description: 'Right bit shifter' },
  eval: ({ value, shift }) => ({ result: (value >>> shift) & 0xFF }),
});

/**
 * Signed adder with overflow detection. Treats inputs as 8-bit two's-complement
 * (range -128..127). `overflow` flags signed overflow — when the result's
 * sign bit doesn't match what it should given the operand signs.
 *
 * **Inputs:** `a`, `b` — `bus(8)` (signed); `carry_in` — `bit`
 * **Outputs:** `sum` — `bus(8)`; `overflow` — `bit`; `carry_out` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('SAdd', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   outputs: { s: bus(8), ovf: bit },
 *   nodes:   { add: SignedAdder, zero: Constant },
 *   connect: ({ inputs, outputs, nodes: { add, zero } }) => [
 *     zero.out.to(add.carry_in),
 *     inputs.x.to(add.a),
 *     inputs.y.to(add.b),
 *     add.sum.to(outputs.s),
 *     add.overflow.to(outputs.ovf),
 *   ],
 * })
 * ```
 */
export const SignedAdder = circuit('SignedAdder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), overflow: bit, carry_out: bit },
  meta: { category: 'arithmetic', icon: '±+', description: 'Signed adder with overflow detection' },
  eval: ({ a, b, carry_in }) => {
    const result = a + b + carry_in;
    return { sum: result & 0xFF, carry_out: (result >> 8) & 1, overflow: 0 };
  },
});

/**
 * Signed comparator. Like `Comparator` but treats inputs as 8-bit
 * two's-complement values, and exposes inclusive `lte`/`gte` flags in
 * addition to strict `lt`/`gt`/`eq`.
 *
 * **Inputs:** `a`, `b` — `bus(8)` (signed)
 * **Outputs:** `eq`, `lt`, `gt`, `lte`, `gte` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('IsNegative', {
 *   inputs:  { x: bus(8) },
 *   outputs: { neg: bit },
 *   nodes:   { cmp: SignedComparator, zero: Constant },
 *   connect: ({ inputs, outputs, nodes: { cmp, zero } }) => [
 *     inputs.x.to(cmp.a),
 *     zero.out.to(cmp.b),
 *     cmp.lt.to(outputs.neg),
 *   ],
 * })
 * ```
 */
export const SignedComparator = circuit('SignedComparator', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { eq: bit, lt: bit, gt: bit, lte: bit, gte: bit },
  meta: { category: 'arithmetic', icon: '±⋚', description: 'Signed comparator' },
  eval: ({ a, b }) => ({ eq: a === b ? 1 : 0, lt: a < b ? 1 : 0, gt: a > b ? 1 : 0, lte: a <= b ? 1 : 0, gte: a >= b ? 1 : 0 }),
});

/**
 * Signed multiplier. Treats both inputs as 8-bit two's-complement values
 * (range -128..127). Returns a 16-bit `product`.
 *
 * **Inputs:** `a`, `b` — `bus(8)` (signed)
 * **Output:** `product` — `bus(16)`
 *
 * **Example:**
 * ```ts
 * circuit('SMul', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   outputs: { p: bus(16) },
 *   nodes:   { m: SignedMultiplier },
 *   connect: ({ inputs, outputs, nodes: { m } }) => [
 *     inputs.x.to(m.a),
 *     inputs.y.to(m.b),
 *     m.product.to(outputs.p),
 *   ],
 * })
 * ```
 */
export const SignedMultiplier = circuit('SignedMultiplier', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { product: bus(16) },
  meta: { category: 'arithmetic', icon: '±×', description: 'Signed multiplier' },
  eval: ({ a, b }) => ({ product: (a * b) & 0xFFFF }),
});

// Bus operations
/**
 * Bitwise AND on buses. Performs `a & b` per bit position across the 8-bit bus.
 *
 * **Inputs:** `a`, `b` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** mask off the low nibble
 * ```ts
 * circuit('HighNibble', {
 *   inputs:  { x: bus(8) },
 *   outputs: { y: bus(8) },
 *   nodes:   { mask: BusAnd, hi: Constant },
 *   connect: ({ inputs, outputs, nodes: { mask, hi } }) => [
 *     inputs.x.to(mask.a),
 *     hi.out.to(mask.b), // hi.value = 0xF0
 *     mask.out.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const BusAnd = circuit('BusAnd', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '&8', description: 'Bitwise AND on buses' },
  eval: ({ a, b }) => ({ out: a & b }),
});

/**
 * Bitwise OR on buses. Performs `a | b` per bit position across the 8-bit bus.
 *
 * **Inputs:** `a`, `b` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** set flag bits
 * ```ts
 * circuit('SetBits', {
 *   inputs:  { status: bus(8) },
 *   outputs: { updated: bus(8) },
 *   nodes:   { or: BusOr, flags: Constant },
 *   connect: ({ inputs, outputs, nodes: { or, flags } }) => [
 *     inputs.status.to(or.a),
 *     flags.out.to(or.b),
 *     or.out.to(outputs.updated),
 *   ],
 * })
 * ```
 */
export const BusOr = circuit('BusOr', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '|8', description: 'Bitwise OR on buses' },
  eval: ({ a, b }) => ({ out: a | b }),
});

/**
 * Bitwise NOT on bus. Flips every bit (`~in & 0xFF`).
 *
 * **Input:** `in` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** ones' complement
 * ```ts
 * circuit('Invert', {
 *   inputs:  { x: bus(8) },
 *   outputs: { y: bus(8) },
 *   nodes:   { inv: BusNot },
 *   connect: ({ inputs, outputs, nodes: { inv } }) => [
 *     inputs.x.to(inv.in),
 *     inv.out.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const BusNot = circuit('BusNot', {
  inputs: { in: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '¬8', description: 'Bitwise NOT on bus' },
  eval: ({ in: a }) => ({ out: (~a) & 0xFF }),
});

/**
 * Bitwise XOR on buses. Performs `a ^ b` per bit position. Useful for
 * toggling flag bits, computing parity, and detecting bit-level differences.
 *
 * **Inputs:** `a`, `b` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** toggle bits selected by mask
 * ```ts
 * circuit('Toggle', {
 *   inputs:  { state: bus(8), mask: bus(8) },
 *   outputs: { next: bus(8) },
 *   nodes:   { x: BusXor },
 *   connect: ({ inputs, outputs, nodes: { x } }) => [
 *     inputs.state.to(x.a),
 *     inputs.mask.to(x.b),
 *     x.out.to(outputs.next),
 *   ],
 * })
 * ```
 */
export const BusXor = circuit('BusXor', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '⊕8', description: 'Bitwise XOR on buses' },
  eval: ({ a, b }) => ({ out: a ^ b }),
});
