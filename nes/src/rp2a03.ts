/**
 * The RP2A03, the NES's CPU chip: a 6502 core without decimal mode, the APU,
 * OAM DMA, the clock divider, and its own registers at $4000-$401F. On the
 * board it is the chip marked CPU. Its pins:
 *
 *   addr      A0-A15, from the core or, during a DMA, the DMA unit
 *   data_in   D0-D7 when reading: what the board drives onto the bus
 *   data_out  D0-D7 when writing
 *   rw        R/W, 1 = read
 *   m2        M2, high on the ticks a CPU cycle completes (every third)
 *   irq, nmi  /IRQ and /NMI, active high here
 *   out0      OUT0: bit 0 of the last $4016 write, the controllers' strobe
 *   oe1, oe2  /OE1 and /OE2, active high here: this cycle reads $4016 or
 *             $4017, so the board puts the controller's bit on D0
 *   audio     the APU's mixed output (the real chip has two analog pins)
 *
 * `data` is the byte on the core's own bus this cycle: the byte written, or
 * the byte read, which for $4015 is the APU's status from inside the chip,
 * not the pins.
 *
 * The 2A03's register file decodes $4000-$401F itself: $4000-$4013, $4015
 * and $4017 writes go to the APU, $4014 to the DMA unit, $4016 writes set
 * OUT0, $4016 and $4017 reads drive /OE1 and /OE2. The rest of the address
 * space is the board's (74LS139 and friends).
 *
 * One tick is one PPU dot; the real chip divides the master clock by 12 and
 * the PPU by 4, so a CPU cycle is three ticks. M2 is high on the first.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, MOS6502_Core, Register } from '@simten/core/std';
import { Apu } from './apu/apu.js';
import { OamDma } from './dma.js';

type Port = ReturnType<typeof bus>;

/** The CPU's clock enable: high on every third tick, starting with the first. */
const CpuClock = circuit('CpuClock', {
  outputs: { ce: bit },
  state: { phase: 0 },
  eval: ({ phase }) => ({ ce: phase === 0 ? 1 : 0 }),
  onTick: ({ phase }) => ({ phase: phase === 2 ? 0 : ((phase as number) + 1) & 3 }),
});

/**
 * The 2A03's registers at $4000-$401F: which unit a cycle addresses, the
 * OUT0 latch's next value, the core's read data, and the IRQ line.
 */
export const Rp2a03Regs = circuit('Rp2a03Regs', {
  inputs: {
    addr: bus(16),
    rw: bit,
    ce: bit,
    out: bus(8),
    pins: bus(8),
    apu_data: bus(8),
    apu_irq: bit,
    irq: bit,
    out0: bit,
  },
  outputs: {
    apu_cs: bit,
    apu_addr: bus(5),
    oe1: bit,
    oe2: bit,
    next_out0: bit,
    read: bus(8),
    data: bus(8),
    cpu_irq: bit,
  },
  meta: { category: 'nes', icon: 'R', description: '2A03 registers: $4000-$401F' },
  eval: ({ addr, rw, ce, out, pins, apu_data, apu_irq, irq, out0 }) => {
    // $4000-$4013, $4015 and $4017 writes. $4014 is OAM DMA.
    const apu = (addr >= 0x4000 && addr < 0x4014) || addr === 0x4015 || (addr === 0x4017 && !rw);
    const read = addr === 0x4015 ? apu_data : pins;
    return {
      apu_cs: ce && apu ? 1 : 0,
      apu_addr: addr & 0x1f,
      oe1: addr === 0x4016 && rw ? 1 : 0,
      oe2: addr === 0x4017 && rw ? 1 : 0,
      next_out0: ce && addr === 0x4016 && !rw ? out & 1 : out0,
      read,
      data: rw ? read : out,
      cpu_irq: apu_irq || irq ? 1 : 0,
    };
  },
});

type CpuOuts = {
  addr: Port;
  data_out: Port;
  rw: typeof bit;
  m2: typeof bit;
  sync: typeof bit;
  out0: typeof bit;
  oe1: typeof bit;
  oe2: typeof bit;
  audio: Port;
  data: Port;
  pc: Port;
  a: Port;
  x: Port;
  y: Port;
  s: Port;
  p: Port;
};

/** `debug` adds the core's registers as outputs (`pc`, `a`, `x`, `y`, `s`, `p`). */
export const Rp2a03 = circuit('Rp2a03', ({ debug = false }: { debug?: boolean } = {}) => ({
  inputs: { data_in: bus(8), irq: bit, nmi: bit },
  outputs: {
    addr: bus(16),
    data_out: bus(8),
    rw: bit,
    m2: bit,
    sync: bit,
    out0: bit,
    oe1: bit,
    oe2: bit,
    audio: bus(16),
    data: bus(8),
    ...(debug ? { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) } : {}),
  } as unknown as CpuOuts,
  nodes: {
    clock: CpuClock,
    core: MOS6502_Core({ debug, decimal: false, rdy: true, ce: true }),
    dma: OamDma,
    apu: Apu,
    regs: Rp2a03Regs,
    out0: Register({ width: 1 }),
    low: Constant({ value: 0 }),
    high: Constant({ value: 1 }),
  },
  connect: ({ inputs: i, outputs: o, nodes: { clock, core, dma, apu, regs, out0, low, high } }) => {
    const rows = [
      clock.ce.to(core.ce, dma.ce, apu.ce, regs.ce, o.m2),
      low.out.to(core.reset),
      high.out.to(out0.we),
      i.nmi.to(core.nmi),
      i.irq.to(regs.irq),
      apu.irq.to(regs.apu_irq),
      regs.cpu_irq.to(core.irq),
      core.addr.to(dma.cpu_addr),
      core.rw.to(dma.cpu_rw),
      core.data_out.to(dma.cpu_out),
      dma.rdy.to(core.rdy),
      dma.addr.to(regs.addr, o.addr),
      dma.rw.to(regs.rw, apu.rw, o.rw),
      dma.out.to(regs.out, apu.data, o.data_out),
      i.data_in.to(regs.pins),
      regs.read.to(core.data_in, dma.read),
      regs.data.to(o.data),
      regs.apu_cs.to(apu.cs),
      regs.apu_addr.to(apu.addr),
      apu.data_out.to(regs.apu_data),
      apu.audio.to(o.audio),
      out0.q.to(regs.out0, o.out0),
      regs.next_out0.to(out0.data),
      regs.oe1.to(o.oe1),
      regs.oe2.to(o.oe2),
      core.sync.to(o.sync),
    ];
    if (debug) {
      rows.push(
        core.pc.to(o.pc),
        core.a.to(o.a),
        core.x.to(o.x),
        core.y.to(o.y),
        core.s.to(o.s),
        core.p.to(o.p),
      );
    }
    return rows;
  },
}));
