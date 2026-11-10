/**
 * PPU timing: where the beam is. One tick is one dot; a scanline is dots
 * 0-340 and a frame is scanlines 0-261 (NTSC):
 *
 *   0-239    visible
 *   240      post-render, idle
 *   241-260  vertical blank; the vblank flag goes up at dot 1 of 241
 *   261      pre-render; vblank, sprite 0 hit and overflow clear at dot 1
 *
 * With rendering on (PPUMASK bit 3 or 4), every other frame skips the last
 * dot of the pre-render line, going from (261, 339) straight to (0, 0), so
 * odd frames are 89341 dots instead of 89342.
 *
 * Flag changes happen on the tick before the dot they belong to, so they
 * can be read from that dot on: `vbl_set` is high on (241, 0) and the flag
 * reads 1 from (241, 1).
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

/** Next dot, line and frame parity, and the flag events this dot. */
const PpuTimingLogic = circuit('PpuTimingLogic', {
  inputs: { dot: bus(9), line: bus(9), odd: bit, mask: bus(8) },
  outputs: {
    next_dot: bus(9),
    next_line: bus(9),
    next_odd: bit,
    vbl_set: bit,
    flags_clear: bit,
  },
  meta: { category: 'nes', icon: 'T', description: 'PPU timing logic: dot and scanline counting' },
  eval: ({ dot, line, odd, mask }) => {
    const rendering = ((mask as number) & 0x18) !== 0;
    const skip = rendering && odd === 1 && line === 261 && dot === 339;
    const endOfLine = dot === 340 || skip;
    const endOfFrame = endOfLine && line === 261;
    let nextLine = line as number;
    if (endOfFrame) nextLine = 0;
    else if (endOfLine) nextLine = (line as number) + 1;
    return {
      next_dot: endOfLine ? 0 : (dot as number) + 1,
      next_line: nextLine,
      next_odd: endOfFrame ? (odd as number) ^ 1 : (odd as number),
      vbl_set: line === 241 && dot === 0 ? 1 : 0,
      flags_clear: line === 261 && dot === 0 ? 1 : 0,
    };
  },
});

export const PpuTiming = circuit('PpuTiming', {
  inputs: { mask: bus(8) },
  outputs: { dot: bus(9), line: bus(9), vbl_set: bit, flags_clear: bit },
  nodes: {
    dot: Register({ width: 9 }),
    line: Register({ width: 9 }),
    odd: Register({ width: 1 }),
    logic: PpuTimingLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { dot, line, odd, logic, always } }) => [
    always.out.to(dot.we, line.we, odd.we),
    dot.q.to(logic.dot, outputs.dot),
    line.q.to(logic.line, outputs.line),
    odd.q.to(logic.odd),
    inputs.mask.to(logic.mask),
    logic.next_dot.to(dot.data),
    logic.next_line.to(line.data),
    logic.next_odd.to(odd.data),
    logic.vbl_set.to(outputs.vbl_set),
    logic.flags_clear.to(outputs.flags_clear),
  ],
});
