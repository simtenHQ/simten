/**
 * The NES: the console (the 6502 core, 2 KB of work RAM, the PPU, OAM DMA and
 * the controller ports) and, through the cartridge connector, a cartridge
 * (cart.ts). `NesConsole` is the console alone, with the connector as ports;
 * `Nes` is the console with an NROM cart plugged in.
 *
 * CPU memory map:
 *   $0000-$1FFF  2 KB work RAM, mirrored every $0800
 *   $2000-$3FFF  PPU registers, mirrored every 8 bytes (ppu/regs.ts).
 *   $4000-$401F  APU and I/O registers. $4014 is OAM DMA (dma.ts), which
 *                halts the CPU and copies a page to $2004; $4016 and $4017
 *                are the controller ports (pads.ts). The rest are a stub
 *                until the APU exists: reads $00, writes ignored.
 *   $4020-$FFFF  The cartridge. NROM puts PRG ROM at $8000 (16 KB mirrored
 *                at $C000, or 32 KB) and reads $00 below it, or its PRG RAM
 *                at $6000 if it has one. Open bus is not modelled.
 *
 * The CPU is the 2A03's: a 6502 with decimal mode disconnected (D still sets
 * and clears, ADC and SBC stay binary) and RDY driven by the OAM DMA unit.
 * PPU memory: the cartridge at $0000-$1FFF (NROM's 8 KB of CHR ROM), and the
 * console's 2 KB of nametable RAM at $2000-$3EFF, mirrored by the cartridge:
 * horizontal mirroring (iNES flag 0) makes $2000 = $2400 and $2800 = $2C00,
 * vertical makes $2000 = $2800 and $2400 = $2C00. Palette RAM is inside the
 * PPU.
 *
 * The PPU drives nmi and the cartridge irq. The core runs its reset sequence
 * at power-on and starts at the reset vector in $FFFC.
 *
 * `addr`, `rw` and `data` are the bus, so during a DMA they show the copy.
 *
 * One tick is one PPU dot. The CPU runs on every third tick (`ce`, the
 * connector's `m2`), as the 2A03 does from the same crystal, and work RAM and
 * the DMA unit act only on those ticks, so a CPU cycle reads or writes each
 * device once. Between them the bus holds the cycle the next CPU tick runs.
 * Step one CPU cycle with `sim.tick(3)`.
 *
 * Load a cartridge's ROMs with
 * `simulate(Nes(...), { memory: { 'cart.prg': ..., 'cart.chr': ... } })`, or
 * use `createNes`.
 */

import { bit, bus, circuit, simulate } from '@simten/core';
import { Constant, DualPortRAM, MOS6502_Core, romFromBytes } from '@simten/core/std';
import { CART_INPUTS, CART_OUTPUTS, NromCart } from './cart.js';
import { OamDma } from './dma.js';
import type { INesRom } from './ines.js';
import { NesPads } from './pads.js';
import { Ppu } from './ppu/ppu.js';

type B = ReturnType<typeof bus>;

/**
 * Address decode and the CPU's read data mux. $4020 and up is the
 * cartridge's: the console reads whatever the cart drives there.
 */
const NesBus = circuit('NesBus', {
  inputs: {
    addr: bus(16),
    rw: bit,
    ce: bit,
    cpu_out: bus(8),
    ram_data: bus(8),
    ppu_data: bus(8),
    pads_data: bus(8),
    cart_data: bus(8),
  },
  outputs: {
    ram_addr: bus(11),
    ram_we: bit,
    ppu_cs: bit,
    ppu_addr: bus(3),
    pads_cs: bit,
    pads_port: bit,
    cart_addr: bus(15),
    romsel: bit,
    cpu_in: bus(8),
    data: bus(8),
  },
  eval: ({ addr, rw, ce, cpu_out, ram_data, ppu_data, pads_data, cart_data }) => {
    const ppu = addr >= 0x2000 && addr < 0x4000;
    const pads = addr === 0x4016 || addr === 0x4017;
    let read = 0;
    if (addr < 0x2000) read = ram_data;
    else if (ppu) read = ppu_data;
    else if (pads) read = pads_data;
    else if (addr >= 0x4020) read = cart_data;
    return {
      ram_addr: addr & 0x7ff,
      ram_we: ce && !rw && addr < 0x2000 ? 1 : 0,
      ppu_cs: ce && ppu ? 1 : 0,
      ppu_addr: addr & 7,
      pads_cs: ce && pads ? 1 : 0,
      pads_port: addr & 1,
      cart_addr: addr & 0x7fff,
      romsel: (addr >> 15) & 1,
      cpu_in: read,
      data: rw ? read : cpu_out,
    };
  },
});

/**
 * PPU memory: the console's nametable RAM where the cartridge enables it,
 * at the address the cartridge's CIRAM A10 picks; otherwise the cart.
 */
const NesVramBus = circuit('NesVramBus', {
  inputs: {
    addr: bus(14),
    we: bit,
    cart_data: bus(8),
    ciram_data: bus(8),
    ciram_a10: bit,
    ciram_ce: bit,
  },
  outputs: { ciram_addr: bus(11), ciram_we: bit, data: bus(8) },
  eval: ({ addr, we, cart_data, ciram_data, ciram_a10, ciram_ce }) => ({
    ciram_addr: (ciram_a10 << 10) | (addr & 0x3ff),
    ciram_we: we && ciram_ce ? 1 : 0,
    data: ciram_ce ? ciram_data : cart_data,
  }),
});

/** The CPU's clock enable: high on every third tick, starting with the first. */
const CpuClock = circuit('CpuClock', {
  outputs: { ce: bit },
  state: { phase: 0 },
  eval: ({ phase }) => ({ ce: phase === 0 ? 1 : 0 }),
  onTick: ({ phase }) => ({ phase: phase === 2 ? 0 : ((phase as number) + 1) & 3 }),
});

type BoardOuts = {
  addr: B;
  rw: typeof bit;
  sync: typeof bit;
  data: B;
  video_x: B;
  video_y: B;
  video_we: typeof bit;
  color: B;
  pc: B;
  a: B;
  x: B;
  y: B;
  s: B;
  p: B;
};

/** What the console and the whole NES both output. */
const consoleOutputs = (debug: boolean) =>
  ({
    addr: bus(16),
    rw: bit,
    sync: bit,
    data: bus(8),
    video_x: bus(8),
    video_y: bus(8),
    video_we: bit,
    color: bus(6),
    ...(debug ? { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) } : {}),
  }) as unknown as BoardOuts;

/**
 * The console without a cartridge: its connector is ports (see cart.ts).
 * `debug` adds the core's register outputs (`pc`, `a`, `x`, `y`, `s`, `p`).
 * `addr`, `rw`, `sync` and `data` (the byte the CPU reads or writes this
 * cycle) are always outputs, and so is the PPU's video: `color` for pixel
 * (`video_x`, `video_y`) on ticks where `video_we` is high.
 * Inputs `pad1` and `pad2` are the controllers' buttons, 1 = pressed (see
 * `BUTTON` in pads.ts).
 */
export const NesConsole = circuit('NesConsole', ({ debug = false }: { debug?: boolean } = {}) => ({
  inputs: { pad1: bus(8), pad2: bus(8), ...CART_OUTPUTS },
  outputs: { ...consoleOutputs(debug), ...CART_INPUTS },
  nodes: {
    clock: CpuClock,
    cpu: MOS6502_Core({ debug, decimal: false, rdy: true, ce: true }),
    dma: OamDma,
    ppu: Ppu,
    pads: NesPads,
    bus: NesBus,
    ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
    vbus: NesVramBus,
    ciram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
    low: Constant({ value: 0 }),
  },
  connect: ({
    inputs: i,
    outputs: o,
    nodes: { clock, cpu, dma, ppu, pads, bus: b, ram, vbus, ciram, low },
  }) => {
    const rows = [
      clock.ce.to(cpu.ce, dma.ce, b.ce, o.m2),
      low.out.to(cpu.reset),
      i.irq.to(cpu.irq),
      ppu.nmi.to(cpu.nmi),
      b.ppu_cs.to(ppu.cs),
      b.ppu_addr.to(ppu.addr),
      ppu.data_out.to(b.ppu_data),
      b.pads_cs.to(pads.cs),
      b.pads_port.to(pads.port),
      pads.data_out.to(b.pads_data),
      i.pad1.to(pads.pad1),
      i.pad2.to(pads.pad2),
      cpu.addr.to(dma.cpu_addr),
      cpu.rw.to(dma.cpu_rw),
      cpu.data_out.to(dma.cpu_out),
      dma.rdy.to(cpu.rdy),
      dma.addr.to(b.addr, o.addr),
      dma.rw.to(b.rw, o.rw, ppu.rw, pads.rw, o.cpu_rw),
      dma.out.to(ram.dataA, b.cpu_out, ppu.data_in, pads.data_in, o.cpu_wdata),
      cpu.sync.to(o.sync),
      b.ram_addr.to(ram.addrA, ram.addrB),
      b.ram_we.to(ram.weA),
      ram.outA.to(b.ram_data),
      b.cart_addr.to(o.cpu_addr),
      b.romsel.to(o.romsel),
      i.cpu_rdata.to(b.cart_data),
      b.cpu_in.to(cpu.data_in, dma.read),
      b.data.to(o.data),
      ppu.vram_addr.to(vbus.addr, o.ppu_addr),
      ppu.vram_we.to(vbus.we, o.ppu_we),
      ppu.vram_wdata.to(ciram.dataA, o.ppu_wdata),
      i.ppu_rdata.to(vbus.cart_data),
      i.ciram_a10.to(vbus.ciram_a10),
      i.ciram_ce.to(vbus.ciram_ce),
      vbus.ciram_addr.to(ciram.addrA, ciram.addrB),
      vbus.ciram_we.to(ciram.weA),
      ciram.outA.to(vbus.ciram_data),
      vbus.data.to(ppu.vram_rdata),
      ppu.video_x.to(o.video_x),
      ppu.video_y.to(o.video_y),
      ppu.video_we.to(o.video_we),
      ppu.color.to(o.color),
    ];
    if (debug) {
      rows.push(
        cpu.pc.to(o.pc),
        cpu.a.to(o.a),
        cpu.x.to(o.x),
        cpu.y.to(o.y),
        cpu.s.to(o.s),
        cpu.p.to(o.p),
      );
    }
    return rows;
  },
}));

/**
 * The console with an NROM cartridge plugged in. `prgSize` is 0x4000 (16 KB,
 * mirrored) or 0x8000 (32 KB); `vertical` is 1 for vertical nametable
 * mirroring; `wram` 1 adds 8 KB of PRG RAM at $6000. Ports as `NesConsole`'s,
 * less the connector. The ROMs are nodes `cart.prg` and `cart.chr`.
 */
export const Nes = circuit(
  'Nes',
  ({
    prgSize = 0x8000,
    vertical = 0,
    wram = 0,
    debug = false,
  }: {
    prgSize?: number;
    vertical?: number;
    wram?: number;
    debug?: boolean;
  } = {}) => ({
    inputs: { pad1: bus(8), pad2: bus(8) },
    outputs: consoleOutputs(debug),
    nodes: {
      console: NesConsole({ debug }),
      cart: NromCart({ prgSize, vertical, wram }),
    },
    connect: ({ inputs: i, outputs: o, nodes: { console: c, cart } }) => {
      const rows = [
        i.pad1.to(c.pad1),
        i.pad2.to(c.pad2),
        c.cpu_addr.to(cart.cpu_addr),
        c.romsel.to(cart.romsel),
        c.m2.to(cart.m2),
        c.cpu_rw.to(cart.cpu_rw),
        c.cpu_wdata.to(cart.cpu_wdata),
        c.ppu_addr.to(cart.ppu_addr),
        c.ppu_we.to(cart.ppu_we),
        c.ppu_wdata.to(cart.ppu_wdata),
        cart.cpu_rdata.to(c.cpu_rdata),
        cart.irq.to(c.irq),
        cart.ppu_rdata.to(c.ppu_rdata),
        cart.ciram_a10.to(c.ciram_a10),
        cart.ciram_ce.to(c.ciram_ce),
        c.addr.to(o.addr),
        c.rw.to(o.rw),
        c.sync.to(o.sync),
        c.data.to(o.data),
        c.video_x.to(o.video_x),
        c.video_y.to(o.video_y),
        c.video_we.to(o.video_we),
        c.color.to(o.color),
      ];
      if (debug) {
        rows.push(c.pc.to(o.pc), c.a.to(o.a), c.x.to(o.x), c.y.to(o.y), c.s.to(o.s), c.p.to(o.p));
      }
      return rows;
    },
  }),
);

/** A running NES with `rom` inserted. Throws for anything but NROM. */
export function createNes(
  rom: INesRom,
  { debug = false, wram = 0 }: { debug?: boolean; wram?: number } = {},
) {
  if (rom.mapper !== 0) {
    throw new Error(`NES board: mapper ${rom.mapper} is not supported (only NROM, mapper 0)`);
  }
  if (rom.prg.length !== 0x4000 && rom.prg.length !== 0x8000) {
    throw new Error(`NES board: NROM PRG ROM must be 16 or 32 KB, got ${rom.prg.length} bytes`);
  }
  if (rom.chr.length !== 0x2000) {
    throw new Error(`NES board: NROM needs 8 KB of CHR ROM, got ${rom.chr.length} bytes`);
  }
  const vertical = rom.mirroring === 'vertical' ? 1 : 0;
  return simulate(Nes({ prgSize: rom.prg.length, vertical, wram, debug }), {
    memory: { 'cart.prg': romFromBytes(rom.prg), 'cart.chr': romFromBytes(rom.chr) },
  });
}
