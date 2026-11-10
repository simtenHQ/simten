/**
 * Sprites: fetch the next line's sprites, draw them, put them in front of
 * or behind the background.
 *
 * Fetch. On dots 257-320 of each rendering line, 8 dots per slot of
 * secondary OAM (oam.ts), the same rhythm as a background tile:
 *
 *   dots 1-4   read the slot's Y, tile, attributes and X from secondary OAM;
 *              meanwhile the PPU bus does two unused nametable reads
 *   dots 5-6   pattern, plane 0
 *   dots 7-8   pattern, plane 1; the slot's sprite unit loads
 *
 * The row is L - Y, upside down with attribute bit 7. 8x8 sprites take their
 * pattern table from PPUCTRL bit 3; 8x16 sprites from tile bit 0, using tiles
 * (tile & $FE) for the top half and the next for the bottom. Attribute bit 6
 * mirrors the bytes. Slots evaluation left empty load transparent rows, and
 * so does the pre-render line, so nothing shows on line 0.
 *
 * Units. Eight, one per slot, each two 8-bit pattern shifters, the palette
 * and priority bits, and an X counter. On each visible dot a unit counts X
 * down to 0, then shifts out one pixel per dot.
 *
 * Pixel. The lowest-numbered unit with an opaque pixel is the sprite pixel;
 * PPUMASK bit 4 shows sprites and bit 2 shows them in the left 8 pixels. It
 * wins over the background unless its priority bit says behind and the
 * background is opaque there. Sprite palettes are $3F10-$3F1F, so the 5-bit
 * pixel is $10 | palette × 4 + pattern bits.
 *
 * Sprite 0 hit goes up on an opaque pixel of unit 0 over an opaque background
 * pixel, when unit 0 holds sprite 0, except at x = 255. It stays up until the
 * pre-render line.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';
import { PpuOam } from './oam.js';

/**
 * The sprite's pattern address for this line, and the byte read there as the
 * unit takes it: mirrored with attribute bit 6, transparent for an empty slot.
 */
const PpuSpritePattern = circuit('PpuSpritePattern', {
  inputs: {
    line: bus(9),
    ctrl: bus(8),
    y: bus(8),
    tile: bus(8),
    attr: bus(8),
    used: bit,
    vram_rdata: bus(8),
  },
  outputs: { addr: bus(14), bits: bus(8) },
  meta: { category: 'nes', icon: 'T', description: 'PPU sprite pattern address and row' },
  eval: ({ line, ctrl, y, tile, attr, used, vram_rdata }) => {
    const at = attr as number;
    const t = tile as number;
    const c = ctrl as number;
    const tall = (c & 0x20) !== 0;
    const last = tall ? 15 : 7;
    let row = ((line as number) - (y as number)) & last;
    if ((at & 0x80) !== 0) row = last - row;
    const addr = tall
      ? ((t & 1) << 12) | (((t & 0xfe) | (row >> 3)) << 4) | (row & 7)
      : ((c & 0x08) << 9) | (t << 4) | row;

    const d = vram_rdata as number;
    const mirrored =
      ((d & 0x01) << 7) |
      ((d & 0x02) << 5) |
      ((d & 0x04) << 3) |
      ((d & 0x08) << 1) |
      ((d & 0x10) >> 1) |
      ((d & 0x20) >> 3) |
      ((d & 0x40) >> 5) |
      ((d & 0x80) >> 7);
    let bits = (at & 0x40) !== 0 ? mirrored : d;
    if (used === 0) bits = 0;
    return { addr, bits };
  },
});

/** Secondary OAM to the units: the slot's bytes, its pattern rows, the load. */
const PpuSpriteFetch = circuit('PpuSpriteFetch', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    v: bus(15),
    bg_addr: bus(14),
    pattern: bus(14),
    bits: bus(8),
    sec_data: bus(8),
    found: bus(6),
    first: bit,
    y: bus(8),
    tile: bus(8),
    attr: bus(8),
    x: bus(8),
    lo: bus(8),
    zero: bit,
  },
  outputs: {
    vram_addr: bus(14),
    fetch_addr: bus(5),
    slot: bus(3),
    used: bit,
    load: bit,
    next_y: bus(8),
    next_tile: bus(8),
    next_attr: bus(8),
    next_x: bus(8),
    next_lo: bus(8),
    next_zero: bit,
  },
  meta: { category: 'nes', icon: 'F', description: 'PPU sprite fetch: secondary OAM to units' },
  eval: ({
    dot,
    line,
    mask,
    v,
    bg_addr,
    pattern,
    bits,
    sec_data,
    found,
    first,
    y,
    tile,
    attr,
    x,
    lo,
    zero,
  }) => {
    const dt = dot as number;
    const ln = line as number;
    const rendering = ((mask as number) & 0x18) !== 0 && (ln < 240 || ln === 261);
    const fetching = rendering && dt >= 257 && dt <= 320;
    const slot = ((dt - 257) >> 3) & 7;
    const phase = (dt - 257) & 7;

    let addr = bg_addr as number;
    if (fetching && phase < 4) addr = 0x2000 | ((v as number) & 0x0fff);
    else if (fetching && phase < 6) addr = pattern as number;
    else if (fetching) addr = (pattern as number) | 8;

    // Which byte this dot latches: 0-3 the slot's, 5 plane 0; 8 for none.
    const latch = fetching ? phase : 8;
    const s = sec_data as number;
    const visibleLine = ln < 240 ? 1 : 0;
    return {
      vram_addr: addr,
      fetch_addr: (slot << 2) | (phase < 3 ? phase : 3),
      slot,
      used: slot * 4 < (found as number) ? visibleLine : 0,
      load: fetching && phase === 7 ? 1 : 0,
      next_y: latch === 0 ? s : (y as number),
      next_tile: latch === 1 ? s : (tile as number),
      next_attr: latch === 2 ? s : (attr as number),
      next_x: latch === 3 ? s : (x as number),
      next_lo: latch === 5 ? (bits as number) : (lo as number),
      next_zero: fetching && dt === 257 ? (first as number) & visibleLine : (zero as number),
    };
  },
});

/** A sprite unit's next state and its pixel. */
const PpuSpriteUnitLogic = circuit('PpuSpriteUnitLogic', {
  inputs: {
    slot: bus(3),
    me: bus(3),
    load: bit,
    run: bit,
    in_lo: bus(8),
    in_hi: bus(8),
    in_attr: bus(8),
    in_x: bus(8),
    lo: bus(8),
    hi: bus(8),
    attr: bus(3),
    x: bus(8),
  },
  outputs: {
    pixel: bus(4),
    behind: bit,
    next_lo: bus(8),
    next_hi: bus(8),
    next_attr: bus(3),
    next_x: bus(8),
  },
  meta: { category: 'nes', icon: 'U', description: 'PPU sprite unit: X counter and shifters' },
  eval: ({ slot, me, load, run, in_lo, in_hi, in_attr, in_x, lo, hi, attr, x }) => {
    const l = lo as number;
    const h = hi as number;
    const xc = x as number;
    const bits = xc === 0 ? ((l >> 7) & 1) | (((h >> 7) & 1) << 1) : 0;
    const loading = load === 1 && slot === me;
    const shift = run === 1 && xc === 0;
    let nextX = xc;
    if (loading) nextX = in_x as number;
    else if (run === 1 && xc !== 0) nextX = xc - 1;
    let nextLo = shift ? (l << 1) & 0xff : l;
    let nextHi = shift ? (h << 1) & 0xff : h;
    if (loading) nextLo = in_lo as number;
    if (loading) nextHi = in_hi as number;
    const ia = in_attr as number;
    return {
      pixel: bits !== 0 ? (((attr as number) & 3) << 2) | bits : 0,
      behind: ((attr as number) >> 2) & 1,
      next_lo: nextLo,
      next_hi: nextHi,
      next_attr: loading ? ((ia >> 3) & 4) | (ia & 3) : (attr as number),
      next_x: nextX,
    };
  },
});

/**
 * One of the eight sprite units. `me` is its slot number, tied to a
 * constant; it loads when the fetch says `load` for that slot.
 */
const PpuSpriteUnit = circuit('PpuSpriteUnit', {
  inputs: {
    slot: bus(3),
    me: bus(3),
    load: bit,
    run: bit,
    in_lo: bus(8),
    in_hi: bus(8),
    in_attr: bus(8),
    in_x: bus(8),
  },
  outputs: { pixel: bus(4), behind: bit },
  nodes: {
    lo: Register({ width: 8 }),
    hi: Register({ width: 8 }),
    attr: Register({ width: 3 }),
    x: Register({ width: 8 }),
    logic: PpuSpriteUnitLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.lo.we, n.hi.we, n.attr.we, n.x.we),
    inputs.slot.to(n.logic.slot),
    inputs.me.to(n.logic.me),
    inputs.load.to(n.logic.load),
    inputs.run.to(n.logic.run),
    inputs.in_lo.to(n.logic.in_lo),
    inputs.in_hi.to(n.logic.in_hi),
    inputs.in_attr.to(n.logic.in_attr),
    inputs.in_x.to(n.logic.in_x),
    n.lo.q.to(n.logic.lo),
    n.hi.q.to(n.logic.hi),
    n.attr.q.to(n.logic.attr),
    n.x.q.to(n.logic.x),
    n.logic.next_lo.to(n.lo.data),
    n.logic.next_hi.to(n.hi.data),
    n.logic.next_attr.to(n.attr.data),
    n.logic.next_x.to(n.x.data),
    n.logic.pixel.to(outputs.pixel),
    n.logic.behind.to(outputs.behind),
  ],
});

/** Front-most sprite, priority against the background, sprite 0 hit. */
const PpuSpritePixel = circuit('PpuSpritePixel', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    bg: bus(5),
    p0: bus(4),
    p1: bus(4),
    p2: bus(4),
    p3: bus(4),
    p4: bus(4),
    p5: bus(4),
    p6: bus(4),
    p7: bus(4),
    b0: bit,
    b1: bit,
    b2: bit,
    b3: bit,
    b4: bit,
    b5: bit,
    b6: bit,
    b7: bit,
    zero: bit,
    hit: bit,
    flags_clear: bit,
  },
  outputs: { pixel: bus(5), run: bit, next_hit: bit },
  meta: { category: 'nes', icon: 'P', description: 'PPU pixel: sprite priority, sprite 0 hit' },
  eval: ({
    dot,
    line,
    mask,
    bg,
    p0,
    p1,
    p2,
    p3,
    p4,
    p5,
    p6,
    p7,
    b0,
    b1,
    b2,
    b3,
    b4,
    b5,
    b6,
    b7,
    zero,
    hit,
    flags_clear,
  }) => {
    const dt = dot as number;
    const m = mask as number;
    const visible = (m & 0x18) !== 0 && (line as number) < 240 && dt >= 1 && dt <= 256;
    const shown = visible && (m & 0x10) !== 0 && ((m & 0x04) !== 0 || dt > 8);

    // Unit 7 first, so the lowest opaque unit is the last to overwrite.
    let sp = 0;
    let behind = 0;
    if (((p7 as number) & 3) !== 0) {
      sp = p7 as number;
      behind = b7 as number;
    }
    if (((p6 as number) & 3) !== 0) {
      sp = p6 as number;
      behind = b6 as number;
    }
    if (((p5 as number) & 3) !== 0) {
      sp = p5 as number;
      behind = b5 as number;
    }
    if (((p4 as number) & 3) !== 0) {
      sp = p4 as number;
      behind = b4 as number;
    }
    if (((p3 as number) & 3) !== 0) {
      sp = p3 as number;
      behind = b3 as number;
    }
    if (((p2 as number) & 3) !== 0) {
      sp = p2 as number;
      behind = b2 as number;
    }
    if (((p1 as number) & 3) !== 0) {
      sp = p1 as number;
      behind = b1 as number;
    }
    if (((p0 as number) & 3) !== 0) {
      sp = p0 as number;
      behind = b0 as number;
    }
    if (!shown) sp = 0;

    const b = bg as number;
    const bgOpaque = (b & 3) !== 0;
    const sprite = sp !== 0 && (!bgOpaque || behind === 0);
    const zeroHit = zero === 1 && shown && ((p0 as number) & 3) !== 0 && bgOpaque && dt !== 256;
    let nextHit = hit as number;
    if (flags_clear === 1) nextHit = 0;
    else if (zeroHit) nextHit = 1;
    return {
      pixel: sprite ? 0x10 | sp : b,
      run: visible ? 1 : 0,
      next_hit: nextHit,
    };
  },
});

const UNITS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export const PpuSprites = circuit('PpuSprites', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    flags_clear: bit,
    bg_addr: bus(14),
    bg_pixel: bus(5),
    vram_rdata: bus(8),
  },
  outputs: {
    data_out: bus(8),
    vram_addr: bus(14),
    pixel: bus(5),
    hit: bit,
    overflow: bit,
  },
  nodes: {
    oam: PpuOam,
    fetch: PpuSpriteFetch,
    pattern: PpuSpritePattern,
    y: Register({ width: 8 }),
    tile: Register({ width: 8 }),
    attr: Register({ width: 8 }),
    x: Register({ width: 8 }),
    lo: Register({ width: 8 }),
    zero: Register({ width: 1 }),
    u0: PpuSpriteUnit,
    u1: PpuSpriteUnit,
    u2: PpuSpriteUnit,
    u3: PpuSpriteUnit,
    u4: PpuSpriteUnit,
    u5: PpuSpriteUnit,
    u6: PpuSpriteUnit,
    u7: PpuSpriteUnit,
    n0: Constant({ value: 0, width: 3 }),
    n1: Constant({ value: 1, width: 3 }),
    n2: Constant({ value: 2, width: 3 }),
    n3: Constant({ value: 3, width: 3 }),
    n4: Constant({ value: 4, width: 3 }),
    n5: Constant({ value: 5, width: 3 }),
    n6: Constant({ value: 6, width: 3 }),
    n7: Constant({ value: 7, width: 3 }),
    pix: PpuSpritePixel,
    hit: Register({ width: 1 }),
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => {
    const units = [n.u0, n.u1, n.u2, n.u3, n.u4, n.u5, n.u6, n.u7];
    const ids = [n.n0, n.n1, n.n2, n.n3, n.n4, n.n5, n.n6, n.n7];
    const pixels = [n.pix.p0, n.pix.p1, n.pix.p2, n.pix.p3, n.pix.p4, n.pix.p5, n.pix.p6, n.pix.p7];
    const behind = [n.pix.b0, n.pix.b1, n.pix.b2, n.pix.b3, n.pix.b4, n.pix.b5, n.pix.b6, n.pix.b7];
    return [
      n.always.out.to(n.y.we, n.tile.we, n.attr.we, n.x.we, n.lo.we, n.zero.we, n.hit.we),
      inputs.cs.to(n.oam.cs),
      inputs.rw.to(n.oam.rw),
      inputs.addr.to(n.oam.addr),
      inputs.data_in.to(n.oam.data_in),
      inputs.dot.to(n.oam.dot, n.fetch.dot, n.pix.dot),
      inputs.line.to(n.oam.line, n.fetch.line, n.pattern.line, n.pix.line),
      inputs.mask.to(n.oam.mask, n.fetch.mask, n.pix.mask),
      inputs.ctrl.to(n.oam.ctrl, n.pattern.ctrl),
      inputs.v.to(n.fetch.v),
      inputs.flags_clear.to(n.oam.flags_clear, n.pix.flags_clear),
      inputs.bg_addr.to(n.fetch.bg_addr),
      inputs.bg_pixel.to(n.pix.bg),
      inputs.vram_rdata.to(n.pattern.vram_rdata),
      n.oam.data_out.to(outputs.data_out),
      n.oam.overflow.to(outputs.overflow),
      n.oam.sec_data.to(n.fetch.sec_data),
      n.oam.found.to(n.fetch.found),
      n.oam.first.to(n.fetch.first),
      n.fetch.fetch_addr.to(n.oam.fetch_addr),
      n.fetch.vram_addr.to(outputs.vram_addr),
      n.y.q.to(n.fetch.y, n.pattern.y),
      n.tile.q.to(n.fetch.tile, n.pattern.tile),
      n.attr.q.to(n.fetch.attr, n.pattern.attr, ...units.map((u) => u.in_attr)),
      n.x.q.to(n.fetch.x, ...units.map((u) => u.in_x)),
      n.lo.q.to(n.fetch.lo, ...units.map((u) => u.in_lo)),
      n.zero.q.to(n.fetch.zero, n.pix.zero),
      n.fetch.next_y.to(n.y.data),
      n.fetch.next_tile.to(n.tile.data),
      n.fetch.next_attr.to(n.attr.data),
      n.fetch.next_x.to(n.x.data),
      n.fetch.next_lo.to(n.lo.data),
      n.fetch.next_zero.to(n.zero.data),
      n.fetch.slot.to(...units.map((u) => u.slot)),
      n.fetch.load.to(...units.map((u) => u.load)),
      n.fetch.used.to(n.pattern.used),
      n.pattern.addr.to(n.fetch.pattern),
      n.pattern.bits.to(n.fetch.bits, ...units.map((u) => u.in_hi)),
      n.pix.run.to(...units.map((u) => u.run)),
      ...UNITS.map((i) => ids[i].out.to(units[i].me)),
      ...UNITS.map((i) => units[i].pixel.to(pixels[i])),
      ...UNITS.map((i) => units[i].behind.to(behind[i])),
      n.hit.q.to(n.pix.hit, outputs.hit),
      n.pix.next_hit.to(n.hit.data),
      n.pix.pixel.to(outputs.pixel),
    ];
  },
});
