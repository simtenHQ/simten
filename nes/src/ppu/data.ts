/**
 * PPUDATA ($2007): the CPU's window into PPU memory at address v.
 *
 * PPU memory map (14 bits):
 *   $0000-$1FFF  pattern tables (CHR, on the cartridge)
 *   $2000-$2FFF  nametables (2 KB on the board, mirrored by the cartridge)
 *   $3000-$3EFF  mirror of $2000-$2EFF
 *   $3F00-$3FFF  palette RAM, inside the PPU: 32 bytes, mirrored; $3F10,
 *                $3F14, $3F18 and $3F1C are $3F00, $3F04, $3F08 and $3F0C
 *
 * Below $3F00 a read is buffered: it returns the byte the previous read
 * fetched and fetches the byte at v for next time. Palette reads come back
 * at once (bits 7-6 read 0 here; the real chip leaves them open bus), and
 * fetch the nametable byte underneath ($2F00-$2FFF) into the buffer.
 *
 * Accesses happen on the CPU's tick: the PPU drives v onto its bus that dot.
 * Rendering takes over the bus with the background.
 *
 * Palette RAM's second port turns the dot's pixel (a 5-bit palette index)
 * into the 6-bit colour sent to the screen; PPUMASK bit 0 (greyscale) keeps
 * only the colour's brightness bits.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, DualPortRAM, Register } from '@simten/core/std';

const PpuDataLogic = circuit('PpuDataLogic', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    v: bus(15),
    buffer: bus(8),
    vram_rdata: bus(8),
    pal_rdata: bus(6),
    pixel: bus(5),
    mask: bus(8),
    pal_colour: bus(6),
  },
  outputs: {
    data_out: bus(8),
    next_buffer: bus(8),
    vram_addr: bus(14),
    vram_we: bit,
    pal_addr: bus(5),
    pal_we: bit,
    pal_wdata: bus(6),
    pixel_addr: bus(5),
    color: bus(6),
  },
  meta: { category: 'nes', icon: 'D', description: 'PPU data port logic: $2007' },
  eval: ({ cs, rw, addr, data_in, v, buffer, vram_rdata, pal_rdata, pixel, mask, pal_colour }) => {
    const a = (v as number) & 0x3fff;
    const palette = a >= 0x3f00;
    const access = cs === 1 && addr === 7;
    const p = a & 0x1f;
    const px = pixel as number;
    return {
      data_out: palette ? (pal_rdata as number) : (buffer as number),
      next_buffer: access && rw === 1 ? (vram_rdata as number) : (buffer as number),
      vram_addr: palette ? a & 0x2fff : a,
      vram_we: access && rw === 0 && !palette ? 1 : 0,
      pal_addr: (p & 0x13) === 0x10 ? p & 0x0f : p,
      pal_we: access && rw === 0 && palette ? 1 : 0,
      pal_wdata: (data_in as number) & 0x3f,
      pixel_addr: (px & 0x13) === 0x10 ? px & 0x0f : px,
      color: ((mask as number) & 1) !== 0 ? (pal_colour as number) & 0x30 : (pal_colour as number),
    };
  },
});

export const PpuData = circuit('PpuData', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    v: bus(15),
    vram_rdata: bus(8),
    pixel: bus(5),
    mask: bus(8),
  },
  outputs: { data_out: bus(8), vram_addr: bus(14), vram_we: bit, color: bus(6) },
  nodes: {
    buffer: Register({ width: 8 }),
    palette: DualPortRAM({ addressWidth: 5, dataWidth: 6 }),
    logic: PpuDataLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.buffer.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.addr.to(n.logic.addr),
    inputs.data_in.to(n.logic.data_in),
    n.logic.pal_wdata.to(n.palette.dataA),
    inputs.v.to(n.logic.v),
    inputs.vram_rdata.to(n.logic.vram_rdata),
    n.buffer.q.to(n.logic.buffer),
    n.logic.next_buffer.to(n.buffer.data),
    inputs.pixel.to(n.logic.pixel),
    inputs.mask.to(n.logic.mask),
    n.logic.pal_addr.to(n.palette.addrA),
    n.logic.pixel_addr.to(n.palette.addrB),
    n.palette.outB.to(n.logic.pal_colour),
    n.logic.color.to(outputs.color),
    n.logic.pal_we.to(n.palette.weA),
    n.palette.outA.to(n.logic.pal_rdata),
    n.logic.data_out.to(outputs.data_out),
    n.logic.vram_addr.to(outputs.vram_addr),
    n.logic.vram_we.to(outputs.vram_we),
  ],
});
