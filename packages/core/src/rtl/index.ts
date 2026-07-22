/**
 * RTL import primitives (`@simten/core/rtl`)
 *
 * Low-level cells that back the Verilog-import path. They are NOT part of the
 * curated authoring stdlib — they exist so an imported netlist's bit-vector
 * wiring can be reconstructed as real, simulatable simten nodes:
 *
 *   - `RtlSlice`  — extract a sub-range [offset, offset+width) of a bus.
 *   - `RtlConcat2` — concatenate two parts (lo in the low bits, hi above).
 *
 * N-way concatenation and sign-extension (MSB replication) are expressed as a
 * fold of `RtlConcat2`, so every instance shares a fixed set of port NAMES
 * (`in`/`out`, `hi`/`lo`/`out`) — a hard requirement of the eval registry,
 * which keys behaviour by circuit name and varies only widths per instance
 * (same contract as `Adder`/`Register` in std).
 *
 * Names contain no `$`: `sanitizeId` in verilog/exporter.ts strips non-word
 * chars, so a `$`-named primitive would silently collide on export.
 *
 * IMPORTANT: importing this module registers these primitives via the
 * `circuit()` side effect. `packages/core/package.json` marks `./src/rtl/**`
 * as having side effects so bundlers cannot drop that registration.
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';

/** width===1 → bit port, else bus(width). Mirrors the std convention
 *  (Mux/Constant) so 1-bit nets stay `bit` end to end. */
const portOf = (width: number) => (width === 1 ? bit : bus(width));

const maskOf = (w: number) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;

/**
 * Bus sub-range extract. `out = (in >> offset) & ((1<<width)-1)`.
 *
 * Structural args (read from node.arguments, same mechanism as Adder's
 * `width`): `inWidth`, `offset`, `width`.
 */
export const RtlSlice = circuit(
  'RtlSlice',
  ({ inWidth = 8, width = 1 }: { inWidth?: number; offset?: number; width?: number } = {}) => ({
    inputs: { in: bus(inWidth) },
    outputs: { out: portOf(width) },
    eval: ({ in: v, offset: off = 0, width: w = width }) => {
      const off2 = (off as number) | 0;
      const w2 = (w as number) | 0;
      return { out: (((v as number) >>> off2) & maskOf(w2)) >>> 0 };
    },
    meta: { category: 'rtl-import', icon: '⊂', description: 'Bus sub-range extract' },
  }),
);

/**
 * Two-part concatenation. `out = (hi << loWidth) | lo` — `lo` occupies the low
 * bits, `hi` sits above it, matching Verilog `{hi, lo}` and yosys's LSB-first
 * bit arrays. Fold this for N-way concat and for sign-extension.
 */
export const RtlConcat2 = circuit(
  'RtlConcat2',
  ({ hiWidth = 4, loWidth = 4 }: { hiWidth?: number; loWidth?: number } = {}) => ({
    inputs: { hi: portOf(hiWidth), lo: portOf(loWidth) },
    outputs: { out: bus(hiWidth + loWidth) },
    eval: ({ hi, lo, loWidth: lw = loWidth }) => {
      const lw2 = (lw as number) | 0;
      const out = (((hi as number) >>> 0) * 2 ** lw2 + ((lo as number) >>> 0)) >>> 0;
      return { out };
    },
    meta: { category: 'rtl-import', icon: '⊃', description: 'Two-part bus concatenation' },
  }),
);
