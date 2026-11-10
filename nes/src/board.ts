/**
 * An NES board with an NROM (mapper 0) cartridge: the 6502 core, 2 KB of work
 * RAM, PRG ROM, and stubs for the PPU and APU registers.
 *
 * CPU memory map:
 *   $0000-$1FFF  2 KB work RAM, mirrored every $0800
 *   $2000-$3FFF  PPU registers, mirrored every 8 bytes. Stub: writes are
 *                ignored, $2002 (PPUSTATUS) reads $80 (vblank set) so the
 *                usual "wait for vblank" loops at boot fall through, and the
 *                other registers read $00.
 *   $4000-$401F  APU and I/O registers. Stub: reads $00, writes ignored.
 *                $4014 (OAM DMA) is not implemented yet; it needs the core's
 *                RDY pin to stall the CPU.
 *   $4020-$7FFF  Cartridge space NROM leaves empty. Reads $00 (open bus is
 *                not modelled).
 *   $8000-$FFFF  PRG ROM: 32 KB, or 16 KB mirrored at $C000.
 *
 * irq and nmi are tied low until the PPU and APU exist. The core runs its
 * reset sequence at power-on and starts at the reset vector in $FFFC.
 *
 * The PRG ROM node is `prg`: load a cartridge with
 * `simulate(NesBoard(...), { memory: { prg: ... } })`, or use `createNes`.
 */

import { bit, bus, circuit, simulate } from '@simten/core';
import { Constant, DualPortRAM, MOS6502_Core, ROM, romFromBytes } from '@simten/core/std';
import type { INesRom } from './ines.js';

type B = ReturnType<typeof bus>;

/** Address decode and the CPU's read data mux. */
const NesBus = circuit('NesBus', ({ prgSize = 0x8000 }: { prgSize?: number } = {}) => ({
  inputs: { addr: bus(16), rw: bit, cpu_out: bus(8), ram_data: bus(8), prg_data: bus(8) },
  outputs: { ram_addr: bus(11), ram_we: bit, prg_addr: bus(16), cpu_in: bus(8), data: bus(8) },
  eval: ({ addr, rw, cpu_out, ram_data, prg_data }) => {
    let read = 0;
    if (addr < 0x2000) read = ram_data;
    else if (addr < 0x4000) read = (addr & 7) === 2 ? 0x80 : 0;
    else if (addr >= 0x8000) read = prg_data;
    return {
      ram_addr: addr & 0x7ff,
      ram_we: !rw && addr < 0x2000 ? 1 : 0,
      prg_addr: addr & (prgSize - 1),
      cpu_in: read,
      data: rw ? read : cpu_out,
    };
  },
}));

type BoardOuts = {
  addr: B;
  rw: typeof bit;
  sync: typeof bit;
  data: B;
  pc: B;
  a: B;
  x: B;
  y: B;
  s: B;
  p: B;
};

/**
 * The board. `prgSize` is 0x4000 (16 KB, mirrored) or 0x8000 (32 KB).
 * `debug` adds the core's register outputs (`pc`, `a`, `x`, `y`, `s`, `p`).
 * `addr`, `rw`, `sync` and `data` (the byte the CPU reads or writes this
 * cycle) are always outputs.
 */
export const NesBoard = circuit(
  'NesBoard',
  ({ prgSize = 0x8000, debug = false }: { prgSize?: number; debug?: boolean } = {}) => {
    // The register ports exist only with `debug`, but stay in the type so the
    // connect below can name them.
    const outputs = {
      addr: bus(16),
      rw: bit,
      sync: bit,
      data: bus(8),
      ...(debug ? { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) } : {}),
    } as unknown as BoardOuts;

    return {
      outputs,
      nodes: {
        cpu: MOS6502_Core({ debug }),
        bus: NesBus({ prgSize }),
        ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
        prg: ROM(),
        low: Constant({ value: 0 }),
      },
      connect: ({ outputs: o, nodes: { cpu, bus: b, ram, prg, low } }) => {
        const rows = [
          low.out.to(cpu.irq, cpu.nmi, cpu.reset),
          cpu.addr.to(b.addr, o.addr),
          cpu.rw.to(b.rw, o.rw),
          cpu.sync.to(o.sync),
          b.ram_addr.to(ram.addrA, ram.addrB),
          b.ram_we.to(ram.weA),
          cpu.data_out.to(ram.dataA, b.cpu_out),
          ram.outA.to(b.ram_data),
          b.prg_addr.to(prg.addr),
          prg.data_out.to(b.prg_data),
          b.cpu_in.to(cpu.data_in),
          b.data.to(o.data),
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
  return simulate(NesBoard({ prgSize: rom.prg.length, debug }), {
    memory: { prg: romFromBytes(rom.prg) },
  });
}
