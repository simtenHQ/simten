/**
 * The APU's frame counter, and the APU clock.
 *
 * The APU runs from the CPU clock. Pulse timers step on every other CPU cycle
 * (an "APU cycle"); `apu` is high on those. The frame counter counts CPU
 * cycles and clocks the other units at fixed points in its sequence:
 *
 *   4-step (29830 cycles): quarter at 7457, quarter+half at 14913, quarter
 *     at 22371, quarter+half at 29829. The frame IRQ flag sets at 29828,
 *     29829 and the first cycle of the next sequence, unless inhibited.
 *   5-step (37282 cycles): quarter at 7457, quarter+half at 14913, quarter
 *     at 22371, quarter+half at 37281. No IRQ.
 *
 * Quarter frames clock the envelopes and the triangle's linear counter; half
 * frames also clock the length counters and sweeps.
 *
 * A $4017 write (`MI-- ----`) sets the mode and IRQ inhibit at once (setting
 * I clears the flag) and restarts the sequence 3 CPU cycles later if written
 * on an APU cycle, 4 if not. In 5-step mode the restart also clocks a quarter
 * and a half frame. Reading $4015 clears the flag.
 *
 * `cs`, `rw`, `addr` (A0-A4) and `data` are the CPU bus; `cs` is high on CPU
 * cycles that access the APU. Everything steps on CPU cycles only (`ce`).
 */

import { bit, bus, circuit } from '@simten/core';

interface FrameState {
  /** CPU cycles since the sequence started. */
  cycle: number;
  five: number;
  inhibit: number;
  flag: number;
  /** CPU cycles until a $4017 write restarts the sequence; 0 if none. */
  delay: number;
  /** 1 on the cycle after a 5-step restart: clock quarter and half. */
  force: number;
  /** 1 on the first cycle of a 4-step sequence reached by wrapping. */
  wrap: number;
  /** 1 on APU cycles. */
  odd: number;
}

interface FrameIn extends FrameState {
  ce: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
}

export const ApuFrame = circuit('ApuFrame', {
  inputs: { ce: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8) },
  outputs: { apu: bit, quarter: bit, half: bit, irq: bit },
  state: { cycle: 0, five: 0, inhibit: 0, flag: 0, delay: 0, force: 0, wrap: 0, odd: 0 },
  eval: ({ ce, cycle, five, force, odd, flag }: FrameIn) => {
    const end = five ? 37281 : 29829;
    const quarter = cycle === 7457 || cycle === 14913 || cycle === 22371 || cycle === end;
    const half = cycle === 14913 || cycle === end;
    return {
      apu: ce && odd ? 1 : 0,
      quarter: ce && (quarter || force) ? 1 : 0,
      half: ce && (half || force) ? 1 : 0,
      irq: flag,
    };
  },
  onTick: ({
    ce,
    cs,
    rw,
    addr,
    data,
    cycle,
    five,
    inhibit,
    flag,
    delay,
    force,
    wrap,
    odd,
  }: FrameIn) => {
    if (!ce) return { cycle, five, inhibit, flag, delay, force, wrap, odd };
    const end = five ? 37281 : 29829;
    let nCycle = cycle >= end ? 0 : (cycle + 1) & 0xffff;
    let nForce = 0;
    let nDelay = delay;
    if (delay) {
      nDelay = (delay - 1) & 7;
      if (delay === 1) {
        nCycle = 0;
        nForce = five;
      }
    }
    const set = !five && !inhibit && (cycle === 29828 || cycle === 29829 || (cycle === 0 && wrap));
    let nFlag = cs && rw && addr === 0x15 ? 0 : flag;
    if (set) nFlag = 1;
    let nFive = five;
    let nInhibit = inhibit;
    if (cs && !rw && addr === 0x17) {
      nFive = (data >> 7) & 1;
      nInhibit = (data >> 6) & 1;
      if (nInhibit) nFlag = 0;
      nDelay = odd ? 3 : 4;
    }
    return {
      cycle: nCycle,
      five: nFive,
      inhibit: nInhibit,
      flag: nFlag,
      delay: nDelay,
      force: nForce,
      wrap: !five && cycle >= end ? 1 : 0,
      odd: (odd ^ 1) & 1,
    };
  },
  meta: { category: 'io', icon: 'FC', description: 'NES APU frame counter ($4017)' },
});
