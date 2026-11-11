/**
 * The cartridge connector, and the NROM (mapper 0) cartridge.
 *
 * The NES splits at a 72-pin edge connector: the console brings out the CPU
 * and PPU buses, and the cartridge decides what answers on them. That is
 * where mappers live, and also the nametable mirroring: the cart wires the
 * console's 2 KB of nametable RAM (CIRAM) through its A10 and chip-enable
 * pins. The ports here are those pins, with two simplifications:
 *
 * - `romsel` is CPU A15, active high. The real /ROMSEL is active low and
 *   gated by M2; `m2` is passed separately as the CPU cycle strobe (the
 *   board's `ce`), and a cart writes on `m2 && !cpu_rw`.
 * - The data buses are split into read and write halves, and a cart drives
 *   `cpu_rdata` with 0 where real hardware would leave the bus open.
 *
 * Console to cart: `cpu_addr` (A0-A14), `romsel`, `m2`, `cpu_rw`,
 * `cpu_wdata`, `ppu_addr` (A0-A13), `ppu_we`, `ppu_wdata`.
 * Cart to console: `cpu_rdata`, `irq`, `ppu_rdata`, `ciram_a10`, `ciram_ce`.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, DualPortRAM, ROM, type romFromBytes } from '@simten/core/std';

/** ROM contents, as `romFromBytes` makes them. */
type Contents = ReturnType<typeof romFromBytes>;

/** The connector's ports, from the cartridge's side. */
export const CART_INPUTS = {
  cpu_addr: bus(15),
  romsel: bit,
  m2: bit,
  cpu_rw: bit,
  cpu_wdata: bus(8),
  ppu_addr: bus(14),
  ppu_we: bit,
  ppu_wdata: bus(8),
};
export const CART_OUTPUTS = {
  cpu_rdata: bus(8),
  irq: bit,
  ppu_rdata: bus(8),
  ciram_a10: bit,
  ciram_ce: bit,
};

/** NROM's address decode. */
const NromDecode = circuit(
  'NromDecode',
  (_opts: { prgSize?: number; vertical?: number; wram?: number } = {}) => ({
    inputs: {
      cpu_addr: bus(15),
      romsel: bit,
      m2: bit,
      cpu_rw: bit,
      ppu_addr: bus(14),
      prg_data: bus(8),
      chr_data: bus(8),
      wram_data: bus(8),
    },
    outputs: {
      prg_addr: bus(16),
      chr_addr: bus(16),
      wram_addr: bus(13),
      wram_we: bit,
      cpu_rdata: bus(8),
      ppu_rdata: bus(8),
      ciram_a10: bit,
      ciram_ce: bit,
    },
    eval: ({
      cpu_addr,
      romsel,
      m2,
      cpu_rw,
      ppu_addr,
      prg_data,
      chr_data,
      wram_data,
      prgSize = 0x8000,
      vertical = 0,
      wram = 0,
    }) => {
      // $6000-$7FFF: A15 low, A14 and A13 high.
      const ram = wram && !romsel && (cpu_addr & 0x6000) === 0x6000;
      let read = 0;
      if (romsel) read = prg_data;
      else if (ram) read = wram_data;
      return {
        prg_addr: cpu_addr & ((prgSize as number) - 1),
        chr_addr: ppu_addr & 0x1fff,
        wram_addr: cpu_addr & 0x1fff,
        wram_we: ram && m2 && !cpu_rw ? 1 : 0,
        cpu_rdata: read,
        ppu_rdata: chr_data,
        // The mirroring pad: vertical mirroring wires CIRAM A10 to PPU A10,
        // horizontal to PPU A11.
        ciram_a10: vertical ? (ppu_addr >> 10) & 1 : (ppu_addr >> 11) & 1,
        // CIRAM answers at $2000-$3FFF (PPU A13), CHR ROM below.
        ciram_ce: (ppu_addr >> 13) & 1,
      };
    },
  }),
);

/**
 * NROM: 16 or 32 KB of PRG ROM (`prgSize`; 16 KB mirrors at $C000), 8 KB of
 * CHR ROM, and fixed mirroring (`vertical` 1 for vertical). `wram` 1 adds
 * 8 KB of PRG RAM at $6000-$7FFF, which plain NROM boards lack but test
 * cartridges and some homebrew use. The ROMs are nodes `prg` and `chr`:
 * load them through `simulate`'s `memory`, or bake contents in with `prg`
 * and `chr`.
 */
export const NromCart = circuit(
  'NromCart',
  ({
    prgSize = 0x8000,
    vertical = 0,
    wram = 0,
    prg,
    chr,
  }: {
    prgSize?: number;
    vertical?: number;
    wram?: number;
    prg?: Contents;
    chr?: Contents;
  } = {}) => {
    // The RAM exists only with `wram`; it stays in the node type so the
    // connect below can name it.
    const ram = DualPortRAM({ addressWidth: 13, dataWidth: 8 });
    const nodes = {
      decode: NromDecode({ prgSize, vertical, wram }),
      prg: ROM(prg ? { memory: prg } : {}),
      chr: ROM(chr ? { memory: chr } : {}),
      low: Constant({ value: 0 }),
      ...(wram ? { ram } : {}),
    } as {
      decode: ReturnType<typeof NromDecode>;
      prg: ReturnType<typeof ROM>;
      chr: ReturnType<typeof ROM>;
      low: ReturnType<typeof Constant>;
      ram: typeof ram;
    };
    return {
      inputs: CART_INPUTS,
      outputs: CART_OUTPUTS,
      nodes,
      connect: ({ inputs: i, outputs: o, nodes: n }) => {
        const rows = [
          i.cpu_addr.to(n.decode.cpu_addr),
          i.romsel.to(n.decode.romsel),
          i.m2.to(n.decode.m2),
          i.cpu_rw.to(n.decode.cpu_rw),
          i.ppu_addr.to(n.decode.ppu_addr),
          n.decode.prg_addr.to(n.prg.addr),
          n.prg.data_out.to(n.decode.prg_data),
          n.decode.chr_addr.to(n.chr.addr),
          n.chr.data_out.to(n.decode.chr_data),
          n.decode.cpu_rdata.to(o.cpu_rdata),
          n.decode.ppu_rdata.to(o.ppu_rdata),
          n.decode.ciram_a10.to(o.ciram_a10),
          n.decode.ciram_ce.to(o.ciram_ce),
          n.low.out.to(o.irq),
        ];
        if (wram) {
          rows.push(
            i.cpu_wdata.to(n.ram.dataA),
            n.decode.wram_addr.to(n.ram.addrA),
            n.decode.wram_we.to(n.ram.weA),
            n.ram.outA.to(n.decode.wram_data),
          );
        }
        return rows;
      },
    };
  },
);
