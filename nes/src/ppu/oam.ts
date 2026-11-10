/**
 * Object attribute memory and sprite evaluation.
 *
 * OAM is 256 bytes inside the PPU, 4 per sprite for 64 sprites:
 *
 *   byte 0  Y, the line above the sprite's top row
 *   byte 1  tile
 *   byte 2  attributes: bit 7 flip vertically, 6 flip horizontally,
 *           5 behind the background, 1-0 palette (bits 4-2 don't exist and
 *           read 0)
 *   byte 3  X of the left column
 *
 * The CPU reaches it through OAMADDR ($2003) and OAMDATA ($2004): a write
 * stores at OAMADDR and steps it, a read returns the byte at OAMADDR. OAM DMA
 * is 256 writes to $2004.
 *
 * Evaluation. On each visible line, with rendering on, the PPU finds the
 * sprites on that line and copies up to 8 into secondary OAM (32 bytes), for
 * the fetch at dots 257-320 to load into the sprite units for the next line.
 * A sprite is on line L when 0 <= L - Y < 8 (16 with PPUCTRL bit 5), so it
 * shows from line Y + 1.
 *
 *   dots 1-64    secondary OAM cleared to $FF, a byte every 2 dots
 *   dots 65-256  a step every 2 dots: read OAM at OAMADDR, then
 *                - 8 sprites not yet found: copy the byte to secondary OAM.
 *                  It's a Y in range: keep it, copy the next 3 bytes. Not in
 *                  range: on to the next sprite (OAMADDR + 4).
 *                - 8 found: check the byte as a Y without copying. In range:
 *                  sprite overflow. Not in range: the next sprite, and
 *                  also the next byte within it (the hardware bug, so the
 *                  check slides onto tiles, attributes and X)
 *                - once OAMADDR wraps past the last sprite, nothing more.
 *   dots 257-320 OAMADDR = 0
 *
 * OAMADDR is the evaluation's counter (sprite n = bits 7-2, byte m = bits
 * 1-0), which is why evaluation starts wherever the CPU left it. The real
 * PPU reads on odd dots and writes on even ones; here both happen on the
 * even dot, which is the same since nothing moves OAMADDR in between.
 * After the overflow is found the real counter carries on through the
 * sprite's other bytes; here evaluation stops, which ends the same.
 *
 * `sprite0` goes up when the first sprite checked (dot 66) is in range: it
 * is then in slot 0 of the next line. During rendering, $2004 writes don't
 * store and step OAMADDR by 4, and reads on dots 1-64 return $FF.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, DualPortRAM, RAM, Register } from '@simten/core/std';

/**
 * Secondary OAM's port and evaluation's timing: cleared on dots 1-64, written
 * by evaluation on the even dots of 66-256, read by the fetch after.
 */
const PpuOamPort = circuit('PpuOamPort', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    found: bus(6),
    copy: bit,
    oam_rdata: bus(8),
    fetch_addr: bus(5),
  },
  outputs: {
    clearing: bit,
    step: bit,
    first_step: bit,
    sec_addr: bus(5),
    sec_we: bit,
    sec_wdata: bus(8),
  },
  meta: { category: 'nes', icon: 'P', description: 'PPU secondary OAM port' },
  eval: ({ dot, line, mask, found, copy, oam_rdata, fetch_addr }) => {
    const dt = dot as number;
    const visible = ((mask as number) & 0x18) !== 0 && (line as number) < 240;
    const clearing = visible && dt >= 1 && dt <= 64;
    let addr = fetch_addr as number;
    if (clearing) addr = ((dt - 1) >> 1) & 31;
    else if (visible && dt <= 256) addr = (found as number) & 31;
    return {
      clearing: clearing ? 1 : 0,
      step: visible && dt >= 66 && dt <= 256 && (dt & 1) === 0 ? 1 : 0,
      first_step: visible && dt === 66 ? 1 : 0,
      sec_addr: addr,
      sec_we: (clearing && (dt & 1) === 0) || copy === 1 ? 1 : 0,
      sec_wdata: clearing ? 0xff : (oam_rdata as number),
    };
  },
});

/** One step of evaluation. */
const PpuOamEval = circuit('PpuOamEval', {
  inputs: {
    line: bus(9),
    ctrl: bus(8),
    clearing: bit,
    step: bit,
    first_step: bit,
    oamaddr: bus(8),
    oam_rdata: bus(8),
    found: bus(6),
    done: bit,
    first: bit,
    overflow: bit,
    flags_clear: bit,
  },
  outputs: {
    addr_out: bus(8),
    copy: bit,
    next_found: bus(6),
    next_done: bit,
    next_first: bit,
    next_overflow: bit,
  },
  meta: { category: 'nes', icon: 'E', description: 'PPU sprite evaluation into secondary OAM' },
  eval: ({
    line,
    ctrl,
    clearing,
    step: tick,
    first_step,
    oamaddr,
    oam_rdata,
    found,
    done,
    first,
    overflow,
    flags_clear,
  }) => {
    const a = oamaddr as number;
    const f = found as number;
    const step = tick === 1 && done === 0;
    const row = (line as number) - (oam_rdata as number);
    const inRange = row >= 0 && row < (((ctrl as number) & 0x20) !== 0 ? 16 : 8);
    const copying = (a & 3) !== 0;
    const full = f === 32;

    // Copy mode steps OAMADDR by 1 through a sprite in range, by 4 past one
    // out of range; overflow mode by 5 with the byte index wrapping.
    let next = a + 1;
    if (full) next = ((a + 4) & 0x1fc) | ((a + 1) & 3);
    else if (!copying && !inRange) next = a + 4;

    const keep = step && !full && (copying || inRange);
    const stop = step && (next > 0xff || (full && inRange));
    const zero = first_step === 1 && inRange;
    let nextOverflow = overflow as number;
    if (flags_clear === 1) nextOverflow = 0;
    else if (step && full && inRange) nextOverflow = 1;

    // Dots 1-64 start the line over.
    if (clearing === 1) {
      return {
        addr_out: a,
        copy: 0,
        next_found: 0,
        next_done: 0,
        next_first: 0,
        next_overflow: nextOverflow,
      };
    }
    return {
      addr_out: step ? next & 0xff : a,
      copy: step && !full ? 1 : 0,
      next_found: f + (keep ? 1 : 0),
      next_done: (done as number) | (stop ? 1 : 0),
      next_first: (first as number) | (zero ? 1 : 0),
      next_overflow: nextOverflow,
    };
  },
});

/** $2003 and $2004, and OAMADDR's resets during rendering. */
const PpuOamCpu = circuit('PpuOamCpu', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    oamaddr: bus(8),
    oam_rdata: bus(8),
  },
  outputs: { next_oamaddr: bus(8), oam_we: bit, oam_wdata: bus(8), data_out: bus(8) },
  meta: { category: 'nes', icon: 'O', description: 'PPU OAM port: $2003, $2004' },
  eval: ({ cs, rw, addr, data_in, dot, line, mask, oamaddr, oam_rdata }) => {
    const dt = dot as number;
    const a = oamaddr as number;
    const d = data_in as number;
    const rendering = ((mask as number) & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const write = cs === 1 && rw === 0;
    let next = a;
    if (write && addr === 3) next = d;
    else if (write && addr === 4) next = rendering ? (a + 4) & 0xfc : (a + 1) & 0xff;
    else if (rendering && dt >= 257 && dt <= 320) next = 0;
    return {
      next_oamaddr: next,
      oam_we: write && addr === 4 && !rendering ? 1 : 0,
      // Attribute bits 4-2 aren't stored.
      oam_wdata: (a & 3) === 2 ? d & 0xe3 : d,
      data_out: rendering && dt >= 1 && dt <= 64 && line !== 261 ? 0xff : (oam_rdata as number),
    };
  },
});

export const PpuOam = circuit('PpuOam', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    flags_clear: bit,
    fetch_addr: bus(5),
  },
  outputs: {
    data_out: bus(8),
    sec_data: bus(8),
    found: bus(6),
    first: bit,
    overflow: bit,
  },
  nodes: {
    oam: RAM(),
    oamaddr: Register({ width: 8 }),
    secondary: DualPortRAM({ addressWidth: 5, dataWidth: 8 }),
    found: Register({ width: 6 }),
    done: Register({ width: 1 }),
    first: Register({ width: 1 }),
    overflow: Register({ width: 1 }),
    port: PpuOamPort,
    eval: PpuOamEval,
    cpu: PpuOamCpu,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.oamaddr.we, n.found.we, n.done.we, n.first.we, n.overflow.we),
    inputs.cs.to(n.cpu.cs),
    inputs.rw.to(n.cpu.rw),
    inputs.addr.to(n.cpu.addr),
    inputs.data_in.to(n.cpu.data_in),
    inputs.dot.to(n.port.dot, n.cpu.dot),
    inputs.line.to(n.eval.line, n.port.line, n.cpu.line),
    inputs.mask.to(n.port.mask, n.cpu.mask),
    inputs.ctrl.to(n.eval.ctrl),
    inputs.flags_clear.to(n.eval.flags_clear),
    inputs.fetch_addr.to(n.port.fetch_addr),
    n.port.clearing.to(n.eval.clearing),
    n.port.step.to(n.eval.step),
    n.port.first_step.to(n.eval.first_step),
    n.eval.copy.to(n.port.copy),
    n.oamaddr.q.to(n.eval.oamaddr, n.oam.addr),
    n.oam.data_out.to(n.eval.oam_rdata, n.port.oam_rdata, n.cpu.oam_rdata),
    n.eval.addr_out.to(n.cpu.oamaddr),
    n.cpu.next_oamaddr.to(n.oamaddr.data),
    n.cpu.oam_we.to(n.oam.we),
    n.cpu.oam_wdata.to(n.oam.data_in),
    n.cpu.data_out.to(outputs.data_out),
    n.port.sec_addr.to(n.secondary.addrA, n.secondary.addrB),
    n.port.sec_we.to(n.secondary.weA),
    n.port.sec_wdata.to(n.secondary.dataA),
    n.secondary.outA.to(outputs.sec_data),
    n.found.q.to(n.eval.found, n.port.found, outputs.found),
    n.eval.next_found.to(n.found.data),
    n.done.q.to(n.eval.done),
    n.eval.next_done.to(n.done.data),
    n.first.q.to(n.eval.first, outputs.first),
    n.eval.next_first.to(n.first.data),
    n.overflow.q.to(n.eval.overflow, outputs.overflow),
    n.eval.next_overflow.to(n.overflow.data),
  ],
});
