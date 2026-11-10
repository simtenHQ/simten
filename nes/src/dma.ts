/**
 * OAM DMA, the 2A03's sprite copy. Writing $XX to $4014 copies the 256 bytes
 * at $XX00-$XXFF to $2004 (OAMDATA), one byte every two cycles, while the CPU
 * is held off the bus through RDY.
 *
 * It sits between the CPU and the bus. While idle it passes the CPU's address,
 * rw and write data straight through. After the $4014 write:
 *
 *   1. Halt: RDY goes low. The CPU stops on its next read cycle (a write cycle
 *      always completes, so the unit waits for a read). That cycle is spent.
 *   2. Align: reads only happen on "get" cycles, every other CPU cycle. If the
 *      cycle after the halt is a "put" cycle, one cycle is spent waiting.
 *   3. 256 pairs: a get cycle reads $XX00+n onto the bus, the put cycle after
 *      writes that byte to $2004.
 *
 * So the CPU loses 513 cycles, or 514 when it needs the alignment cycle. RDY
 * goes high after the last put and the CPU repeats the read it stopped on.
 * During the halt and align cycles the CPU's own address stays on the bus, as
 * a read.
 *
 * It steps on CPU cycles only (`ce`). Get and put cycles alternate from
 * power-on: even CPU cycles are gets. The real chip takes the phase from its
 * APU clock divider, which this doesn't model.
 */

import { bit, bus, circuit } from '@simten/core';

/** Idle, waiting for the CPU to halt, copying. */
const IDLE = 0;
const HALTING = 1;
const COPYING = 2;

interface DmaState {
  phase: number;
  /** High byte of the source page. */
  page: number;
  /** Bytes copied so far. */
  n: number;
  /** 1 between a get and its put: `latch` holds the byte. */
  held: number;
  latch: number;
  /** 1 on put cycles. */
  odd: number;
}

interface DmaIn extends DmaState {
  ce: number;
  cpu_addr: number;
  cpu_rw: number;
  cpu_out: number;
  /** What the bus read this cycle. */
  read: number;
}

export const OamDma = circuit('OamDma', {
  inputs: { ce: bit, cpu_addr: bus(16), cpu_rw: bit, cpu_out: bus(8), read: bus(8) },
  outputs: { rdy: bit, addr: bus(16), rw: bit, out: bus(8) },
  state: { phase: 0, page: 0, n: 0, held: 0, latch: 0, odd: 0 },
  eval: ({ cpu_addr, cpu_rw, cpu_out, phase, page, n, held, latch, odd }: DmaIn) => {
    const rdy = phase === IDLE ? 1 : 0;
    if (phase === COPYING && held) return { rdy, addr: 0x2004, rw: 0, out: latch };
    if (phase === COPYING && !odd) return { rdy, addr: (page << 8) | n, rw: 1, out: cpu_out };
    return { rdy, addr: cpu_addr, rw: cpu_rw, out: cpu_out };
  },
  onTick: ({ ce, cpu_addr, cpu_rw, cpu_out, read, phase, page, n, held, latch, odd }: DmaIn) => {
    if (!ce) return { phase, page, n, held, latch, odd };
    const s: DmaState = { phase, page, n, held, latch, odd: odd ^ 1 };
    if (phase === IDLE) {
      if (!cpu_rw && cpu_addr === 0x4014) return { ...s, phase: HALTING, page: cpu_out };
    } else if (phase === HALTING) {
      // RDY was low: on a read cycle the CPU halted, on a write it carried on.
      if (cpu_rw) return { ...s, phase: COPYING, n: 0, held: 0 };
    } else if (held) {
      const done = n + 1 === 256;
      return { ...s, phase: done ? IDLE : COPYING, n: done ? 0 : n + 1, held: 0 };
    } else if (!odd) {
      return { ...s, held: 1, latch: read };
    }
    return s;
  },
  meta: { category: 'io', icon: 'DMA', description: 'NES OAM DMA ($4014)', synthesizable: false },
});
