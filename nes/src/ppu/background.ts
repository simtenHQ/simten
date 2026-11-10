/**
 * The background: fetch tiles, shift them out a pixel per dot.
 *
 * Fetch. While rendering, on lines 0-239 and the pre-render line, dots 1-256
 * fetch the tiles for this line and dots 321-336 the first two of the next.
 * Each tile takes 8 dots, two per read, and the byte is latched on the
 * second dot:
 *
 *   dots 1-2  nametable byte    $2000 | (v & $0FFF)
 *   dots 3-4  attribute byte    $23C0 | NT | coarse Y / 4 | coarse X / 4,
 *                               kept as the 2 palette bits for this tile
 *   dots 5-6  pattern, plane 0  PPUCTRL bit 4 table | tile × 16 | fine Y
 *   dots 7-8  pattern, plane 1  the same + 8
 *
 * Outside those dots the PPU's bus belongs to the $2007 port.
 *
 * Shift. Two 16-bit pattern shift registers and two 8-bit attribute shift
 * registers, each attribute register fed by a 1-bit latch. They shift on
 * dots 2-257 and 322-337; on dots 9, 17, ... 257, 329 and 337 the low bytes
 * load the latched pattern bytes and the attribute latches the tile's
 * palette bits. Fine x picks the bit: pattern bit 15 - x, attribute bit 7 - x.
 *
 * The pixel for dot d (1-256) is screen x = d - 1: a 4-bit palette index,
 * palette × 4 + pattern bits, or 0 (the backdrop) when the pattern bits are 0,
 * the background is off (PPUMASK bit 3), or x < 8 with PPUMASK bit 1 clear.
 */

import { bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

const PpuBgFetch = circuit('PpuBgFetch', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    data_addr: bus(14),
    vram_rdata: bus(8),
    nt: bus(8),
    at: bus(2),
    lo: bus(8),
    hi: bus(8),
  },
  outputs: {
    vram_addr: bus(14),
    next_nt: bus(8),
    next_at: bus(2),
    next_lo: bus(8),
    next_hi: bus(8),
  },
  meta: {
    category: 'nes',
    icon: 'F',
    description: 'PPU background fetch: tile, attribute, pattern',
  },
  eval: ({ dot, line, mask, ctrl, v, data_addr, vram_rdata, nt, at, lo, hi }) => {
    const dt = dot as number;
    const va = v as number;
    const d = vram_rdata as number;
    const rendering = ((mask as number) & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const fetching = rendering && ((dt >= 1 && dt <= 256) || (dt >= 321 && dt <= 336));
    const phase = (dt - 1) & 7;
    const pattern = (((ctrl as number) & 0x10) << 8) | ((nt as number) << 4) | ((va >> 12) & 7);

    let addr = data_addr as number;
    if (fetching && phase < 2) addr = 0x2000 | (va & 0x0fff);
    else if (fetching && phase < 4)
      addr = 0x23c0 | (va & 0x0c00) | ((va >> 4) & 0x38) | ((va >> 2) & 7);
    else if (fetching && phase < 6) addr = pattern;
    else if (fetching) addr = pattern | 8;

    // The quadrant of the 32x32 area: coarse Y bit 1 picks the top or bottom
    // half of the attribute byte, coarse X bit 1 the left or right pair.
    const quadrant = ((va >> 4) & 4) | (va & 2);
    return {
      vram_addr: addr,
      next_nt: fetching && phase === 1 ? d : (nt as number),
      next_at: fetching && phase === 3 ? (d >> quadrant) & 3 : (at as number),
      next_lo: fetching && phase === 5 ? d : (lo as number),
      next_hi: fetching && phase === 7 ? d : (hi as number),
    };
  },
});

const PpuBgShift = circuit('PpuBgShift', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    x: bus(3),
    at: bus(2),
    lo: bus(8),
    hi: bus(8),
    p0: bus(16),
    p1: bus(16),
    a0: bus(8),
    a1: bus(8),
    l0: bus(1),
    l1: bus(1),
  },
  outputs: {
    pixel: bus(5),
    next_p0: bus(16),
    next_p1: bus(16),
    next_a0: bus(8),
    next_a1: bus(8),
    next_l0: bus(1),
    next_l1: bus(1),
  },
  meta: { category: 'nes', icon: '»', description: 'PPU background shifters and fine x select' },
  eval: ({ dot, line, mask, x, at, lo, hi, p0, p1, a0, a1, l0, l1 }) => {
    const dt = dot as number;
    const m = mask as number;
    const rendering = (m & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const shifting = rendering && ((dt >= 2 && dt <= 257) || (dt >= 322 && dt <= 337));
    const reload = shifting && ((dt - 1) & 7) === 0;

    let s0 = p0 as number;
    let s1 = p1 as number;
    let t0 = a0 as number;
    let t1 = a1 as number;
    if (shifting) {
      s0 = (s0 << 1) & 0xffff;
      s1 = (s1 << 1) & 0xffff;
      t0 = ((t0 << 1) | (l0 as number)) & 0xff;
      t1 = ((t1 << 1) | (l1 as number)) & 0xff;
    }

    const fx = x as number;
    const bits = ((s0 >> (15 - fx)) & 1) | (((s1 >> (15 - fx)) & 1) << 1);
    const palette = ((t0 >> (7 - fx)) & 1) | (((t1 >> (7 - fx)) & 1) << 1);
    const shown = (m & 0x08) !== 0 && ((m & 0x02) !== 0 || dt > 8);
    return {
      pixel: shown && bits !== 0 ? (palette << 2) | bits : 0,
      next_p0: reload ? (s0 & 0xff00) | (lo as number) : s0,
      next_p1: reload ? (s1 & 0xff00) | (hi as number) : s1,
      next_a0: t0,
      next_a1: t1,
      next_l0: reload ? (at as number) & 1 : (l0 as number),
      next_l1: reload ? ((at as number) >> 1) & 1 : (l1 as number),
    };
  },
});

export const PpuBackground = circuit('PpuBackground', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    x: bus(3),
    data_addr: bus(14),
    vram_rdata: bus(8),
  },
  outputs: { vram_addr: bus(14), pixel: bus(5) },
  nodes: {
    fetch: PpuBgFetch,
    nt: Register({ width: 8 }),
    at: Register({ width: 2 }),
    lo: Register({ width: 8 }),
    hi: Register({ width: 8 }),
    shift: PpuBgShift,
    p0: Register({ width: 16 }),
    p1: Register({ width: 16 }),
    a0: Register({ width: 8 }),
    a1: Register({ width: 8 }),
    l0: Register({ width: 1 }),
    l1: Register({ width: 1 }),
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(
      n.nt.we,
      n.at.we,
      n.lo.we,
      n.hi.we,
      n.p0.we,
      n.p1.we,
      n.a0.we,
      n.a1.we,
      n.l0.we,
      n.l1.we,
    ),
    inputs.dot.to(n.fetch.dot, n.shift.dot),
    inputs.line.to(n.fetch.line, n.shift.line),
    inputs.mask.to(n.fetch.mask, n.shift.mask),
    inputs.ctrl.to(n.fetch.ctrl),
    inputs.v.to(n.fetch.v),
    inputs.x.to(n.shift.x),
    inputs.data_addr.to(n.fetch.data_addr),
    inputs.vram_rdata.to(n.fetch.vram_rdata),
    n.nt.q.to(n.fetch.nt),
    n.at.q.to(n.fetch.at, n.shift.at),
    n.lo.q.to(n.fetch.lo, n.shift.lo),
    n.hi.q.to(n.fetch.hi, n.shift.hi),
    n.fetch.next_nt.to(n.nt.data),
    n.fetch.next_at.to(n.at.data),
    n.fetch.next_lo.to(n.lo.data),
    n.fetch.next_hi.to(n.hi.data),
    n.fetch.vram_addr.to(outputs.vram_addr),
    n.p0.q.to(n.shift.p0),
    n.p1.q.to(n.shift.p1),
    n.a0.q.to(n.shift.a0),
    n.a1.q.to(n.shift.a1),
    n.l0.q.to(n.shift.l0),
    n.l1.q.to(n.shift.l1),
    n.shift.next_p0.to(n.p0.data),
    n.shift.next_p1.to(n.p1.data),
    n.shift.next_a0.to(n.a0.data),
    n.shift.next_a1.to(n.a1.data),
    n.shift.next_l0.to(n.l0.data),
    n.shift.next_l1.to(n.l1.data),
    n.shift.pixel.to(outputs.pixel),
  ],
});
