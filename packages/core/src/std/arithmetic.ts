/**
 * Standard Library — Arithmetic Operations
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

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
  eval: ({ in: a }) => ({ out: (a + 1) & 0xff }),
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
export const Adder = circuit(
  'Adder',
  ({ width = 8 }: { width?: number; carry_in?: number } = {}) => ({
    inputs: { a: bus(width), b: bus(width), carry_in: bit },
    outputs: { sum: bus(width), carry_out: bit },
    meta: { category: 'arithmetic', icon: '+', description: 'N-bit adder with carry' },
    // `width` is read from inputs (bridge merges node.arguments) so a single
    // registered lambda works for every Adder({width: N}) instance.
    eval: ({ a, b, carry_in, width: w = width }) => {
      const wn = w as number;
      const mask = wn >= 32 ? 0xffffffff : (1 << wn) - 1;
      // a, b arrive as signed int32 from the typed-array store; coerce to
      // unsigned before adding so the carry comparison sees the right magnitude.
      const result = ((a as number) >>> 0) + ((b as number) >>> 0) + (carry_in as number);
      return { sum: result & mask, carry_out: result > mask ? 1 : 0 };
    },
  }),
);

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
export const Subtractor = circuit('Subtractor', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width), b: bus(width), borrow_in: bit },
  outputs: { difference: bus(width), borrow_out: bit },
  meta: { category: 'arithmetic', icon: '−', description: 'N-bit subtractor with borrow' },
  eval: ({ a, b, borrow_in, width: w = width }) => {
    const wn = w as number;
    const mask = wn >= 32 ? 0xffffffff : (1 << wn) - 1;
    const result = ((a as number) >>> 0) - ((b as number) >>> 0) - (borrow_in as number);
    return { difference: result & mask, borrow_out: result < 0 ? 1 : 0 };
  },
}));

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
  eval: ({ a, b }) => ({ product: (a * b) & 0xffff }),
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
export const Comparator = circuit('Comparator', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width), b: bus(width) },
  outputs: { eq: bit, ne: bit, lt: bit, le: bit, gt: bit, ge: bit },
  meta: { category: 'arithmetic', icon: '⋚', description: 'Unsigned comparator' },
  // Unsigned: coerce both operands so the comparison treats them as unsigned
  // 32-bit values regardless of how they were stored in the typed-array.
  eval: ({ a, b }) => {
    const au = (a as number) >>> 0;
    const bu = (b as number) >>> 0;
    return {
      eq: au === bu ? 1 : 0,
      ne: au !== bu ? 1 : 0,
      lt: au < bu ? 1 : 0,
      le: au <= bu ? 1 : 0,
      gt: au > bu ? 1 : 0,
      ge: au >= bu ? 1 : 0,
    };
  },
}));

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
export const LeftShifter = circuit('LeftShifter', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { value: bus(width), shift: bus(width) },
  outputs: { result: bus(width) },
  meta: { category: 'arithmetic', icon: '≪', description: 'Left bit shifter' },
  eval: ({ value, shift, width: w = width }) => {
    const wn = w as number;
    const sn = shift as number;
    const mask = wn >= 32 ? 0xffffffff : (1 << wn) - 1;
    return { result: sn >= wn ? 0 : ((value as number) << sn) & mask };
  },
}));

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
export const RightShifter = circuit('RightShifter', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { value: bus(width), shift: bus(width) },
  outputs: { result: bus(width) },
  meta: { category: 'arithmetic', icon: '≫', description: 'Right bit shifter' },
  eval: ({ value, shift, width: w = width }) => {
    const wn = w as number;
    const sn = shift as number;
    return { result: sn >= wn ? 0 : (value as number) >>> sn };
  },
}));

/**
 * Arithmetic (signed) right shifter. Computes `$signed(value) >>> shift`,
 * replicating the sign bit into the vacated top bits — Verilog `>>>` on a
 * signed operand. Shifts ≥ width saturate to all-0 (value ≥ 0) or all-1
 * (value < 0).
 *
 * **Inputs:** `value`, `shift` — `bus(width)`  **Output:** `result` — `bus(width)`
 */
export const SignedRightShifter = circuit(
  'SignedRightShifter',
  ({ width = 8 }: { width?: number } = {}) => ({
    inputs: { value: bus(width), shift: bus(width) },
    outputs: { result: bus(width) },
    meta: { category: 'arithmetic', icon: '≫±', description: 'Arithmetic (signed) right shifter' },
    eval: ({ value, shift, width: w = width }) => {
      const wn = w as number;
      const mask = wn >= 32 ? 0xffffffff : (1 << wn) - 1;
      const half = 2 ** (wn - 1);
      const u = (value as number) >>> 0;
      const signed = u >= half ? u - 2 ** wn : u; // interpret as two's-complement
      const sn = shift as number;
      // arithmetic shift; saturates to the sign fill once shift ≥ width
      const shifted = sn >= wn ? (signed < 0 ? -1 : 0) : Math.floor(signed / 2 ** sn);
      return { result: (shifted & mask) >>> 0 };
    },
  }),
);

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
    const signBit = 0x80;
    const mask = 0xff;
    const an = (a as number) >>> 0;
    const bn = (b as number) >>> 0;
    const result = an + bn + (carry_in as number);
    const sum = result & mask;
    const aSign = (an & signBit) !== 0;
    const bSign = (bn & signBit) !== 0;
    const sumSign = (sum & signBit) !== 0;
    const overflow = aSign === bSign && aSign !== sumSign ? 1 : 0;
    return { sum, overflow, carry_out: result > mask ? 1 : 0 };
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
export const SignedComparator = circuit(
  'SignedComparator',
  ({ width = 8 }: { width?: number } = {}) => ({
    inputs: { a: bus(width), b: bus(width) },
    // eq/ne/lt/le/gt/ge match Comparator; lte/gte kept as back-compat aliases.
    outputs: { eq: bit, ne: bit, lt: bit, le: bit, gt: bit, ge: bit, lte: bit, gte: bit },
    meta: { category: 'arithmetic', icon: '±⋚', description: 'Signed comparator' },
    // width read from the bag so per-instance widths sign-extend correctly.
    eval: ({ a, b, width: w = width }) => {
      const wn = w as number;
      const half = 2 ** (wn - 1);
      const whole = 2 ** wn;
      const sgn = (v: number) => {
        const u = wn >= 32 ? v >>> 0 : (v >>> 0) & (whole - 1);
        return u >= half ? u - whole : u;
      };
      const as = sgn(a as number);
      const bs = sgn(b as number);
      return {
        eq: as === bs ? 1 : 0,
        ne: as !== bs ? 1 : 0,
        lt: as < bs ? 1 : 0,
        le: as <= bs ? 1 : 0,
        gt: as > bs ? 1 : 0,
        ge: as >= bs ? 1 : 0,
        lte: as <= bs ? 1 : 0,
        gte: as >= bs ? 1 : 0,
      };
    },
  }),
);

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
  eval: ({ a, b }) => {
    const signBit = 0x80;
    const maxValue = 0x100;
    const an = (a as number) & 0xff;
    const bn = (b as number) & 0xff;
    const aSigned = an & signBit ? an - maxValue : an;
    const bSigned = bn & signBit ? bn - maxValue : bn;
    const productSigned = aSigned * bSigned;
    const outputRange = 0x10000;
    return { product: productSigned >= 0 ? productSigned : productSigned + outputRange };
  },
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
export const BusAnd = circuit('BusAnd', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width), b: bus(width) },
  outputs: { out: bus(width) },
  meta: { category: 'bus-operations', icon: '&8', description: 'Bitwise AND on buses' },
  eval: ({ a, b }) => ({ out: a & b }),
}));

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
export const BusOr = circuit('BusOr', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width), b: bus(width) },
  outputs: { out: bus(width) },
  meta: { category: 'bus-operations', icon: '|8', description: 'Bitwise OR on buses' },
  eval: ({ a, b }) => ({ out: (a | b) >>> 0 }),
}));

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
 *   nodes:   { inv: BusNot() },
 *   connect: ({ inputs, outputs, nodes: { inv } }) => [
 *     inputs.x.to(inv.in),
 *     inv.out.to(outputs.y),
 *   ],
 * })
 * ```
 */
export const BusNot = circuit('BusNot', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { in: bus(width) },
  outputs: { out: bus(width) },
  meta: { category: 'bus-operations', icon: '¬8', description: 'Bitwise NOT on bus' },
  // width read from the bag so per-instance widths mask correctly (default 8).
  eval: ({ in: a, width: w = width }) => {
    const m = ((w as number) >= 32 ? 0xffffffff : (1 << (w as number)) - 1) >>> 0;
    return { out: (~(a as number) >>> 0) & m };
  },
}));

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
export const BusXor = circuit('BusXor', ({ width = 8 }: { width?: number } = {}) => ({
  inputs: { a: bus(width), b: bus(width) },
  outputs: { out: bus(width) },
  meta: { category: 'bus-operations', icon: '⊕8', description: 'Bitwise XOR on buses' },
  eval: ({ a, b }) => ({ out: (a ^ b) >>> 0 }),
}));
