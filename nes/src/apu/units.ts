/**
 * APU units shared by the channels: envelope, length counter and its table,
 * and the gate in front of the mixer. Also the status register ($4015) and
 * the DMC's output level, which is only its direct load ($4011) for now.
 * See frame.ts for the clocks and bus inputs.
 */

import { bit, bus, circuit } from '@simten/core';

interface EnvelopeIn {
  ce: number;
  quarter: number;
  restart: number;
  loop: number;
  constant: number;
  period: number;
  start: number;
  divider: number;
  decay: number;
}

/**
 * Envelope (pulse and noise). A write to the channel's 4th register sets the
 * start flag (`restart`). On a quarter frame: if started, decay = 15 and the
 * divider reloads with `period`; otherwise the divider counts down, and at 0
 * reloads and steps decay down, from 0 back to 15 if `loop`. The volume is
 * `period` itself with `constant`, else decay.
 */
export const ApuEnvelope = circuit('ApuEnvelope', {
  inputs: { ce: bit, quarter: bit, restart: bit, loop: bit, constant: bit, period: bus(4) },
  outputs: { volume: bus(4) },
  state: { start: 0, divider: 0, decay: 0 },
  eval: ({ constant, period, decay }: EnvelopeIn) => ({ volume: constant ? period : decay }),
  onTick: ({ ce, quarter, restart, loop, period, start, divider, decay }: EnvelopeIn) => {
    if (!ce) return { start, divider, decay };
    let s = start;
    let dv = divider;
    let dc = decay;
    if (quarter) {
      if (s) {
        s = 0;
        dc = 15;
        dv = period;
      } else if (dv === 0) {
        dv = period;
        if (dc > 0) dc = dc - 1;
        else if (loop) dc = 15;
      } else {
        dv = dv - 1;
      }
    }
    if (restart) s = 1;
    return { start: s, divider: dv & 15, decay: dc & 15 };
  },
  meta: { category: 'io', icon: 'ENV', description: 'NES APU envelope' },
});

interface LengthIn {
  ce: number;
  half: number;
  halt: number;
  load: number;
  value: number;
  enabled: number;
  count: number;
}

/**
 * Length counter (pulse, triangle, noise). Loads `value` (from the table) on
 * `load`, a write to the channel's 4th register, only while `enabled`.
 * Counts down on half frames unless halted. Disabling the channel clears it.
 * `active` is count > 0: the channel sounds, and $4015 reads it.
 */
export const ApuLength = circuit('ApuLength', {
  inputs: { ce: bit, half: bit, halt: bit, load: bit, value: bus(8), enabled: bit },
  outputs: { active: bit },
  state: { count: 0 },
  eval: ({ count }: LengthIn) => ({ active: count > 0 ? 1 : 0 }),
  onTick: ({ ce, half, halt, load, value, enabled, count }: LengthIn) => {
    if (!ce) return { count };
    let c = count;
    if (half && !halt && c > 0) c = c - 1;
    if (load && enabled) c = value;
    if (!enabled) c = 0;
    return { count: c & 0xff };
  },
  meta: { category: 'io', icon: 'LEN', description: 'NES APU length counter' },
});

/**
 * The 32-entry length table, indexed by the top 5 bits of the 4th register:
 * odd entries are 254, 2, 4, …, 30; even entries are two runs of note
 * lengths, 10-based and 12-based.
 */
export const ApuLengthTable = circuit('ApuLengthTable', {
  inputs: { data: bus(8) },
  outputs: { value: bus(8) },
  eval: ({ data }) => {
    const i = (data as number) >> 3;
    if (i & 1) return { value: i === 1 ? 254 : i - 1 };
    const j = i >> 1;
    const base = j & 8 ? 12 : 10;
    const k = j & 7;
    if (k < 5) return { value: (base << k) & 0xff };
    if (k === 5) return { value: base * 6 };
    if (k === 6) return { value: j & 8 ? 16 : 14 };
    return { value: j & 8 ? 32 : 26 };
  },
  meta: { category: 'io', icon: 'LUT', description: 'NES APU length table' },
});

/** A channel's output: its volume while it sounds, else 0. */
export const ApuGate = circuit('ApuGate', {
  inputs: { gate: bit, active: bit, volume: bus(4) },
  outputs: { out: bus(4) },
  eval: ({ gate, active, volume }) => ({ out: gate && active ? volume : 0 }),
  meta: { category: 'io', icon: 'AND', description: 'NES APU channel gate' },
});

interface StatusIn {
  ce: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
  p1: number;
  p2: number;
  t: number;
  n: number;
  irq: number;
  enables: number;
}

/**
 * $4015. Writes (`---D NT21`) enable the channels; reads return the length
 * counters' activity and the frame IRQ (`-F-- NT21`; DMC bits are 0 for now).
 */
export const ApuStatus = circuit('ApuStatus', {
  inputs: {
    ce: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    p1: bit,
    p2: bit,
    t: bit,
    n: bit,
    irq: bit,
  },
  outputs: { en_p1: bit, en_p2: bit, en_t: bit, en_n: bit, data_out: bus(8) },
  state: { enables: 0 },
  // A write clears the disabled channels' length counters on its own edge,
  // so the enables pass the bus straight through while it writes.
  eval: ({ cs, rw, addr, data, p1, p2, t, n, irq, enables }: StatusIn) => {
    const en = cs && !rw && addr === 0x15 ? data & 15 : enables;
    return {
      en_p1: en & 1,
      en_p2: (en >> 1) & 1,
      en_t: (en >> 2) & 1,
      en_n: (en >> 3) & 1,
      data_out: (irq << 6) | (n << 3) | (t << 2) | (p2 << 1) | p1,
    };
  },
  onTick: ({ ce, cs, rw, addr, data, enables }: StatusIn) => ({
    enables: ce && cs && !rw && addr === 0x15 ? data & 15 : enables,
  }),
  meta: { category: 'io', icon: 'ST', description: 'NES APU status ($4015)' },
});

/** The DMC's 7-bit output level, set directly by $4011. Sample playback comes later. */
export const ApuDmc = circuit('ApuDmc', {
  inputs: { ce: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8) },
  outputs: { out: bus(7) },
  state: { level: 0 },
  eval: ({ level }) => ({ out: level }),
  onTick: ({ ce, cs, rw, addr, data, level }) => ({
    level: ce && cs && !rw && addr === 0x11 ? (data as number) & 0x7f : level,
  }),
  meta: { category: 'io', icon: 'DMC', description: 'NES APU DMC (direct level only)' },
});
