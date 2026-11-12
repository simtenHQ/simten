/**
 * The NES cut into its two chips' sides for the browser build, which steps
 * them at their own rates (split.cc): the CPU side once per CPU cycle, the
 * PPU side every dot. Same parts as `Nes` in src/board.ts, wired the same
 * way; build.ts checks the two together against `Nes`, tick for tick.
 *
 * Each side has the cartridge plugged in and uses its half of the connector:
 * PRG on the CPU side, CHR and nametable mirroring on the PPU side.
 *
 * The CPU side has every clock enable tied high, since it is only stepped on
 * CPU cycles. Between them run the PPU's register port (`ppu_cs`, address,
 * R/W, data each way) and NMI.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, DualPortRAM, MOS6502_Core, Register } from '@simten/core/std';
import { Apu } from '../src/apu/apu.js';
import { Ls139, NesCpuBus, NesVramBus } from '../src/board.js';
import { NromCart } from '../src/cart.js';
import { OamDma } from '../src/dma.js';
import { NesPads } from '../src/pads.js';
import { Ppu } from '../src/ppu/ppu.js';
import { Rp2a03Regs } from '../src/rp2a03.js';

/** A cartridge's shape: 16 or 32 KB of PRG, and its mirroring. */
export type CartShape = { prgSize?: number; vertical?: number };

/** The 2A03, work RAM, the 74LS139, the controller ports and the cart's PRG. */
export const NesCpuHalf = circuit(
  'NesCpuHalf',
  ({ prgSize = 0x8000, vertical = 0 }: CartShape = {}) => ({
    inputs: { pad1: bus(8), pad2: bus(8), ppu_data: bus(8), nmi: bit },
    outputs: { ppu_cs: bit, ppu_addr: bus(3), rw: bit, wdata: bus(8), audio: bus(16) },
    nodes: {
      one: Constant({ value: 1 }),
      low: Constant({ value: 0 }),
      core: MOS6502_Core({ decimal: false, rdy: true, ce: true }),
      dma: OamDma,
      apu: Apu,
      regs: Rp2a03Regs,
      out0: Register({ width: 1 }),
      decoder: Ls139,
      bus: NesCpuBus,
      ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
      pads: NesPads,
      cart: NromCart({ prgSize, vertical }),
    },
    connect: ({ inputs: i, outputs: o, nodes: n }) => [
      n.one.out.to(
        n.core.ce,
        n.dma.ce,
        n.apu.ce,
        n.regs.ce,
        n.out0.we,
        n.decoder.m2,
        n.pads.m2,
        n.cart.m2,
      ),
      n.low.out.to(n.core.reset),
      i.nmi.to(n.core.nmi),
      n.cart.irq.to(n.regs.irq),
      n.apu.irq.to(n.regs.apu_irq),
      n.regs.cpu_irq.to(n.core.irq),
      n.core.addr.to(n.dma.cpu_addr),
      n.core.rw.to(n.dma.cpu_rw),
      n.core.data_out.to(n.dma.cpu_out),
      n.dma.rdy.to(n.core.rdy),
      n.dma.addr.to(n.regs.addr, n.decoder.addr, n.bus.addr),
      n.dma.rw.to(n.regs.rw, n.apu.rw, n.decoder.rw, n.cart.cpu_rw, o.rw),
      n.dma.out.to(n.regs.out, n.apu.data, n.ram.dataA, n.cart.cpu_wdata, o.wdata),
      n.bus.data.to(n.regs.pins),
      n.regs.read.to(n.core.data_in, n.dma.read),
      n.regs.apu_cs.to(n.apu.cs),
      n.regs.apu_addr.to(n.apu.addr),
      n.apu.data_out.to(n.regs.apu_data),
      n.apu.audio.to(o.audio),
      n.out0.q.to(n.regs.out0, n.pads.out0),
      n.regs.next_out0.to(n.out0.data),
      n.regs.oe1.to(n.pads.oe1, n.bus.oe1),
      n.regs.oe2.to(n.pads.oe2, n.bus.oe2),
      n.pads.data_out.to(n.bus.pads_data),
      i.pad1.to(n.pads.pad1),
      i.pad2.to(n.pads.pad2),
      n.decoder.ram_we.to(n.ram.weA),
      n.decoder.ppu_cs.to(o.ppu_cs),
      n.decoder.romsel.to(n.cart.romsel),
      n.bus.ram_addr.to(n.ram.addrA, n.ram.addrB),
      n.ram.outA.to(n.bus.ram_data),
      n.bus.ppu_addr.to(o.ppu_addr),
      i.ppu_data.to(n.bus.ppu_data),
      n.bus.cart_addr.to(n.cart.cpu_addr),
      n.cart.cpu_rdata.to(n.bus.cart_data),
    ],
  }),
);

/** The 2C02, nametable RAM and the cart's CHR. */
export const NesPpuHalf = circuit(
  'NesPpuHalf',
  ({ prgSize = 0x8000, vertical = 0 }: CartShape = {}) => ({
    inputs: { cs: bit, addr: bus(3), rw: bit, data_in: bus(8) },
    outputs: {
      data_out: bus(8),
      nmi: bit,
      video_x: bus(8),
      video_y: bus(8),
      video_we: bit,
      color: bus(6),
    },
    nodes: {
      ppu: Ppu,
      vbus: NesVramBus,
      ciram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
      cart: NromCart({ prgSize, vertical }),
    },
    connect: ({ inputs: i, outputs: o, nodes: n }) => [
      i.cs.to(n.ppu.cs),
      i.addr.to(n.ppu.addr),
      i.rw.to(n.ppu.rw),
      i.data_in.to(n.ppu.data_in),
      n.ppu.data_out.to(o.data_out),
      n.ppu.nmi.to(o.nmi),
      n.ppu.vram_addr.to(n.vbus.addr, n.cart.ppu_addr),
      n.ppu.vram_we.to(n.vbus.we, n.cart.ppu_we),
      n.ppu.vram_wdata.to(n.ciram.dataA, n.cart.ppu_wdata),
      n.cart.ppu_rdata.to(n.vbus.cart_data),
      n.cart.ciram_a10.to(n.vbus.ciram_a10),
      n.cart.ciram_ce.to(n.vbus.ciram_ce),
      n.vbus.ciram_addr.to(n.ciram.addrA, n.ciram.addrB),
      n.vbus.ciram_we.to(n.ciram.weA),
      n.ciram.outA.to(n.vbus.ciram_data),
      n.vbus.data.to(n.ppu.vram_rdata),
      n.ppu.video_x.to(o.video_x),
      n.ppu.video_y.to(o.video_y),
      n.ppu.video_we.to(o.video_we),
      n.ppu.color.to(o.color),
    ],
  }),
);
