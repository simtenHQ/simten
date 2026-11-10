/**
 * PPU registers as the CPU sees them, $2000-$2007 (mirrored to $3FFF):
 *
 *   $2000  PPUCTRL    write. Bit 7: raise NMI at vblank.
 *   $2001  PPUMASK    write. Bits 3-4 turn rendering on.
 *   $2002  PPUSTATUS  read. Bit 7 vblank; reading clears it.
 *   $2003  OAMADDR    write.
 *   $2004  OAMDATA    write increments OAMADDR (OAM itself comes with sprites).
 *   $2005, $2006      scroll and address (scroll.ts)
 *   $2007  PPUDATA    read or write PPU memory at v (data.ts); reads come in
 *                     on `data7`
 *
 * `cs` is high for one tick per CPU access, so each access counts once.
 *
 * Reads of write-only registers return the PPU's I/O latch: the last value
 * written to or read from any register (decay is not modelled). PPUSTATUS
 * fills its low 5 bits from it. Bits 6 and 5 (sprite 0 hit, overflow) read
 * 0 until the sprite unit exists.
 *
 * `nmi` is vblank AND PPUCTRL bit 7, so setting bit 7 during vblank raises it
 * at once. A $2002 read on the tick the flag would go up (241, 0) reads 0 and
 * the flag stays down for that frame, so no NMI.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

const PpuRegsLogic = circuit('PpuRegsLogic', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    data7: bus(8),
    ctrl: bus(8),
    mask: bus(8),
    oamaddr: bus(8),
    vbl: bit,
    latch: bus(8),
    vbl_set: bit,
    flags_clear: bit,
  },
  outputs: {
    data_out: bus(8),
    nmi: bit,
    next_ctrl: bus(8),
    next_mask: bus(8),
    next_oamaddr: bus(8),
    next_vbl: bit,
    next_latch: bus(8),
  },
  meta: { category: 'nes', icon: 'R', description: 'PPU register logic: CPU reads and writes' },
  eval: ({
    cs,
    rw,
    addr,
    data_in,
    data7,
    ctrl,
    mask,
    oamaddr,
    vbl,
    latch,
    vbl_set,
    flags_clear,
  }) => {
    const reg = addr as number;
    const write = cs === 1 && rw === 0;
    const readStatus = cs === 1 && rw === 1 && reg === 2;
    const readData = cs === 1 && rw === 1 && reg === 7;
    const status = ((vbl as number) << 7) | ((latch as number) & 0x1f);
    let out = latch as number;
    if (reg === 2) out = status;
    else if (reg === 7) out = data7 as number;

    let nextVbl = vbl as number;
    if (flags_clear || readStatus) nextVbl = 0;
    else if (vbl_set) nextVbl = 1;

    let nextLatch = latch as number;
    if (write) nextLatch = data_in as number;
    else if (readStatus || readData) nextLatch = out;

    let nextOamaddr = oamaddr as number;
    if (write && reg === 3) nextOamaddr = data_in as number;
    else if (write && reg === 4) nextOamaddr = ((oamaddr as number) + 1) & 0xff;

    return {
      data_out: out,
      nmi: vbl === 1 && ((ctrl as number) & 0x80) !== 0 ? 1 : 0,
      next_ctrl: write && reg === 0 ? (data_in as number) : (ctrl as number),
      next_mask: write && reg === 1 ? (data_in as number) : (mask as number),
      next_oamaddr: nextOamaddr,
      next_vbl: nextVbl,
      next_latch: nextLatch,
    };
  },
});

export const PpuRegs = circuit('PpuRegs', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    data7: bus(8),
    vbl_set: bit,
    flags_clear: bit,
  },
  outputs: { data_out: bus(8), nmi: bit, ctrl: bus(8), mask: bus(8) },
  nodes: {
    ctrl: Register({ width: 8 }),
    mask: Register({ width: 8 }),
    oamaddr: Register({ width: 8 }),
    vbl: Register({ width: 1 }),
    latch: Register({ width: 8 }),
    logic: PpuRegsLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.ctrl.we, n.mask.we, n.oamaddr.we, n.vbl.we, n.latch.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.addr.to(n.logic.addr),
    inputs.data_in.to(n.logic.data_in),
    inputs.data7.to(n.logic.data7),
    inputs.vbl_set.to(n.logic.vbl_set),
    inputs.flags_clear.to(n.logic.flags_clear),
    n.ctrl.q.to(n.logic.ctrl, outputs.ctrl),
    n.mask.q.to(n.logic.mask, outputs.mask),
    n.oamaddr.q.to(n.logic.oamaddr),
    n.vbl.q.to(n.logic.vbl),
    n.latch.q.to(n.logic.latch),
    n.logic.next_ctrl.to(n.ctrl.data),
    n.logic.next_mask.to(n.mask.data),
    n.logic.next_oamaddr.to(n.oamaddr.data),
    n.logic.next_vbl.to(n.vbl.data),
    n.logic.next_latch.to(n.latch.data),
    n.logic.data_out.to(outputs.data_out),
    n.logic.nmi.to(outputs.nmi),
  ],
});
