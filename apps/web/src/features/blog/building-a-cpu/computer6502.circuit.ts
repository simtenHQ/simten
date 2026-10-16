/**
 * The 6502 computer for the "Building a CPU" post: the stdlib's MOS6502_Core
 * with 2 KB of RAM, a ROM, and a console, wired to the memory map that the
 * cc65 linker config (public/blog-assets/wasm/sim6502.cfg) expects:
 *
 *   $0000-$07FF  RAM (zero page, stack, variables)
 *   $C000-$FFFF  ROM (program, data and vectors)
 *   $F000        console: writing a byte prints it
 *
 * Same machine as the `6502-computer` example in the circuit editor.
 */

import { bit, bus, circuit } from '@simten/core/circuit';
import { Console, DualPortRAM, MOS6502_Core, ROM } from '@simten/core/std';

/** Places a cc65 binary (16 KB, linked for $C000) at its addresses in ROM. */
export function romImage(bin: Uint8Array): Record<number, number> {
  const image: Record<number, number> = {};
  for (let i = 0; i < bin.length; i++) {
    if (bin[i] !== 0) image[0xc000 + i] = bin[i];
  }
  return image;
}

const AddressDecode = circuit('Blog6502_AddressDecode', {
  inputs: { addr: bus(16), rw: bit, ram_data: bus(8), rom_data: bus(8) },
  outputs: { ram_addr: bus(11), ram_we: bit, console_we: bit, data: bus(8) },
  eval: ({ addr, rw, ram_data, rom_data }) => ({
    ram_addr: (addr as number) & 0x7ff,
    ram_we: !rw && (addr as number) < 0x0800 ? 1 : 0,
    console_we: !rw && addr === 0xf000 ? 1 : 0,
    data: (addr as number) < 0x0800 ? ram_data : rom_data,
  }),
});

/** The computer, with `rom` as its ROM contents (see `romImage`). */
export const Blog6502Computer = circuit(
  'Blog6502Computer',
  ({ rom = {} }: { rom?: Record<number, number> } = {}) => ({
    outputs: { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) },
    nodes: {
      cpu: MOS6502_Core({ debug: true }),
      decode: AddressDecode,
      ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
      rom: ROM({ memory: rom }),
      console: Console,
    },
    connect: ({ outputs, nodes: { cpu, decode, ram, rom: romNode, console: con } }) => [
      cpu.addr.to(decode.addr, romNode.addr),
      cpu.rw.to(decode.rw),
      decode.ram_addr.to(ram.addrA, ram.addrB),
      decode.ram_we.to(ram.weA),
      cpu.data_out.to(ram.dataA, con.data),
      ram.outA.to(decode.ram_data),
      romNode.data_out.to(decode.rom_data),
      decode.data.to(cpu.data_in),
      decode.console_we.to(con.we),
      cpu.pc.to(outputs.pc),
      cpu.a.to(outputs.a),
      cpu.x.to(outputs.x),
      cpu.y.to(outputs.y),
      cpu.s.to(outputs.s),
      cpu.p.to(outputs.p),
    ],
  }),
);
