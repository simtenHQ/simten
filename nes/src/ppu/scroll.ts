/**
 * The PPU's internal scroll and address registers, as the NESdev wiki names
 * them:
 *
 *   v  15 bits  current VRAM address (during rendering: the scroll position)
 *   t  15 bits  temporary address, the top-left of the screen
 *   x   3 bits  fine X scroll
 *   w   1 bit   first or second write toggle, shared by $2005 and $2006
 *
 * Bits of v and t: yyy NN YYYYY XXXXX (fine Y, nametable, coarse Y, coarse X).
 *
 *   $2000 write   t: NN = d & 3
 *   $2002 read    w = 0
 *   $2005 write   w=0: t coarse X = d >> 3, x = d & 7
 *                 w=1: t fine Y = d & 7, coarse Y = d >> 3
 *   $2006 write   w=0: t bits 13-8 = d & $3F, bit 14 = 0
 *                 w=1: t bits 7-0 = d, then v = t
 *   $2007 access  v += 1, or 32 with PPUCTRL bit 2
 *
 * While rendering (PPUMASK bit 3 or 4) on lines 0-239 and the pre-render
 * line 261, v also walks the screen with the background fetches:
 *
 *   dots 8, 16, ... 256, 328, 336  coarse X + 1, into the next nametable at 31
 *   dot 256                        Y + 1: fine Y, then coarse Y, into the next
 *                                  nametable after row 29 (row 31 wraps to 0)
 *   dot 257                        v's horizontal bits (coarse X, NT bit 10) = t's
 *   line 261, dots 280-304         v's vertical bits (fine Y, coarse Y, NT bit 11) = t's
 *
 * A CPU access in the same dot is applied after these.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

/** Rendering's walk across the screen: v after this dot's fetch-side updates. */
const PpuScrollRender = circuit('PpuScrollRender', {
  inputs: { mask: bus(8), dot: bus(9), line: bus(9), v: bus(15), t: bus(15) },
  outputs: { v_out: bus(15) },
  meta: { category: 'nes', icon: 'S', description: 'PPU scroll: rendering increments and copies' },
  eval: ({ mask, dot, line, v, t }) => {
    const dt = dot as number;
    const tt = t as number;
    let nv = v as number;
    const rendering = ((mask as number) & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const fetching = (dt >= 1 && dt <= 256) || (dt >= 321 && dt <= 336);
    if (rendering && fetching && (dt & 7) === 0) {
      nv = (nv & 0x1f) === 31 ? (nv & 0x7fe0) ^ 0x0400 : nv + 1;
    }
    if (rendering && dt === 256) {
      // Fine Y first; when it wraps, coarse Y. Row 29 is the last row of
      // tiles, so it moves to the next nametable down; rows 30-31 are the
      // attribute table and wrap to 0 without moving.
      const row = (nv >> 5) & 31;
      const nextRow = row === 29 || row === 31 ? 0 : row + 1;
      const flip = row === 29 ? 0x0800 : 0;
      if ((nv & 0x7000) !== 0x7000) nv = nv + 0x1000;
      else nv = ((nv & 0x0c1f) | (nextRow << 5)) ^ flip;
    }
    if (rendering && dt === 257) nv = (nv & 0x7be0) | (tt & 0x041f);
    if (rendering && line === 261 && dt >= 280 && dt <= 304) nv = (nv & 0x041f) | (tt & 0x7be0);
    return { v_out: nv };
  },
});

/** CPU register accesses, applied after rendering's updates. */
const PpuScrollCpu = circuit('PpuScrollCpu', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    ctrl: bus(8),
    v: bus(15),
    t: bus(15),
    x: bus(3),
    w: bit,
  },
  outputs: { next_v: bus(15), next_t: bus(15), next_x: bus(3), next_w: bit },
  meta: { category: 'nes', icon: 'S', description: 'PPU scroll: $2000, $2002, $2005-$2007' },
  eval: ({ cs, rw, addr, data_in, ctrl, v, t, x, w }) => {
    const reg = cs === 1 ? (addr as number) : 8;
    const d = data_in as number;
    const write = rw === 0;
    let nv = v as number;
    let nt = t as number;
    let nx = x as number;
    let nw = w as number;
    if (write && reg === 0) {
      nt = (nt & 0x73ff) | ((d & 3) << 10);
    } else if (!write && reg === 2) {
      nw = 0;
    } else if (write && reg === 5) {
      if (w === 0) nt = (nt & 0x7fe0) | (d >> 3);
      else nt = (nt & 0x0c1f) | ((d & 7) << 12) | ((d >> 3) << 5);
      if (w === 0) nx = d & 7;
      nw = (w as number) ^ 1;
    } else if (write && reg === 6) {
      nt = w === 0 ? (nt & 0x00ff) | ((d & 0x3f) << 8) : (nt & 0x7f00) | d;
      if (w === 1) nv = nt;
      nw = (w as number) ^ 1;
    } else if (reg === 7) {
      nv = (nv + (((ctrl as number) & 4) !== 0 ? 32 : 1)) & 0x7fff;
    }
    return { next_v: nv, next_t: nt, next_x: nx, next_w: nw };
  },
});

export const PpuScroll = circuit('PpuScroll', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    ctrl: bus(8),
    mask: bus(8),
    dot: bus(9),
    line: bus(9),
  },
  outputs: { v: bus(15), x: bus(3) },
  nodes: {
    v: Register({ width: 15 }),
    t: Register({ width: 15 }),
    x: Register({ width: 3 }),
    w: Register({ width: 1 }),
    render: PpuScrollRender,
    cpu: PpuScrollCpu,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.v.we, n.t.we, n.x.we, n.w.we),
    inputs.cs.to(n.cpu.cs),
    inputs.rw.to(n.cpu.rw),
    inputs.addr.to(n.cpu.addr),
    inputs.data_in.to(n.cpu.data_in),
    inputs.ctrl.to(n.cpu.ctrl),
    inputs.mask.to(n.render.mask),
    inputs.dot.to(n.render.dot),
    inputs.line.to(n.render.line),
    n.v.q.to(n.render.v, outputs.v),
    n.t.q.to(n.render.t, n.cpu.t),
    n.x.q.to(n.cpu.x, outputs.x),
    n.w.q.to(n.cpu.w),
    n.render.v_out.to(n.cpu.v),
    n.cpu.next_v.to(n.v.data),
    n.cpu.next_t.to(n.t.data),
    n.cpu.next_x.to(n.x.data),
    n.cpu.next_w.to(n.w.data),
  ],
});
