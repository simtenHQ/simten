/**
 * The NES picture processor (2C02), built up block by block (#601). So far:
 * timing (dot and scanline, vblank), the CPU-facing registers with NMI, the
 * scroll/address registers, the $2007 data port with palette RAM, and the
 * background.
 *
 * One tick is one dot. The CPU side is `cs` (high for one tick per CPU access
 * to $2000-$3FFF), `rw`, `addr` (the low 3 address bits) and the data buses.
 * The memory side is the PPU's own bus to the board: `vram_addr` (14 bits),
 * `vram_we`, `vram_wdata` out and `vram_rdata` in, read the same tick.
 *
 * Video out: on dots 1-256 of lines 0-239 `video_we` is high and `color` is
 * the 6-bit colour of pixel (`video_x`, `video_y`) = (dot - 1, line).
 */

import { bit, bus, circuit } from '@simten/core';
import { PpuBackground } from './background.js';
import { PpuData } from './data.js';
import { PpuRegs } from './regs.js';
import { PpuScroll } from './scroll.js';
import { PpuTiming } from './timing.js';

/** Where the dot lands on screen, if it does. */
const PpuVideo = circuit('PpuVideo', {
  inputs: { dot: bus(9), line: bus(9) },
  outputs: { video_x: bus(8), video_y: bus(8), video_we: bit },
  meta: { category: 'nes', icon: 'V', description: 'PPU video position' },
  eval: ({ dot, line }) => ({
    video_x: ((dot as number) - 1) & 0xff,
    video_y: (line as number) & 0xff,
    video_we: (line as number) < 240 && (dot as number) >= 1 && (dot as number) <= 256 ? 1 : 0,
  }),
});

export const Ppu = circuit('Ppu', {
  inputs: { cs: bit, rw: bit, addr: bus(3), data_in: bus(8), vram_rdata: bus(8) },
  outputs: {
    data_out: bus(8),
    nmi: bit,
    dot: bus(9),
    line: bus(9),
    vram_addr: bus(14),
    vram_we: bit,
    vram_wdata: bus(8),
    video_x: bus(8),
    video_y: bus(8),
    video_we: bit,
    color: bus(6),
  },
  nodes: {
    timing: PpuTiming,
    regs: PpuRegs,
    scroll: PpuScroll,
    data: PpuData,
    background: PpuBackground,
    video: PpuVideo,
  },
  connect: ({ inputs, outputs, nodes: { timing, regs, scroll, data, background, video } }) => [
    inputs.cs.to(regs.cs, scroll.cs, data.cs),
    inputs.rw.to(regs.rw, scroll.rw, data.rw),
    inputs.addr.to(regs.addr, scroll.addr, data.addr),
    inputs.data_in.to(regs.data_in, scroll.data_in, data.data_in, outputs.vram_wdata),
    inputs.vram_rdata.to(data.vram_rdata, background.vram_rdata),
    regs.mask.to(timing.mask, scroll.mask, background.mask, data.mask),
    regs.ctrl.to(scroll.ctrl, background.ctrl),
    timing.dot.to(scroll.dot, background.dot, video.dot, outputs.dot),
    timing.line.to(scroll.line, background.line, video.line, outputs.line),
    scroll.v.to(data.v, background.v),
    scroll.x.to(background.x),
    data.data_out.to(regs.data7),
    data.vram_addr.to(background.data_addr),
    background.vram_addr.to(outputs.vram_addr),
    data.vram_we.to(outputs.vram_we),
    background.pixel.to(data.pixel),
    data.color.to(outputs.color),
    timing.vbl_set.to(regs.vbl_set),
    timing.flags_clear.to(regs.flags_clear),
    regs.data_out.to(outputs.data_out),
    regs.nmi.to(outputs.nmi),
    video.video_x.to(outputs.video_x),
    video.video_y.to(outputs.video_y),
    video.video_we.to(outputs.video_we),
  ],
});
