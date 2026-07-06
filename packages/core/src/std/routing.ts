/**
 * Standard Library — Routing / Plexers / Utilities
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

/**
 * Multiplexer — sel=0 picks in0, sel=1 picks in1. The fundamental
 * conditional in hardware: route one of N signals onto a single output.
 *
 * **Inputs:** `in0`, `in1`, `sel` — `bit`
 * **Output:** `out` — `bit`
 *
 * **Example:** if-then-else as a circuit
 * ```ts
 * circuit('IfThenElse', {
 *   inputs:  { cond: bit, thenVal: bit, elseVal: bit },
 *   outputs: { result: bit },
 *   nodes:   { m: Mux },
 *   connect: ({ inputs, outputs, nodes: { m } }) => [
 *     inputs.elseVal.to(m.in0),
 *     inputs.thenVal.to(m.in1),
 *     inputs.cond.to(m.sel),
 *     m.out.to(outputs.result),
 *   ],
 * })
 * ```
 */
export const Mux = circuit('Mux', ({ width = 1 }: { width?: number } = {}) => ({
  inputs: { in0: width === 1 ? bit : bus(width), in1: width === 1 ? bit : bus(width), sel: bit },
  outputs: { out: width === 1 ? bit : bus(width) },
  meta: {
    category: 'plexers',
    icon: 'MUX',
    description: 'Multiplexer — sel=0 picks in0, sel=1 picks in1',
  },
  eval: ({ in0, in1, sel }) => ({ out: sel ? in1 : in0 }),
}));

/**
 * 2-to-4 decoder. Activates exactly one of four outputs based on the
 * 2-bit input — the inverse of a 4-to-1 mux. Useful for memory chip-select
 * lines and one-hot state decoding.
 *
 * **Input:** `in` — `bus(2)`
 * **Outputs:** `out0`, `out1`, `out2`, `out3` — `bit` (one-hot)
 *
 * ```
 *  in | out3 out2 out1 out0
 *   0 |   0    0    0    1
 *   1 |   0    0    1    0
 *   2 |   0    1    0    0
 *   3 |   1    0    0    0
 * ```
 *
 * **Example:**
 * ```ts
 * circuit('Select4', {
 *   inputs:  { which: bus(2) },
 *   outputs: { sel0: bit, sel1: bit, sel2: bit, sel3: bit },
 *   nodes:   { d: Decoder },
 *   connect: ({ inputs, outputs, nodes: { d } }) => [
 *     inputs.which.to(d.in),
 *     d.out0.to(outputs.sel0),
 *     d.out1.to(outputs.sel1),
 *     d.out2.to(outputs.sel2),
 *     d.out3.to(outputs.sel3),
 *   ],
 * })
 * ```
 */
export const Decoder = circuit('Decoder', {
  inputs: { in: bus(2) },
  outputs: { out0: bit, out1: bit, out2: bit, out3: bit },
  meta: { category: 'plexers', icon: 'DEC', description: '2-to-4 decoder' },
  eval: ({ in: val }) => ({
    out0: val === 0 ? 1 : 0,
    out1: val === 1 ? 1 : 0,
    out2: val === 2 ? 1 : 0,
    out3: val === 3 ? 1 : 0,
  }),
});

/**
 * Bus splitter. Splits an 8-bit bus into two 4-bit halves — `out0` is the
 * low nibble (bits 0..3), `out1` is the high nibble (bits 4..7).
 *
 * **Input:** `in` — `bus(8)`
 * **Outputs:** `out0`, `out1` — `bus(4)`
 *
 * **Example:** access high and low nibbles separately
 * ```ts
 * circuit('Nibbles', {
 *   inputs:  { byte: bus(8) },
 *   outputs: { lo: bus(4), hi: bus(4) },
 *   nodes:   { s: Splitter },
 *   connect: ({ inputs, outputs, nodes: { s } }) => [
 *     inputs.byte.to(s.in),
 *     s.out0.to(outputs.lo),
 *     s.out1.to(outputs.hi),
 *   ],
 * })
 * ```
 */
export const Splitter = circuit('Splitter', {
  inputs: { in: bus(8) },
  outputs: { out0: bus(4), out1: bus(4) },
  meta: { category: 'utilities', icon: '⊢', description: 'Bus splitter' },
  eval: ({ in: val }) => ({ out0: val & 0xf, out1: (val >> 4) & 0xf }),
});

/**
 * Splits 8-bit bus into 8 individual bits. `bit0` is the LSB; `bit7` is
 * the MSB. The inverse of `Combiner8to8`.
 *
 * **Input:** `in` — `bus(8)`
 * **Outputs:** `bit0`..`bit7` — `bit`
 *
 * **Example:** route specific bit positions onto LEDs
 * ```ts
 * circuit('ByteToLeds', {
 *   inputs:  { value: bus(8) },
 *   outputs: { led0: bit, led7: bit },
 *   nodes:   { s: Splitter8to8 },
 *   connect: ({ inputs, outputs, nodes: { s } }) => [
 *     inputs.value.to(s.in),
 *     s.bit0.to(outputs.led0),
 *     s.bit7.to(outputs.led7),
 *   ],
 * })
 * ```
 */
export const Splitter8to8 = circuit('Splitter8to8', {
  inputs: { in: bus(8) },
  outputs: {
    bit0: bit,
    bit1: bit,
    bit2: bit,
    bit3: bit,
    bit4: bit,
    bit5: bit,
    bit6: bit,
    bit7: bit,
  },
  meta: {
    category: 'utilities',
    icon: '⊢8',
    description: 'Splits 8-bit bus into 8 individual bits',
  },
  eval: ({ in: val }) => ({
    bit0: (val >> 0) & 1,
    bit1: (val >> 1) & 1,
    bit2: (val >> 2) & 1,
    bit3: (val >> 3) & 1,
    bit4: (val >> 4) & 1,
    bit5: (val >> 5) & 1,
    bit6: (val >> 6) & 1,
    bit7: (val >> 7) & 1,
  }),
});

/**
 * Combines 8 bits into an 8-bit bus. `bit0` becomes the LSB; `bit7`
 * becomes the MSB. The inverse of `Splitter8to8`.
 *
 * **Inputs:** `bit0`..`bit7` — `bit`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:** assemble a byte from 8 switches
 * ```ts
 * circuit('Pack', {
 *   inputs:  { s0: bit, s1: bit, s2: bit, s3: bit, s4: bit, s5: bit, s6: bit, s7: bit },
 *   outputs: { byte: bus(8) },
 *   nodes:   { c: Combiner8to8 },
 *   connect: ({ inputs, outputs, nodes: { c } }) => [
 *     inputs.s0.to(c.bit0), inputs.s1.to(c.bit1),
 *     inputs.s2.to(c.bit2), inputs.s3.to(c.bit3),
 *     inputs.s4.to(c.bit4), inputs.s5.to(c.bit5),
 *     inputs.s6.to(c.bit6), inputs.s7.to(c.bit7),
 *     c.out.to(outputs.byte),
 *   ],
 * })
 * ```
 */
export const Combiner8to8 = circuit('Combiner8to8', {
  inputs: {
    bit0: bit,
    bit1: bit,
    bit2: bit,
    bit3: bit,
    bit4: bit,
    bit5: bit,
    bit6: bit,
    bit7: bit,
  },
  outputs: { out: bus(8) },
  meta: { category: 'utilities', icon: '⊣8', description: 'Combines 8 bits into an 8-bit bus' },
  eval: ({ bit0, bit1, bit2, bit3, bit4, bit5, bit6, bit7 }) => ({
    out:
      (bit0 & 1) |
      ((bit1 & 1) << 1) |
      ((bit2 & 1) << 2) |
      ((bit3 & 1) << 3) |
      ((bit4 & 1) << 4) |
      ((bit5 & 1) << 5) |
      ((bit6 & 1) << 6) |
      ((bit7 & 1) << 7),
  }),
});

/**
 * Concatenate two buses. Builds an 8-bit value from a 4-bit `high` nibble
 * and a 4-bit `low` nibble: `out = (high << 4) | low`.
 *
 * **Inputs:** `high`, `low` — `bus(4)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:**
 * ```ts
 * circuit('JoinNibbles', {
 *   inputs:  { lo: bus(4), hi: bus(4) },
 *   outputs: { byte: bus(8) },
 *   nodes:   { c: Concat },
 *   connect: ({ inputs, outputs, nodes: { c } }) => [
 *     inputs.hi.to(c.high),
 *     inputs.lo.to(c.low),
 *     c.out.to(outputs.byte),
 *   ],
 * })
 * ```
 */
export const Concat = circuit('Concat', {
  inputs: { high: bus(4), low: bus(4) },
  outputs: { out: bus(8) },
  meta: { category: 'utilities', icon: '||', description: 'Concatenate two buses' },
  eval: ({ high, low }) => ({ out: (high << 4) | low }),
});

/**
 * Extract bits [low..high] from input. A pass-through identity in the
 * default eval; the actual slice range is configured per instance via the
 * canvas inspector or by passing arguments to the node when used in a
 * larger circuit.
 *
 * **Input:** `in` — `bus(8)`
 * **Output:** `out` — `bus(8)`
 *
 * **Example:**
 * ```ts
 * circuit('Slice', {
 *   inputs:  { value: bus(8) },
 *   outputs: { result: bus(8) },
 *   nodes:   { s: BitSlice },
 *   connect: ({ inputs, outputs, nodes: { s } }) => [
 *     inputs.value.to(s.in),
 *     s.out.to(outputs.result),
 *   ],
 * })
 * ```
 */
export const BitSlice = circuit('BitSlice', (_opts?: { low?: number; high?: number }) => ({
  inputs: { in: bus(8) },
  outputs: { out: bus(8) },
  meta: { category: 'utilities', icon: '[]', description: 'Extract bits [low..high] from input' },
  // `low` / `high` come from node.arguments via the bridge merge — must be
  // read from inputs at eval time, not closed over (factory args bake one
  // pair into the registered closure regardless of per-instance values).
  eval: ({ in: val, low = 0, high = 7 }) => {
    const lo = low as number;
    const hi = high as number;
    const numBits = hi - lo + 1;
    const mask = numBits >= 32 ? 0xffffffff : (1 << numBits) - 1;
    return { out: ((val as number) >> lo) & mask };
  },
}));

/**
 * Combines two 8-bit buses into 16-bit. `hi` is the high byte, `lo` is
 * the low byte: `out = (hi << 8) | lo`. Typical use is forming a 16-bit
 * address from two 8-bit address registers.
 *
 * **Inputs:** `lo`, `hi` — `bus(8)`
 * **Output:** `out` — `bus(16)`
 *
 * **Example:**
 * ```ts
 * circuit('FormAddress', {
 *   inputs:  { addrLo: bus(8), addrHi: bus(8) },
 *   outputs: { addr: bus(16) },
 *   nodes:   { c: AddressCombiner },
 *   connect: ({ inputs, outputs, nodes: { c } }) => [
 *     inputs.addrLo.to(c.lo),
 *     inputs.addrHi.to(c.hi),
 *     c.out.to(outputs.addr),
 *   ],
 * })
 * ```
 */
export const AddressCombiner = circuit('AddressCombiner', {
  inputs: { lo: bus(8), hi: bus(8) },
  outputs: { out: bus(16) },
  meta: { category: 'utilities', icon: '⊕16', description: 'Combines two 8-bit buses into 16-bit' },
  eval: ({ lo, hi }) => ({ out: ((hi & 0xff) << 8) | (lo & 0xff) }),
});

/**
 * Debug observation point. Passes the signal through unchanged but
 * provides a named point in the schematic for inspection — the canvas
 * surfaces probe values without affecting circuit behavior.
 *
 * **Input:** `in` — `bit`
 * **Output:** `out` — `bit`
 *
 * **Example:** observe an intermediate carry signal
 * ```ts
 * circuit('WithProbe', {
 *   inputs:  { a: bit, b: bit },
 *   outputs: { result: bit },
 *   nodes:   { g: And, p: Probe },
 *   connect: ({ inputs, outputs, nodes: { g, p } }) => [
 *     inputs.a.to(g.a),
 *     inputs.b.to(g.b),
 *     g.out.to(p.in),
 *     p.out.to(outputs.result),
 *   ],
 * })
 * ```
 */
export const Probe = circuit('Probe', {
  inputs: { in: bit },
  outputs: { out: bit },
  meta: { category: 'utilities', icon: '🔍', description: 'Debug observation point' },
  eval: ({ in: val }) => ({ out: val }),
});
