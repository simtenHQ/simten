/**
 * An NES board with an NROM (mapper 0) cartridge: the 6502 core, 2 KB of work
 * RAM, PRG ROM, and stubs for the PPU and APU registers.
 *
 * CPU memory map:
 *   $0000-$1FFF  2 KB work RAM, mirrored every $0800
 *   $2000-$3FFF  PPU registers, mirrored every 8 bytes (ppu/regs.ts).
 *   $4000-$401F  APU and I/O registers. Stub: reads $00, writes ignored,
 *                except $4014 (OAM DMA, see dma.ts), which halts the CPU
 *                and copies a page to $2004.
 *   $4020-$7FFF  Cartridge space NROM leaves empty. Reads $00 (open bus is
 *                not modelled).
 *   $8000-$FFFF  PRG ROM: 32 KB, or 16 KB mirrored at $C000.
 *
 * The CPU is the 2A03's: a 6502 with decimal mode disconnected (D still sets
 * and clears, ADC and SBC stay binary) and RDY driven by the OAM DMA unit.
 * PPU memory: CHR ROM (8 KB) at $0000-$1FFF, and 2 KB of nametable RAM at
 * $2000-$3EFF, mirrored as the cartridge's header says: horizontal mirroring
 * (iNES flag 0) makes $2000 = $2400 and $2800 = $2C00, vertical makes
 * $2000 = $2800 and $2400 = $2C00. Palette RAM is inside the PPU.
 *
 * The PPU drives nmi. irq is tied low until the APU exists. The core runs its
 * reset sequence at power-on and starts at the reset vector in $FFFC.
 *
 * `addr`, `rw` and `data` are the bus, so during a DMA they show the copy.
 *
 * One tick is one PPU dot. The CPU runs on every third tick (`ce`), as the
 * 2A03 does from the same crystal, and work RAM and the DMA unit act only on
 * those ticks, so a CPU cycle reads or writes each device once. Between them
 * the bus holds the cycle the next CPU tick runs. Step one CPU cycle with
 * `sim.tick(3)`.
 *
 * The PRG ROM node is `prg`: load a cartridge with
 * `simulate(NesBoard(...), { memory: { prg: ... } })`, or use `createNes`.
 */

import { bit, bus, circuit, simulate } from '@simten/core';
import { Constant, DualPortRAM, MOS6502_Core, ROM, romFromBytes } from '@simten/core/std';
import { OamDma } from './dma.js';
import type { INesRom } from './ines.js';
import { Ppu } from './ppu/ppu.js';

type B = ReturnType<typeof bus>;

/** Address decode and the CPU's read data mux. */
const NesBus = circuit('NesBus', ({ prgSize = 0x8000 }: { prgSize?: number } = {}) => ({
  inputs: {
    addr: bus(16),
    rw: bit,
    ce: bit,
    cpu_out: bus(8),
    ram_data: bus(8),
    ppu_data: bus(8),
    prg_data: bus(8),
  },
  outputs: {
    ram_addr: bus(11),
    ram_we: bit,
    ppu_cs: bit,
    ppu_addr: bus(3),
    prg_addr: bus(16),
    cpu_in: bus(8),
    data: bus(8),
  },
  eval: ({ addr, rw, ce, cpu_out, ram_data, ppu_data, prg_data }) => {
    const ppu = addr >= 0x2000 && addr < 0x4000;
    let read = 0;
    if (addr < 0x2000) read = ram_data;
    else if (ppu) read = ppu_data;
    else if (addr >= 0x8000) read = prg_data;
    return {
      ram_addr: addr & 0x7ff,
      ram_we: ce && !rw && addr < 0x2000 ? 1 : 0,
      ppu_cs: ce && ppu ? 1 : 0,
      ppu_addr: addr & 7,
      prg_addr: addr & (prgSize - 1),
      cpu_in: read,
      data: rw ? read : cpu_out,
    };
  },
}));

/** PPU address decode: CHR ROM, or nametable RAM through the mirroring. */
const NesVramBus = circuit('NesVramBus', ({ vertical = 0 }: { vertical?: number } = {}) => ({
  inputs: { addr: bus(14), we: bit, chr_data: bus(8), ciram_data: bus(8) },
  outputs: { chr_addr: bus(16), ciram_addr: bus(11), ciram_we: bit, data: bus(8) },
  eval: ({ addr, we, chr_data, ciram_data }) => {
    const nametable = addr >= 0x2000;
    const page = vertical ? (addr >> 10) & 1 : (addr >> 11) & 1;
    return {
      chr_addr: addr & 0x1fff,
      ciram_addr: (page << 10) | (addr & 0x3ff),
      ciram_we: we && nametable ? 1 : 0,
      data: nametable ? ciram_data : chr_data,
    };
  },
}));

/** The CPU's clock enable: high on every third tick, starting with the first. */
const CpuClock = circuit('CpuClock', {
  outputs: { ce: bit },
  state: { phase: 0 },
  eval: ({ phase }) => ({ ce: phase === 0 ? 1 : 0 }),
  onTick: ({ phase }) => ({ phase: phase === 2 ? 0 : (phase as number) + 1 }),
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

/**
 * The board. `prgSize` is 0x4000 (16 KB, mirrored) or 0x8000 (32 KB);
 * `vertical` is 1 for vertical nametable mirroring.
 * `debug` adds the core's register outputs (`pc`, `a`, `x`, `y`, `s`, `p`).
 * `addr`, `rw`, `sync` and `data` (the byte the CPU reads or writes this
 * cycle) are always outputs, and so is the PPU's video: `color` for pixel
 * (`video_x`, `video_y`) on ticks where `video_we` is high.
 */
export const NesBoard = circuit(
  'NesBoard',
  ({
    prgSize = 0x8000,
    vertical = 0,
    debug = false,
  }: {
    prgSize?: number;
    vertical?: number;
    debug?: boolean;
  } = {}) => {
    // The register ports exist only with `debug`, but stay in the type so the
    // connect below can name them.
    const outputs = {
      addr: bus(16),
      rw: bit,
      sync: bit,
      data: bus(8),
      video_x: bus(8),
      video_y: bus(8),
      video_we: bit,
      color: bus(6),
      ...(debug ? { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) } : {}),
    } as unknown as BoardOuts;

    return {
      outputs,
      nodes: {
        clock: CpuClock,
        cpu: MOS6502_Core({ debug, decimal: false, rdy: true, ce: true }),
        dma: OamDma,
        ppu: Ppu,
        bus: NesBus({ prgSize }),
        ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
        prg: ROM(),
        vbus: NesVramBus({ vertical }),
        chr: ROM(),
        ciram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
        low: Constant({ value: 0 }),
      },
      connect: ({
        outputs: o,
        nodes: { clock, cpu, dma, ppu, bus: b, ram, prg, vbus, chr, ciram, low },
      }) => {
        const rows = [
          clock.ce.to(cpu.ce, dma.ce, b.ce),
          low.out.to(cpu.irq, cpu.reset),
          ppu.nmi.to(cpu.nmi),
          b.ppu_cs.to(ppu.cs),
          b.ppu_addr.to(ppu.addr),
          ppu.data_out.to(b.ppu_data),
          cpu.addr.to(dma.cpu_addr),
          cpu.rw.to(dma.cpu_rw),
          cpu.data_out.to(dma.cpu_out),
          dma.rdy.to(cpu.rdy),
          dma.addr.to(b.addr, o.addr),
          dma.rw.to(b.rw, o.rw, ppu.rw),
          dma.out.to(ram.dataA, b.cpu_out, ppu.data_in),
          cpu.sync.to(o.sync),
          b.ram_addr.to(ram.addrA, ram.addrB),
          b.ram_we.to(ram.weA),
          ram.outA.to(b.ram_data),
          b.prg_addr.to(prg.addr),
          prg.data_out.to(b.prg_data),
          b.cpu_in.to(cpu.data_in, dma.read),
          b.data.to(o.data),
          ppu.vram_addr.to(vbus.addr),
          ppu.vram_we.to(vbus.we),
          ppu.vram_wdata.to(ciram.dataA),
          vbus.chr_addr.to(chr.addr),
          chr.data_out.to(vbus.chr_data),
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
    };
  },
);

/** A running NES with `rom` inserted. Throws for anything but NROM. */
export function createNes(rom: INesRom, { debug = false }: { debug?: boolean } = {}) {
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
  return simulate(NesBoard({ prgSize: rom.prg.length, vertical, debug }), {
    memory: { prg: romFromBytes(rom.prg), chr: romFromBytes(rom.chr) },
  });
}
