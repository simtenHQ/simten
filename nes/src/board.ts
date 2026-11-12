/**
 * The NES: the console and, through the cartridge connector, a cartridge
 * (cart.ts). `NesConsole` is the console alone, with the connector as ports;
 * `Nes` is the console with an NROM cart plugged in.
 *
 * The console is grouped as the board is built. On the CPU bus: the 2A03
 * (`cpu`, rp2a03.ts: the 6502 core, the APU, OAM DMA and its registers at
 * $4000-$401F), 2 KB of work RAM, the 74LS139 address decoder, and the
 * controller ports, which the 2A03 drives through OUT0, /OE1 and /OE2. On
 * the PPU bus: the PPU and 2 KB of nametable RAM.
 *
 * CPU memory map:
 *   $0000-$1FFF  2 KB work RAM, mirrored every $0800
 *   $2000-$3FFF  PPU registers, mirrored every 8 bytes (ppu/regs.ts).
 *   $4000-$401F  The 2A03's own registers. The APU (apu/) has $4000-$4013,
 *                $4015 and $4017 writes. $4014 is OAM DMA (dma.ts), which
 *                halts the CPU and copies a page to $2004; $4016 and $4017
 *                reads are the controller ports (pads.ts). The rest read $00.
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
 * The PPU drives nmi; the APU's frame IRQ and the cartridge drive irq. `audio`
 * is the APU's mixed output, one 16-bit sample per tick. The core runs its reset sequence
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
import { DualPortRAM, romFromBytes } from '@simten/core/std';
import { CART_INPUTS, CART_OUTPUTS, NromCart } from './cart.js';
import type { INesRom } from './ines.js';
import { NesPads } from './pads.js';
import { Ppu } from './ppu/ppu.js';
import { Rp2a03 } from './rp2a03.js';

type B = ReturnType<typeof bus>;

/**
 * The 74LS139 address decoder. One half splits $0000-$7FFF by A13-A14:
 * work RAM at $0000-$1FFF, the PPU at $2000-$3FFF ($4000-$5FFF is the
 * 2A03's own, and the cartridge's above $4020). The other half makes
 * /ROMSEL from A15. Selects for a cycle that writes or touches a register
 * fire on M2; `romsel` is A15 itself, as the cartridge sees it.
 */
export const Ls139 = circuit('Ls139', {
  inputs: { addr: bus(16), rw: bit, m2: bit },
  outputs: { ram_we: bit, ppu_cs: bit, romsel: bit },
  meta: { category: 'nes', icon: '139', description: '74LS139 address decoder' },
  eval: ({ addr, rw, m2 }) => ({
    ram_we: m2 && !rw && addr < 0x2000 ? 1 : 0,
    ppu_cs: m2 && addr >= 0x2000 && addr < 0x4000 ? 1 : 0,
    romsel: (addr >> 15) & 1,
  }),
});

/**
 * The CPU data bus: who drives D0-D7 on a read. Work RAM below $2000, the
 * PPU to $3FFF, the controller ports while the 2A03 enables one, and the
 * cartridge from $4020. Nothing else drives it, so it reads 0 there ($4015
 * is read inside the 2A03). Also the address lines each device takes.
 */
export const NesCpuBus = circuit('NesCpuBus', {
  inputs: {
    addr: bus(16),
    oe1: bit,
    oe2: bit,
    ram_data: bus(8),
    ppu_data: bus(8),
    pads_data: bus(8),
    cart_data: bus(8),
  },
  outputs: { ram_addr: bus(11), ppu_addr: bus(3), cart_addr: bus(15), data: bus(8) },
  eval: ({ addr, oe1, oe2, ram_data, ppu_data, pads_data, cart_data }) => {
    let data = 0;
    if (addr < 0x2000) data = ram_data;
    else if (addr < 0x4000) data = ppu_data;
    else if (oe1 || oe2) data = pads_data;
    else if (addr >= 0x4020) data = cart_data;
    return { ram_addr: addr & 0x7ff, ppu_addr: addr & 7, cart_addr: addr & 0x7fff, data };
  },
});

/**
 * PPU memory: the console's nametable RAM where the cartridge enables it,
 * at the address the cartridge's CIRAM A10 picks; otherwise the cart.
 */
export const NesVramBus = circuit('NesVramBus', {
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

type BoardOuts = {
  addr: B;
  rw: typeof bit;
  sync: typeof bit;
  data: B;
  video_x: B;
  video_y: B;
  video_we: typeof bit;
  color: B;
  audio: B;
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
    audio: bus(16),
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
    cpu: Rp2a03({ debug }),
    decoder: Ls139,
    bus: NesCpuBus,
    ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
    pads: NesPads,
    ppu: Ppu,
    vbus: NesVramBus,
    ciram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
  },
  connect: ({
    inputs: i,
    outputs: o,
    nodes: { cpu, decoder, bus: b, ram, pads, ppu, vbus, ciram },
  }) => {
    const rows = [
      cpu.m2.to(decoder.m2, pads.m2, o.m2),
      cpu.addr.to(decoder.addr, b.addr, o.addr),
      cpu.rw.to(decoder.rw, ppu.rw, o.rw, o.cpu_rw),
      cpu.data_out.to(ram.dataA, ppu.data_in, o.cpu_wdata),
      b.data.to(cpu.data_in),
      cpu.data.to(o.data),
      cpu.sync.to(o.sync),
      cpu.audio.to(o.audio),
      i.irq.to(cpu.irq),
      ppu.nmi.to(cpu.nmi),
      decoder.ram_we.to(ram.weA),
      decoder.ppu_cs.to(ppu.cs),
      decoder.romsel.to(o.romsel),
      b.ram_addr.to(ram.addrA, ram.addrB),
      ram.outA.to(b.ram_data),
      b.ppu_addr.to(ppu.addr),
      ppu.data_out.to(b.ppu_data),
      cpu.out0.to(pads.out0),
      cpu.oe1.to(pads.oe1, b.oe1),
      cpu.oe2.to(pads.oe2, b.oe2),
      pads.data_out.to(b.pads_data),
      i.pad1.to(pads.pad1),
      i.pad2.to(pads.pad2),
      b.cart_addr.to(o.cpu_addr),
      i.cpu_rdata.to(b.cart_data),
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
 * less the connector. The ROMs are nodes `cart.prg` and `cart.chr`; `prg`
 * and `chr` bake contents in instead.
 */
export const Nes = circuit(
  'Nes',
  ({
    prgSize = 0x8000,
    vertical = 0,
    wram = 0,
    debug = false,
    prg,
    chr,
  }: {
    prgSize?: number;
    vertical?: number;
    wram?: number;
    prg?: ReturnType<typeof romFromBytes>;
    chr?: ReturnType<typeof romFromBytes>;
    debug?: boolean;
  } = {}) => ({
    inputs: { pad1: bus(8), pad2: bus(8) },
    outputs: consoleOutputs(debug),
    nodes: {
      console: NesConsole({ debug }),
      cart: NromCart({ prgSize, vertical, wram, prg, chr }),
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
        c.audio.to(o.audio),
      ];
      if (debug) {
        rows.push(c.pc.to(o.pc), c.a.to(o.a), c.x.to(o.x), c.y.to(o.y), c.s.to(o.s), c.p.to(o.p));
      }
      return rows;
    },
  }),
);

// editor-example:end (the /circuit example stops here: below is test tooling)

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
