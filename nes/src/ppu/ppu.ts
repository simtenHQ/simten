/**
 * The NES picture processor (2C02), built up block by block (#601). So far:
 * timing (dot and scanline, vblank), the CPU-facing registers with NMI, the
 * scroll/address registers and the $2007 data port with palette RAM.
 *
 * One tick is one dot. The CPU side is `cs` (high for one tick per CPU access
 * to $2000-$3FFF), `rw`, `addr` (the low 3 address bits) and the data buses.
 * The memory side is the PPU's own bus to the board: `vram_addr` (14 bits),
 * `vram_we`, `vram_wdata` out and `vram_rdata` in, read the same tick.
 */

import { bit, bus, circuit } from '@simten/core';
import { PpuData } from './data.js';
import { PpuRegs } from './regs.js';
import { PpuScroll } from './scroll.js';
import { PpuTiming } from './timing.js';

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
  },
  nodes: { timing: PpuTiming, regs: PpuRegs, scroll: PpuScroll, data: PpuData },
  connect: ({ inputs, outputs, nodes: { timing, regs, scroll, data } }) => [
    inputs.cs.to(regs.cs, scroll.cs, data.cs),
    inputs.rw.to(regs.rw, scroll.rw, data.rw),
    inputs.addr.to(regs.addr, scroll.addr, data.addr),
    inputs.data_in.to(regs.data_in, scroll.data_in, data.data_in, outputs.vram_wdata),
    inputs.vram_rdata.to(data.vram_rdata),
    regs.mask.to(timing.mask),
    regs.ctrl.to(scroll.ctrl),
    scroll.v.to(data.v),
    data.data_out.to(regs.data7),
    timing.vbl_set.to(regs.vbl_set),
    timing.flags_clear.to(regs.flags_clear),
    regs.data_out.to(outputs.data_out),
    regs.nmi.to(outputs.nmi),
    timing.dot.to(outputs.dot),
    timing.line.to(outputs.line),
    data.vram_addr.to(outputs.vram_addr),
    data.vram_we.to(outputs.vram_we),
  ],
});
