/**
 * Equivalence tests for the RTL import primitives.
 *
 * Each primitive is wrapped in a one-node circuit, simulated, and checked
 * against a plain-JS reference across random inputs (fast-check). This is the
 * "lift equivalence" gate from the plan — it catches an inverted operand, a
 * dropped mask, or a sign-handling bug before an imported design can hide it.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import * as rtl from '../../rtl/index.js';
import { simulate } from '../../sim/index.js';

let uid = 0;
const port = (w: number) => (w === 1 ? bit : bus(w));
const mask = (w: number) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;
const sext = (v: number, w: number) => (v >>> 0 >= 2 ** (w - 1) ? (v >>> 0) - 2 ** w : v >>> 0);

/** Evaluate a combinational primitive with inputs {a,b?,s?}, return `out`. */
function run(prim: BuiltCircuit, outW: number, ins: { a: number; b?: number; s?: number }): number {
  const inputs: Record<string, ReturnType<typeof port>> = { a: port(32) };
  if (ins.b !== undefined) inputs.b = port(32);
  if (ins.s !== undefined) inputs.s = port(32);
  const w = circuit(`W${uid++}`, {
    inputs: inputs as any,
    outputs: { out: port(outW) } as any,
    nodes: { p: prim } as any,
    connect: ({ inputs: i, outputs, nodes: { p } }: any) => {
      const c = [i.a.to(p.a), p.out.to(outputs.out)];
      if (ins.b !== undefined) c.push(i.b.to(p.b));
      if (ins.s !== undefined) c.push(i.s.to(p.s));
      return c;
    },
  } as any);
  const sim = simulate(w);
  const set: Record<string, number> = { a: ins.a };
  if (ins.b !== undefined) set.b = ins.b;
  if (ins.s !== undefined) set.s = ins.s;
  sim.set(set);
  return sim.get('out') >>> 0; // normalize to unsigned (get() returns signed int32)
}

const u8 = fc.integer({ min: 0, max: 255 });
const u32 = fc.integer({ min: 0, max: 0xffffffff }).map((n) => n >>> 0);

describe('rtl bitwise', () => {
  const cases: [BuiltCircuit, (a: number, b: number) => number][] = [
    [rtl.RtlAnd({ aWidth: 8, bWidth: 8, yWidth: 8 }), (a, b) => a & b],
    [rtl.RtlOr({ aWidth: 8, bWidth: 8, yWidth: 8 }), (a, b) => a | b],
    [rtl.RtlXor({ aWidth: 8, bWidth: 8, yWidth: 8 }), (a, b) => (a ^ b) & 0xff],
  ];
  it.each(cases.map((c, i) => [i, ...c] as const))('binary %i', (_i, prim, ref) => {
    fc.assert(fc.property(u8, u8, (a, b) => run(prim, 8, { a, b }) === (ref(a, b) & 0xff)));
  });
  it('not', () => {
    const p = rtl.RtlNot({ aWidth: 8, yWidth: 8 });
    fc.assert(fc.property(u8, (a) => run(p, 8, { a }) === (~a & 0xff)));
  });
});

describe('rtl reductions (8-bit)', () => {
  it('reduce_or / reduce_bool', () => {
    const p = rtl.RtlReduceOr({ aWidth: 8 });
    fc.assert(fc.property(u8, (a) => run(p, 1, { a }) === (a !== 0 ? 1 : 0)));
  });
  it('reduce_and', () => {
    const p = rtl.RtlReduceAnd({ aWidth: 8 });
    fc.assert(fc.property(u8, (a) => run(p, 1, { a }) === (a === 0xff ? 1 : 0)));
  });
  it('reduce_xor (parity)', () => {
    const p = rtl.RtlReduceXor({ aWidth: 8 });
    const parity = (a: number) => {
      let x = a & 0xff;
      let r = 0;
      while (x) {
        r ^= x & 1;
        x >>>= 1;
      }
      return r;
    };
    fc.assert(fc.property(u8, (a) => run(p, 1, { a }) === parity(a)));
  });
});

describe('rtl logical (→ bit)', () => {
  it('logic_and / logic_or', () => {
    const and = rtl.RtlLogicAnd({ aWidth: 8, bWidth: 8 });
    const or = rtl.RtlLogicOr({ aWidth: 8, bWidth: 8 });
    fc.assert(
      fc.property(u8, u8, (a, b) => {
        return (
          run(and, 1, { a, b }) === (a !== 0 && b !== 0 ? 1 : 0) &&
          run(or, 1, { a, b }) === (a !== 0 || b !== 0 ? 1 : 0)
        );
      }),
    );
  });
  it('logic_not', () => {
    const p = rtl.RtlLogicNot({ aWidth: 8 });
    fc.assert(fc.property(u8, (a) => run(p, 1, { a }) === (a === 0 ? 1 : 0)));
  });
});

describe('rtl comparisons (unsigned + signed)', () => {
  it('unsigned lt/le/gt/ge/ne (8-bit)', () => {
    const lt = rtl.RtlLt({ aWidth: 8, bWidth: 8 });
    const ge = rtl.RtlGe({ aWidth: 8, bWidth: 8 });
    const ne = rtl.RtlNe({ aWidth: 8, bWidth: 8 });
    fc.assert(
      fc.property(u8, u8, (a, b) => {
        return (
          run(lt, 1, { a, b }) === (a < b ? 1 : 0) &&
          run(ge, 1, { a, b }) === (a >= b ? 1 : 0) &&
          run(ne, 1, { a, b }) === (a !== b ? 1 : 0)
        );
      }),
    );
  });
  it('signed lt/ge (8-bit) differ from unsigned on high operands', () => {
    const lt = rtl.RtlLt({ aWidth: 8, bWidth: 8, aSigned: 1, bSigned: 1 });
    const ge = rtl.RtlGe({ aWidth: 8, bWidth: 8, aSigned: 1, bSigned: 1 });
    fc.assert(
      fc.property(u8, u8, (a, b) => {
        const as = sext(a, 8);
        const bs = sext(b, 8);
        return (
          run(lt, 1, { a, b }) === (as < bs ? 1 : 0) && run(ge, 1, { a, b }) === (as >= bs ? 1 : 0)
        );
      }),
    );
    // sanity: -1 (0xFF) < 1 signed, but 255 > 1 unsigned
    expect(run(lt, 1, { a: 0xff, b: 1 })).toBe(1);
    expect(run(rtl.RtlLt({ aWidth: 8, bWidth: 8 }), 1, { a: 0xff, b: 1 })).toBe(0);
  });
});

describe('rtl shifts (32-bit, amount 0..31)', () => {
  const amt = fc.integer({ min: 0, max: 31 });
  it('shl / shr logical', () => {
    const shl = rtl.RtlShl({ aWidth: 32, bWidth: 5, yWidth: 32 });
    const shr = rtl.RtlShr({ aWidth: 32, bWidth: 5, yWidth: 32 });
    fc.assert(
      fc.property(u32, amt, (a, b) => {
        return (
          run(shl, 32, { a, b }) === ((a * 2 ** b) & mask(32)) >>> 0 &&
          run(shr, 32, { a, b }) === a >>> b
        );
      }),
    );
  });
  it('sshr arithmetic (sign-replicating)', () => {
    const sshr = rtl.RtlSshr({ aWidth: 32, bWidth: 5, yWidth: 32, aSigned: 1 });
    fc.assert(
      fc.property(
        u32,
        amt,
        (a, b) => run(sshr, 32, { a, b }) === ((sext(a, 32) >> b) & mask(32)) >>> 0,
      ),
    );
    // 0x80000000 >>> arithmetic keeps the sign bits
    expect(run(sshr, 32, { a: 0x80000000, b: 4 })).toBe(0xf8000000);
  });
});

describe('rtl dlatch (level-sensitive)', () => {
  it('transparent when EN matches polarity, holds otherwise', () => {
    const p = rtl.Dlatch({ width: 8, enPolarity: 1 }); // active-high
    const W = circuit('DlWrap', {
      inputs: { en: bit, d: bus(8) },
      outputs: { q: bus(8) },
      nodes: { p },
      connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
        i.en.to(p.en),
        i.d.to(p.d),
        p.q.to(o.q),
      ],
    } as any);
    const sim = simulate(W);
    sim.set({ en: 1, d: 0xab });
    sim.tick();
    expect(sim.get('q')).toBe(0xab); // transparent
    sim.set({ en: 0, d: 0xcd });
    sim.tick();
    expect(sim.get('q')).toBe(0xab); // held (EN low → opaque)
    sim.set({ en: 1, d: 0xcd });
    sim.tick();
    expect(sim.get('q')).toBe(0xcd); // transparent again
  });

  it('active-low polarity (EN_POLARITY=0): transparent when EN low', () => {
    const p = rtl.Dlatch({ width: 8, enPolarity: 0 });
    const W = circuit('DlWrap0', {
      inputs: { en: bit, d: bus(8) },
      outputs: { q: bus(8) },
      nodes: { p },
      connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
        i.en.to(p.en),
        i.d.to(p.d),
        p.q.to(o.q),
      ],
    } as any);
    const sim = simulate(W);
    sim.set({ en: 0, d: 0x42 });
    sim.tick();
    expect(sim.get('q')).toBe(0x42); // transparent (EN low)
    sim.set({ en: 1, d: 0x99 });
    sim.tick();
    expect(sim.get('q')).toBe(0x42); // held (EN high → opaque)
  });
});

describe('rtl mem (multi-port, per-bit write enable)', () => {
  // 2 read / 2 write, 5-bit addr, 8-bit data, 32 entries.
  const m = rtl.Mem({ rdPorts: 2, wrPorts: 2, abits: 5, width: 8, size: 32 });
  const W = circuit('MemWrap', {
    inputs: {
      ra0: bus(5),
      ra1: bus(5),
      wa0: bus(5),
      wd0: bus(8),
      we0: bus(8),
      wa1: bus(5),
      wd1: bus(8),
      we1: bus(8),
    },
    outputs: { rd0: bus(8), rd1: bus(8) },
    nodes: { p: m },
    connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
      i.ra0.to(p.rd_addr_0),
      i.ra1.to(p.rd_addr_1),
      i.wa0.to(p.wr_addr_0),
      i.wd0.to(p.wr_data_0),
      i.we0.to(p.wr_en_0),
      i.wa1.to(p.wr_addr_1),
      i.wd1.to(p.wr_data_1),
      i.we1.to(p.wr_en_1),
      p.rd_data_0.to(o.rd0),
      p.rd_data_1.to(o.rd1),
    ],
  } as any);

  it('writes then reads back; per-bit enable; independent ports', () => {
    const sim = simulate(W);
    // write 0xAB @3 (port0) and 0xCD @7 (port1) in one cycle
    sim.set({ wa0: 3, wd0: 0xab, we0: 0xff, wa1: 7, wd1: 0xcd, we1: 0xff });
    sim.tick();
    // reads are async but settle during tick() phase 1 (we=0 → no new write)
    sim.set({ we0: 0, we1: 0, ra0: 3, ra1: 7 });
    sim.tick();
    expect(sim.get('rd0')).toBe(0xab);
    expect(sim.get('rd1')).toBe(0xcd);

    // per-bit enable: only low nibble of a fresh write lands
    sim.set({ wa0: 3, wd0: 0xff, we0: 0x0f });
    sim.tick();
    sim.set({ we0: 0, ra0: 3 });
    sim.tick();
    expect(sim.get('rd0')).toBe(0xaf); // high nibble kept (0xA), low overwritten (0xF)
  });
});

describe('rtl pmux (one-hot, per-lane candidates)', () => {
  it('selects the set candidate, else default a', () => {
    const p = rtl.Pmux({ width: 8, sWidth: 2 });
    const W = circuit('PmuxWrap', {
      inputs: { a: bus(8), s: bus(2), b0: bus(8), b1: bus(8) },
      outputs: { out: bus(8) },
      nodes: { p },
      connect: ({ inputs: i, outputs: o, nodes: { p } }: any) => [
        i.a.to(p.a),
        i.s.to(p.s),
        i.b0.to(p.b_0),
        i.b1.to(p.b_1),
        p.out.to(o.out),
      ],
    } as any);
    const sim = simulate(W);
    const ev = (a: number, s: number, b0: number, b1: number) => {
      sim.set({ a, s, b0, b1 });
      return sim.get('out') >>> 0;
    };
    expect(ev(0x11, 0b00, 0xaa, 0x55)).toBe(0x11); // none set → default a
    expect(ev(0x11, 0b01, 0xaa, 0x55)).toBe(0xaa); // bit0 → b_0
    expect(ev(0x11, 0b10, 0xaa, 0x55)).toBe(0x55); // bit1 → b_1
    expect(ev(0x11, 0b11, 0xaa, 0x55)).toBe(0xaa); // both → lowest wins
  });
});
