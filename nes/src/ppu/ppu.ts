/**
 * The NES picture processor (2C02), built up block by block (#601). So far:
 * timing (dot and scanline, vblank) and the CPU-facing registers with NMI.
 *
 * One tick is one dot. The CPU side is `cs` (high for one tick per CPU access
 * to $2000-$3FFF), `rw`, `addr` (the low 3 address bits) and the data buses.
 */

import { bit, bus, circuit } from '@simten/core';
import { PpuRegs } from './regs.js';
import { PpuTiming } from './timing.js';

export const Ppu = circuit('Ppu', {
  inputs: { cs: bit, rw: bit, addr: bus(3), data_in: bus(8) },
  outputs: { data_out: bus(8), nmi: bit, dot: bus(9), line: bus(9) },
  nodes: { timing: PpuTiming, regs: PpuRegs },
  connect: ({ inputs, outputs, nodes: { timing, regs } }) => [
    inputs.cs.to(regs.cs),
    inputs.rw.to(regs.rw),
    inputs.addr.to(regs.addr),
    inputs.data_in.to(regs.data_in),
    regs.mask.to(timing.mask),
    timing.vbl_set.to(regs.vbl_set),
    timing.flags_clear.to(regs.flags_clear),
    regs.data_out.to(outputs.data_out),
    regs.nmi.to(outputs.nmi),
    timing.dot.to(outputs.dot),
    timing.line.to(outputs.line),
  ],
});
