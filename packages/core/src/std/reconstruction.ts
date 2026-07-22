/**
 * Standard Library — Bit-manipulation / reconstruction
 *
 * Parameterized bit-wiring components an HDL author writes directly — a slice
 * (`x[hi:lo]`), a sign/zero widening (`$signed(x)`, `{{N{1'b0}}, x}`). They are
 * the *authored-construct* side of the Verilog importer's reconstruction: when
 * a netlist's bit vectors are turned back into named-port connections, these
 * replace the internal `RtlSlice`/`RtlConcat2` plumbing so generated source is
 * clean and editable (see import/component-homes.ts for the classification).
 *
 * Every instance shares a fixed set of port NAMES (`in`/`out`), varying only
 * widths per instance — the eval registry keys behaviour by circuit name, so
 * structural args (`inWidth`/`offset`/`width`/`outWidth`) are read from the eval
 * input bag (fed from node.arguments by the bridge merge), never closed over.
 * Same contract as `Adder`/`Register`.
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

/** width===1 → bit port, else bus(width). Mirrors the Mux/Constant convention. */
const portOf = (width: number) => (width === 1 ? bit : bus(width));

const maskOf = (w: number) => ((w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0);

/** Interpret an unsigned w-bit value as two's-complement signed. */
const sext = (v: number, w: number): number => {
  const u = v >>> 0;
  return u >= 2 ** (w - 1) ? u - 2 ** w : u;
};

/**
 * Bus sub-range extract (in[offset +: width]) — reads bits
 * `[offset, offset+width)` of an `inWidth`-bit input.
 *
 * **Input:** `in` — `bus(inWidth)`
 * **Output:** `out` — `bus(width)` (or `bit` when `width === 1`)
 * **Args:** `inWidth`, `offset`, `width`
 *
 * e.g. `Slice({ inWidth: 32, offset: 0, width: 7 })` — the low 7 bits (RV32I opcode).
 */
export const Slice = circuit(
  'Slice',
  ({ inWidth = 8, width = 1 }: { inWidth?: number; offset?: number; width?: number } = {}) => ({
    inputs: { in: bus(inWidth) },
    outputs: { out: portOf(width) },
    eval: ({ in: v, offset: off = 0, width: w = width }) => ({
      out: (((v as number) >>> ((off as number) | 0)) & maskOf((w as number) | 0)) >>> 0,
    }),
    meta: { category: 'utilities', icon: '⊂', description: 'Bus sub-range extract (in[offset +: width])' },
  }),
);

/**
 * Sign extension (replicate MSB) — widen a two's-complement value by
 * replicating its sign bit. `out = $signed(in)` in `outWidth` bits. The single
 * clean node that replaces yosys's MSB-replication splice (a run of the input
 * followed by `outWidth - inWidth` copies of the top bit).
 *
 * **Input:** `in` — `bus(inWidth)`
 * **Output:** `out` — `bus(outWidth)`
 * **Args:** `inWidth`, `outWidth`
 *
 * e.g. `SignExtend({ inWidth: 12, outWidth: 32 })` — a 12-bit immediate to 32 bits.
 */
export const SignExtend = circuit(
  'SignExtend',
  ({ inWidth = 8, outWidth = 16 }: { inWidth?: number; outWidth?: number } = {}) => ({
    inputs: { in: bus(inWidth) },
    outputs: { out: bus(outWidth) },
    eval: ({ in: v, inWidth: iw = inWidth, outWidth: ow = outWidth }) => ({
      out: (sext((v as number) >>> 0, iw as number) & maskOf(ow as number)) >>> 0,
    }),
    meta: { category: 'utilities', icon: '±⊳', description: 'Sign extension (replicate MSB)' },
  }),
);

/**
 * Zero extension (pad high bits with 0) — widen an unsigned value.
 * `out = {{(outWidth-inWidth){1'b0}}, in}`. Value is unchanged; only the bus
 * width grows. Replaces the yosys zero-pad splice (a run concatenated above a
 * zero constant).
 *
 * **Input:** `in` — `bus(inWidth)`
 * **Output:** `out` — `bus(outWidth)`
 * **Args:** `inWidth`, `outWidth`
 *
 * e.g. `ZeroExtend({ inWidth: 8, outWidth: 32 })` — an 8-bit byte to a 32-bit word.
 */
export const ZeroExtend = circuit(
  'ZeroExtend',
  ({ inWidth = 8, outWidth = 16 }: { inWidth?: number; outWidth?: number } = {}) => ({
    inputs: { in: bus(inWidth) },
    outputs: { out: bus(outWidth) },
    eval: ({ in: v, inWidth: iw = inWidth }) => ({
      out: ((v as number) >>> 0) & maskOf(iw as number),
    }),
    meta: { category: 'utilities', icon: '0⊳', description: 'Zero extension (pad high bits with 0)' },
  }),
);
