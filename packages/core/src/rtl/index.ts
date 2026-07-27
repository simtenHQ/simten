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

import { bit, bus, mem } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';
import type { BuiltCircuit } from '../circuit/types.js';

/** width===1 → bit port, else bus(width). Mirrors the std convention
 *  (Mux/Constant) so 1-bit nets stay `bit` end to end. */
const portOf = (width: number) => (width === 1 ? bit : bus(width));

const maskOf = (w: number) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;

/** Interpret an unsigned w-bit value as two's-complement signed. */
const sext = (v: number, w: number): number => {
  const u = v >>> 0;
  return u >= 2 ** (w - 1) ? u - 2 ** w : u;
};

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
 * Unsigned add with independent operand widths. `out = (a + b) mod 2^yWidth`.
 * Zero-extension is implicit (a narrower bus already has zero high bits), so
 * this covers yosys `$add` for any A_WIDTH/B_WIDTH/Y_WIDTH combination. Signed
 * operands do not reach here — yosys lowers sign extension into MSB replication
 * in the net array (handled by the importer's net-map), leaving `$add` unsigned.
 */
export const RtlAdd = circuit(
  'RtlAdd',
  ({
    aWidth = 8,
    bWidth = 8,
    yWidth = 8,
  }: {
    aWidth?: number;
    bWidth?: number;
    yWidth?: number;
  } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bus(yWidth) },
    eval: ({ a, b, yWidth: yw = yWidth }) => {
      const m = maskOf(yw as number);
      return { out: ((((a as number) >>> 0) + ((b as number) >>> 0)) & m) >>> 0 };
    },
    meta: { category: 'rtl-import', icon: '+', description: 'Unsigned add (independent widths)' },
  }),
);

/**
 * Unsigned subtract with independent operand widths. `out = (a - b) mod 2^yWidth`
 * (two's-complement wrap). Covers yosys `$sub` for any width combination.
 */
export const RtlSub = circuit(
  'RtlSub',
  ({
    aWidth = 8,
    bWidth = 8,
    yWidth = 8,
  }: {
    aWidth?: number;
    bWidth?: number;
    yWidth?: number;
  } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bus(yWidth) },
    eval: ({ a, b, yWidth: yw = yWidth }) => {
      const m = maskOf(yw as number);
      return { out: ((((a as number) >>> 0) - ((b as number) >>> 0)) & m) >>> 0 };
    },
    meta: {
      category: 'rtl-import',
      icon: '−',
      description: 'Unsigned subtract (independent widths)',
    },
  }),
);

// ---------------------------------------------------------------------------
// Bitwise (elementwise, width-preserving). yosys $and/$or/$xor/$not.
// Operands zero-extend to Y_WIDTH implicitly (narrow buses have 0 high bits).
// ---------------------------------------------------------------------------

type BinOpts = { aWidth?: number; bWidth?: number; yWidth?: number };
type UnOpts = { aWidth?: number; yWidth?: number };
type CmpOpts = { aWidth?: number; bWidth?: number; aSigned?: number; bSigned?: number };

const bitwiseBin = (name: string, icon: string, op: (a: number, b: number) => number) =>
  circuit(name, ({ aWidth = 8, bWidth = 8, yWidth = 8 }: BinOpts = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bus(yWidth) },
    eval: ({ a, b, yWidth: yw = yWidth }) => ({
      out: (op((a as number) >>> 0, (b as number) >>> 0) & maskOf(yw as number)) >>> 0,
    }),
    meta: { category: 'rtl-import', icon, description: `Bitwise ${name}` },
  }));

export const RtlAnd = bitwiseBin('RtlAnd', '&', (a, b) => a & b);
export const RtlOr = bitwiseBin('RtlOr', '|', (a, b) => a | b);
export const RtlXor = bitwiseBin('RtlXor', '^', (a, b) => a ^ b);

export const RtlNot = circuit('RtlNot', ({ aWidth = 8, yWidth = 8 }: UnOpts = {}) => ({
  inputs: { a: bus(aWidth) },
  outputs: { out: bus(yWidth) },
  eval: ({ a, yWidth: yw = yWidth }) => ({
    out: (~((a as number) >>> 0) & maskOf(yw as number)) >>> 0,
  }),
  meta: { category: 'rtl-import', icon: '~', description: 'Bitwise NOT' },
}));

// ---------------------------------------------------------------------------
// Reductions (unary → 1 bit). yosys $reduce_or/_and/_xor/_bool.
// ---------------------------------------------------------------------------

const reduce = (name: string, icon: string, fn: (v: number, w: number) => number) =>
  circuit(name, ({ aWidth = 8 }: { aWidth?: number } = {}) => ({
    inputs: { a: bus(aWidth) },
    outputs: { out: bit },
    eval: ({ a, aWidth: aw = aWidth }) => ({ out: fn((a as number) >>> 0, aw as number) }),
    meta: { category: 'rtl-import', icon, description: name },
  }));

export const RtlReduceOr = reduce('RtlReduceOr', '|', (v) => (v !== 0 ? 1 : 0));
export const RtlReduceBool = reduce('RtlReduceBool', '≠0', (v) => (v !== 0 ? 1 : 0));
export const RtlReduceAnd = reduce('RtlReduceAnd', '&', (v, w) => (v === maskOf(w) ? 1 : 0));
export const RtlReduceXor = reduce('RtlReduceXor', '^', (v) => {
  let p = 0;
  for (let x = v; x; x >>>= 1) p ^= x & 1;
  return p;
});

// ---------------------------------------------------------------------------
// Logical (→ 1 bit). yosys $logic_and/$logic_or (binary), $logic_not (unary).
// ---------------------------------------------------------------------------

const logicBin = (name: string, icon: string, op: (a: boolean, b: boolean) => boolean) =>
  circuit(name, ({ aWidth = 8, bWidth = 8 }: { aWidth?: number; bWidth?: number } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bit },
    eval: ({ a, b }) => ({ out: op((a as number) >>> 0 !== 0, (b as number) >>> 0 !== 0) ? 1 : 0 }),
    meta: { category: 'rtl-import', icon, description: name },
  }));

export const RtlLogicAnd = logicBin('RtlLogicAnd', '&&', (a, b) => a && b);
export const RtlLogicOr = logicBin('RtlLogicOr', '||', (a, b) => a || b);

export const RtlLogicNot = circuit('RtlLogicNot', ({ aWidth = 8 }: { aWidth?: number } = {}) => ({
  inputs: { a: bus(aWidth) },
  outputs: { out: bit },
  eval: ({ a }) => ({ out: (a as number) >>> 0 === 0 ? 1 : 0 }),
  meta: { category: 'rtl-import', icon: '!', description: 'Logical NOT' },
}));

// ---------------------------------------------------------------------------
// Comparisons (→ 1 bit), signedness via numeric args. yosys $lt/$ge/$ne/…
// ---------------------------------------------------------------------------

const compare = (name: string, icon: string, cmp: (a: number, b: number) => boolean) =>
  circuit(name, ({ aWidth = 8, bWidth = 8 }: CmpOpts = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bit },
    eval: ({ a, b, aWidth: aw = aWidth, bWidth: bw = bWidth, aSigned = 0, bSigned = 0 }) => {
      const av = aSigned ? sext((a as number) >>> 0, aw as number) : (a as number) >>> 0;
      const bv = bSigned ? sext((b as number) >>> 0, bw as number) : (b as number) >>> 0;
      return { out: cmp(av, bv) ? 1 : 0 };
    },
    meta: { category: 'rtl-import', icon, description: name },
  }));

export const RtlLt = compare('RtlLt', '<', (a, b) => a < b);
export const RtlLe = compare('RtlLe', '≤', (a, b) => a <= b);
export const RtlGt = compare('RtlGt', '>', (a, b) => a > b);
export const RtlGe = compare('RtlGe', '≥', (a, b) => a >= b);
export const RtlNe = compare('RtlNe', '≠', (a, b) => a !== b);

// ---------------------------------------------------------------------------
// Shifts (dynamic amount b). yosys $shl/$shr (logical), $sshr (arithmetic).
// ---------------------------------------------------------------------------

export const RtlShl = circuit('RtlShl', ({ aWidth = 8, bWidth = 8, yWidth = 8 }: BinOpts = {}) => ({
  inputs: { a: bus(aWidth), b: bus(bWidth) },
  outputs: { out: bus(yWidth) },
  eval: ({ a, b, yWidth: yw = yWidth }) => ({
    out: ((((a as number) >>> 0) * 2 ** ((b as number) >>> 0)) & maskOf(yw as number)) >>> 0,
  }),
  meta: { category: 'rtl-import', icon: '≪', description: 'Logical shift left' },
}));

export const RtlShr = circuit('RtlShr', ({ aWidth = 8, bWidth = 8, yWidth = 8 }: BinOpts = {}) => ({
  inputs: { a: bus(aWidth), b: bus(bWidth) },
  outputs: { out: bus(yWidth) },
  eval: ({ a, b, yWidth: yw = yWidth }) => ({
    out: (((a as number) >>> ((b as number) >>> 0)) & maskOf(yw as number)) >>> 0,
  }),
  meta: { category: 'rtl-import', icon: '≫', description: 'Logical shift right' },
}));

export const RtlSshr = circuit(
  'RtlSshr',
  ({ aWidth = 8, bWidth = 8, yWidth = 8 }: BinOpts & { aSigned?: number } = {}) => ({
    inputs: { a: bus(aWidth), b: bus(bWidth) },
    outputs: { out: bus(yWidth) },
    eval: ({ a, b, aWidth: aw = aWidth, yWidth: yw = yWidth }) => {
      const sv = sext((a as number) >>> 0, aw as number);
      return { out: ((sv >> ((b as number) >>> 0)) & maskOf(yw as number)) >>> 0 };
    },
    meta: { category: 'rtl-import', icon: '≫ₛ', description: 'Arithmetic shift right' },
  }),
);

/**
 * Parallel (one-hot) mux. `s` is a one-hot select of width `sWidth`; `b` packs
 * `sWidth` candidates of `width` bits each. Output is the candidate whose `s`
 * bit is set (lowest index wins if several), else the default `a`.
 */
export function Pmux(opts: { width: number; sWidth: number }): BuiltCircuit {
  const { width, sWidth } = opts;
  const name = `Pmux_${width}w_${sWidth}s`;
  // Per-lane candidate ports (b_0..b_{sWidth-1}), each ≤ width bits — NOT one
  // packed `width*sWidth` port, which would exceed simten's 32-bit buses (a
  // 10-way 32-bit mux packs to 320 bits). The importer slices yosys's packed B
  // bit-array into these lanes.
  const inputs: Record<string, ReturnType<typeof bus>> = { a: bus(width), s: bus(sWidth) };
  for (let i = 0; i < sWidth; i++) inputs[`b_${i}`] = bus(width);
  return circuit(name, {
    inputs,
    outputs: { out: bus(width) },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic per-lane port access
    eval: (io: any) => {
      // Shape read from io first (node.arguments merge into eval inputs), with the
      // factory value as fallback for direct use. The editor sandbox rebuilds evals
      // via new Function(fn.toString()), dropping closures — but imported nodes
      // always carry these args, so `??` short-circuits to io before the lost
      // closure is referenced. Mask inlined (module-scope maskOf isn't in scope).
      const sw = (io.sWidth ?? sWidth) as number;
      const w = (io.width ?? width) as number;
      const mask = w >= 32 ? 0xffffffff : ((1 << w) - 1) >>> 0;
      const sv = (io.s as number) >>> 0;
      for (let i = 0; i < sw; i++) {
        if ((sv >>> i) & 1) return { out: ((io[`b_${i}`] as number) >>> 0) & mask };
      }
      return { out: ((io.a as number) >>> 0) & mask };
    },
    meta: { category: 'rtl-import', icon: '⇉', description: 'Parallel one-hot mux' },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic inputs shape
  } as any) as unknown as BuiltCircuit;
}

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

/**
 * Level-sensitive D-latch. yosys `$dlatch`: transparent (Q follows D) while EN
 * matches `enPolarity`, holds otherwise. Often an *inferred* latch from an
 * incompletely-assigned combinational `always` block — common in real RTL.
 *
 * Shape-parameterized (width + polarity baked into the name and closure) rather
 * than arg-driven — same pattern as Mem/Pmux.
 */
export function Dlatch(opts: { width: number; enPolarity: number }): BuiltCircuit {
  const { width, enPolarity } = opts;
  const name = `Dlatch_${width}w_ep${enPolarity}`;
  return circuit(name, {
    inputs: { en: bit, d: bus(width) },
    outputs: { q: bus(width) },
    state: { hold: 0 },
    // Shape read from io first, factory value as fallback for direct use — the
    // editor sandbox rebuilds evals via new Function(fn.toString()), dropping
    // closures (and maskOf), so io (present on imported nodes) is what works there.
    // biome-ignore lint/suspicious/noExplicitAny: dynamic state access
    eval: (io: any) => {
      const w = (io.width ?? width) as number;
      const mask = w >= 32 ? 0xffffffff : ((1 << w) - 1) >>> 0;
      const transparent = (io.en & 1) === ((io.enPolarity ?? enPolarity) as number);
      return { q: ((transparent ? io.d : io.hold) >>> 0) & mask };
    },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic state access
    onTick: (io: any) => {
      const transparent = (io.en & 1) === ((io.enPolarity ?? enPolarity) as number);
      return { hold: transparent ? io.d : io.hold };
    },
    meta: { category: 'rtl-import', icon: 'DL', description: 'D-latch (level-sensitive)' },
    // biome-ignore lint/suspicious/noExplicitAny: fixed-shape config
  } as any) as unknown as BuiltCircuit;
}

// ---------------------------------------------------------------------------
// Multi-port memory. yosys $mem_v2 (async read; sync write; per-bit write EN).
// ---------------------------------------------------------------------------

/**
 * Shape-parameterized multi-port memory backing yosys `$mem_v2`.
 *
 * The primitive name encodes the shape (read/write port counts, address/data
 * widths, depth) so every instance of a shape shares a fixed set of port names
 * — the eval registry keys behaviour by name. Ports are per-lane and narrow
 * (`rd_addr_i`, `wr_addr_i`, `wr_data_i`, `wr_en_i`, `rd_data_i`), so the
 * importer slices yosys's wide packed `RD_ADDR`/`WR_DATA`/… bit arrays into
 * lanes rather than materializing a >32-bit port.
 *
 * Modeled: async (combinational) reads; synchronous writes on the shared sim
 * clock with per-bit write-enable; write ports applied in index order (later
 * wins on overlap). Not modeled: read clocking/reset, read-during-write
 * transparency, per-port priority masks — none are exercised by the RV32I core
 * (all reads async, no transparency). Memory starts zero (correct for a
 * zero-init register file); `$meminit` data is not yet applied.
 */
export function Mem(opts: {
  rdPorts: number;
  wrPorts: number;
  abits: number;
  width: number;
  size: number;
}): BuiltCircuit {
  const { rdPorts, wrPorts, abits, width, size } = opts;
  const addrW = Math.max(1, Math.ceil(Math.log2(Math.max(2, size))));
  const depth = 1 << addrW;
  const name = `Mem_${rdPorts}r${wrPorts}w_${abits}a_${width}w_${depth}d`;

  const inputs: Record<string, ReturnType<typeof bus>> = {};
  const outputs: Record<string, ReturnType<typeof bus>> = {};
  for (let i = 0; i < rdPorts; i++) {
    inputs[`rd_addr_${i}`] = bus(abits);
    outputs[`rd_data_${i}`] = bus(width);
  }
  for (let i = 0; i < wrPorts; i++) {
    inputs[`wr_addr_${i}`] = bus(abits);
    inputs[`wr_data_${i}`] = bus(width);
    inputs[`wr_en_${i}`] = bus(width);
  }

  // Direct (non-factory) form: ports/shape are fixed for this name, so the
  // config closes over them. Registration is idempotent for a repeated shape.
  return circuit(name, {
    inputs,
    outputs,
    state: { store: mem(depth, width) },
    // Shape read from io first, factory values as fallback for direct use — the
    // editor sandbox rebuilds evals via new Function(fn.toString()), dropping
    // closures (and maskOf), so io (present on imported nodes) is what works there.
    // Address mask is depth-1 (memory wraps to its allocated depth); depth is
    // recomputed from size inline so nothing closure-scoped is referenced.
    // biome-ignore lint/suspicious/noExplicitAny: dynamic per-lane port access
    eval: (io: any) => {
      const rd = (io.rdPorts ?? rdPorts) as number;
      const sz = (io.size ?? size) as number;
      const amsk = (1 << Math.max(1, Math.ceil(Math.log2(Math.max(2, sz))))) - 1;
      const store = io.store;
      const out: Record<string, number> = {};
      for (let i = 0; i < rd; i++) {
        const a = ((io[`rd_addr_${i}`] as number) >>> 0) & amsk;
        out[`rd_data_${i}`] = (store[a] ?? 0) >>> 0;
      }
      return out;
    },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic per-lane port access
    onTick: (io: any) => {
      const wr = (io.wrPorts ?? wrPorts) as number;
      const sz = (io.size ?? size) as number;
      const amsk = (1 << Math.max(1, Math.ceil(Math.log2(Math.max(2, sz))))) - 1;
      const dw = (io.width ?? width) as number;
      const dmsk = dw >= 32 ? 0xffffffff : ((1 << dw) - 1) >>> 0;
      const store = io.store;
      for (let i = 0; i < wr; i++) {
        const en = (io[`wr_en_${i}`] as number) >>> 0;
        if (en === 0) continue;
        const a = ((io[`wr_addr_${i}`] as number) >>> 0) & amsk;
        const d = (io[`wr_data_${i}`] as number) >>> 0;
        const cur = (store[a] ?? 0) >>> 0;
        store[a] = (((cur & ~en) | (d & en)) & dmsk) >>> 0;
      }
      return { store };
    },
    meta: { category: 'rtl-import', icon: 'MEM', description: 'Multi-port memory' },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic inputs/outputs shape
  } as any) as unknown as BuiltCircuit;
}
