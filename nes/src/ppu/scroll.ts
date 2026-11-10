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
 * The increments and copies rendering makes come with the background.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

const PpuScrollLogic = circuit('PpuScrollLogic', {
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
  meta: { category: 'nes', icon: 'S', description: 'PPU scroll logic: v, t, x and w' },
  eval: ({ cs, rw, addr, data_in, ctrl, v, t, x, w }) => {
    const reg = addr as number;
    const d = data_in as number;
    const write = cs === 1 && rw === 0;
    let nv = v as number;
    let nt = t as number;
    let nx = x as number;
    let nw = w as number;
    if (write && reg === 0) {
      nt = (nt & 0x73ff) | ((d & 3) << 10);
    } else if (cs === 1 && rw === 1 && reg === 2) {
      nw = 0;
    } else if (write && reg === 5 && w === 0) {
      nt = (nt & 0x7fe0) | (d >> 3);
      nx = d & 7;
      nw = 1;
    } else if (write && reg === 5) {
      nt = (nt & 0x0c1f) | ((d & 7) << 12) | ((d >> 3) << 5);
      nw = 0;
    } else if (write && reg === 6 && w === 0) {
      nt = (nt & 0x00ff) | ((d & 0x3f) << 8);
      nw = 1;
    } else if (write && reg === 6) {
      nt = (nt & 0x7f00) | d;
      nv = nt;
      nw = 0;
    } else if (cs === 1 && reg === 7) {
      nv = (nv + (((ctrl as number) & 4) !== 0 ? 32 : 1)) & 0x7fff;
    }
    return { next_v: nv, next_t: nt, next_x: nx, next_w: nw };
  },
});

export const PpuScroll = circuit('PpuScroll', {
  inputs: { cs: bit, rw: bit, addr: bus(3), data_in: bus(8), ctrl: bus(8) },
  outputs: { v: bus(15) },
  nodes: {
    v: Register({ width: 15 }),
    t: Register({ width: 15 }),
    x: Register({ width: 3 }),
    w: Register({ width: 1 }),
    logic: PpuScrollLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.v.we, n.t.we, n.x.we, n.w.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.addr.to(n.logic.addr),
    inputs.data_in.to(n.logic.data_in),
    inputs.ctrl.to(n.logic.ctrl),
    n.v.q.to(n.logic.v, outputs.v),
    n.t.q.to(n.logic.t),
    n.x.q.to(n.logic.x),
    n.w.q.to(n.logic.w),
    n.logic.next_v.to(n.v.data),
    n.logic.next_t.to(n.t.data),
    n.logic.next_x.to(n.x.data),
    n.logic.next_w.to(n.w.data),
  ],
});
