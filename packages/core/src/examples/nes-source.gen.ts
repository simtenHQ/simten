// Generated from nes/src by nes/scripts/gen-example.ts. Do not edit; run
// `pnpm --filter @simten/nes gen:example` after changing the NES.

/** The NES, from the cartridge connector to the APU, as editor source. */
export const NES_SOURCE = `
// ── nes/src/apu/frame.ts ──

/**
 * The APU's frame counter, and the APU clock.
 *
 * The APU runs from the CPU clock. Pulse timers step on every other CPU cycle
 * (an "APU cycle"); \`apu\` is high on those. The frame counter counts CPU
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
 * A $4017 write (\`MI-- ----\`) sets the mode and IRQ inhibit at once (setting
 * I clears the flag) and restarts the sequence 3 CPU cycles later if written
 * on an APU cycle, 4 if not. In 5-step mode the restart also clocks a quarter
 * and a half frame. Reading $4015 clears the flag.
 *
 * \`cs\`, \`rw\`, \`addr\` (A0-A4) and \`data\` are the CPU bus; \`cs\` is high on CPU
 * cycles that access the APU. Everything steps on CPU cycles only (\`ce\`).
 */

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

const ApuFrame = circuit('ApuFrame', {
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

// ── nes/src/apu/mixer.ts ──

/**
 * The APU's mixer. On the chip it is analog: the pulse channels share one
 * nonlinear DAC and triangle, noise and DMC another, which the NESdev wiki
 * models as
 *
 *   pulse = 95.88 / (8128 / (p1 + p2) + 100)
 *   tnd   = 159.79 / (1 / (t / 8227 + n / 12241 + d / 22638) + 100)
 *
 * The digital stand-in is the wiki's two lookup tables, a close fit to those:
 * pulse[p1 + p2] = 95.52 / (8128 / i + 100) and tnd[3t + 2n + d] =
 * 163.67 / (24329 / i + 100). Their sum, 0 to ~1, comes out as an unsigned
 * 16-bit sample.
 */

/** Full scale: the loudest possible sum, ~1.0003, stays under 65536. */
const SCALE = 65000;

/** The two tables, as 16-bit samples. */
function mixerTables(): { pulse: number[]; tnd: number[] } {
  const pulse = Array.from({ length: 32 }, (_, i) =>
    i === 0 ? 0 : Math.round((95.52 / (8128 / i + 100)) * SCALE),
  );
  const tnd = Array.from({ length: 256 }, (_, i) =>
    i === 0 ? 0 : Math.round((163.67 / (24329 / i + 100)) * SCALE),
  );
  return { pulse, tnd };
}

const tables = mixerTables();

/** How \`eval\` sees a memory: indexable, 0 where unset. */
type Table = Map<number, number> & Record<number, number>;

interface MixerIn {
  p1: number;
  p2: number;
  t: number;
  n: number;
  d: number;
  pulse: Table;
  tnd: Table;
}

const ApuMixer = circuit('ApuMixer', {
  inputs: { p1: bus(4), p2: bus(4), t: bus(4), n: bus(4), d: bus(7) },
  outputs: { audio: bus(16) },
  state: {
    pulse: mem(32, 16, romFromWords(tables.pulse, 16)),
    tnd: mem(256, 16, romFromWords(tables.tnd, 16)),
  },
  eval: ({ p1, p2, t, n, d, pulse, tnd }: MixerIn) => ({
    audio: (pulse[p1 + p2] + tnd[3 * t + 2 * n + d]) & 0xffff,
  }),
  onTick: ({ pulse, tnd }: MixerIn) => ({ pulse, tnd }),
  meta: { category: 'io', icon: 'MIX', description: 'NES APU mixer' },
});

// ── nes/src/apu/units.ts ──

/**
 * APU units shared by the channels: envelope, length counter and its table,
 * and the gate in front of the mixer. Also the status register ($4015) and
 * the DMC's output level, which is only its direct load ($4011) for now.
 * See frame.ts for the clocks and bus inputs.
 */

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
 * start flag (\`restart\`). On a quarter frame: if started, decay = 15 and the
 * divider reloads with \`period\`; otherwise the divider counts down, and at 0
 * reloads and steps decay down, from 0 back to 15 if \`loop\`. The volume is
 * \`period\` itself with \`constant\`, else decay.
 */
const ApuEnvelope = circuit('ApuEnvelope', {
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
 * Length counter (pulse, triangle, noise). Loads \`value\` (from the table) on
 * \`load\`, a write to the channel's 4th register, only while \`enabled\`.
 * Counts down on half frames unless halted. Disabling the channel clears it.
 * \`active\` is count > 0: the channel sounds, and $4015 reads it.
 */
const ApuLength = circuit('ApuLength', {
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
const ApuLengthTable = circuit('ApuLengthTable', {
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
const ApuGate = circuit('ApuGate', {
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
 * $4015. Writes (\`---D NT21\`) enable the channels; reads return the length
 * counters' activity and the frame IRQ (\`-F-- NT21\`; DMC bits are 0 for now).
 */
const ApuStatus = circuit('ApuStatus', {
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
const ApuDmc = circuit('ApuDmc', {
  inputs: { ce: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8) },
  outputs: { out: bus(7) },
  state: { level: 0 },
  eval: ({ level }) => ({ out: level }),
  onTick: ({ ce, cs, rw, addr, data, level }) => ({
    level: ce && cs && !rw && addr === 0x11 ? (data as number) & 0x7f : level,
  }),
  meta: { category: 'io', icon: 'DMC', description: 'NES APU DMC (direct level only)' },
});

// ── nes/src/apu/noise.ts ──

/**
 * The noise channel ($400C-$400F): a 15-bit linear feedback shift register,
 * an envelope and a length counter.
 *
 *   $400C  --LC VVVV  length halt / envelope loop, constant volume, volume or
 *                     envelope period
 *   $400E  M--- PPPP  mode, period index
 *   $400F  LLLL L---  length index; restarts the envelope
 *
 * The timer counts down every CPU cycle and, passing 0, reloads with the
 * period from the table and shifts the register right, feeding bit 0 XOR
 * bit 1 (bit 6 in mode 1) into bit 14. The register starts at 1. The channel
 * is silent while bit 0 is set.
 */

/** NTSC noise periods, in CPU cycles. */
const ApuNoisePeriod = circuit('ApuNoisePeriod', {
  inputs: { index: bus(4) },
  outputs: { period: bus(12) },
  eval: ({ index }) => {
    if (index === 0) return { period: 4 };
    if (index === 1) return { period: 8 };
    if (index === 2) return { period: 16 };
    if (index === 3) return { period: 32 };
    if (index === 4) return { period: 64 };
    if (index === 5) return { period: 96 };
    if (index === 6) return { period: 128 };
    if (index === 7) return { period: 160 };
    if (index === 8) return { period: 202 };
    if (index === 9) return { period: 254 };
    if (index === 10) return { period: 380 };
    if (index === 11) return { period: 508 };
    if (index === 12) return { period: 762 };
    if (index === 13) return { period: 1016 };
    if (index === 14) return { period: 2034 };
    return { period: 4068 };
  },
  meta: { category: 'io', icon: 'LUT', description: 'NES APU noise periods' },
});

interface NoiseIn {
  ce: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
  period: number;
  mode: number;
  sel: number;
  lc: number;
  cv: number;
  vol: number;
  timer: number;
  lfsr: number;
}

const ApuNoiseCore = circuit('ApuNoiseCore', {
  inputs: { ce: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8), period: bus(12) },
  outputs: {
    gate: bit,
    index: bus(4),
    loop: bit,
    constant: bit,
    env_period: bus(4),
    restart: bit,
  },
  state: { mode: 0, sel: 0, lc: 0, cv: 0, vol: 0, timer: 0, lfsr: 1 },
  eval: ({ cs, rw, addr, sel, lc, cv, vol, lfsr }: NoiseIn) => ({
    gate: lfsr & 1 ? 0 : 1,
    index: sel,
    loop: lc,
    constant: cv,
    env_period: vol,
    restart: cs && !rw && addr === 0x0f ? 1 : 0,
  }),
  onTick: ({ ce, cs, rw, addr, data, period, mode, sel, lc, cv, vol, timer, lfsr }: NoiseIn) => {
    if (!ce) return { mode, sel, lc, cv, vol, timer, lfsr };
    let nTimer = timer;
    let nLfsr = lfsr;
    if (timer === 0) {
      nTimer = period - 1;
      const feedback = (lfsr ^ (lfsr >> (mode ? 6 : 1))) & 1;
      nLfsr = (lfsr >> 1) | (feedback << 14);
    } else {
      nTimer = timer - 1;
    }
    let nMode = mode;
    let nSel = sel;
    let nLc = lc;
    let nCv = cv;
    let nVol = vol;
    if (cs && !rw && addr === 0x0c) {
      nLc = (data >> 5) & 1;
      nCv = (data >> 4) & 1;
      nVol = data & 15;
    } else if (cs && !rw && addr === 0x0e) {
      nMode = (data >> 7) & 1;
      nSel = data & 15;
    }
    return {
      mode: nMode,
      sel: nSel,
      lc: nLc,
      cv: nCv,
      vol: nVol,
      timer: nTimer & 0xfff,
      lfsr: nLfsr & 0x7fff,
    };
  },
  meta: { category: 'io', icon: 'NOI', description: 'NES APU noise' },
});

const ApuNoise = circuit('ApuNoise', {
  inputs: {
    ce: bit,
    quarter: bit,
    half: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    enabled: bit,
  },
  outputs: { out: bus(4), active: bit },
  nodes: {
    core: ApuNoiseCore,
    periods: ApuNoisePeriod,
    env: ApuEnvelope,
    len: ApuLength,
    table: ApuLengthTable,
    gate: ApuGate,
  },
  connect: ({ inputs: i, outputs: o, nodes: { core, periods, env, len, table, gate } }) => [
    i.ce.to(core.ce, env.ce, len.ce),
    i.quarter.to(env.quarter),
    i.half.to(len.half),
    i.cs.to(core.cs),
    i.rw.to(core.rw),
    i.addr.to(core.addr),
    i.data.to(core.data, table.data),
    i.enabled.to(len.enabled),
    core.index.to(periods.index),
    periods.period.to(core.period),
    core.loop.to(env.loop, len.halt),
    core.constant.to(env.constant),
    core.env_period.to(env.period),
    core.restart.to(env.restart, len.load),
    table.value.to(len.value),
    core.gate.to(gate.gate),
    len.active.to(gate.active, o.active),
    env.volume.to(gate.volume),
    gate.out.to(o.out),
  ],
});

// ── nes/src/apu/pulse.ts ──

/**
 * The two pulse channels ($4000-$4003 and $4004-$4007), each a sweep unit,
 * a duty sequencer and timer, an envelope and a length counter.
 *
 *   reg 0  DDLC VVVV  duty, length halt / envelope loop, constant volume,
 *                     volume or envelope period
 *   reg 1  EPPP NSSS  sweep enable, period, negate, shift
 *   reg 2  timer low 8 bits
 *   reg 3  LLLL Lttt  length index, timer high 3 bits; restarts the
 *                     envelope and the duty sequence
 *
 * \`me\` is 0 for pulse 1 and 1 for pulse 2. They differ in their addresses and
 * in the sweep's negate: pulse 1 subtracts the ones' complement (period −
 * change − 1), pulse 2 the two's complement (period − change).
 */

interface SweepIn {
  ce: number;
  half: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
  me: number;
  per: number;
  en: number;
  p: number;
  neg: number;
  shift: number;
  divider: number;
  reload: number;
}

/**
 * The sweep unit, which holds the channel's 11-bit timer period (\`per\`).
 * Target = period ± (period >> shift). The channel is muted while the period
 * is under 8 or, adding, the target is over $7FF, whether or not the sweep is
 * enabled. On a half frame, when the divider is 0, the sweep is enabled, the
 * shift is non-zero and the channel isn't muted, the period becomes the
 * target. The divider reloads from P when it is 0 or after a reg 1 write.
 */
const ApuSweep = circuit('ApuSweep', {
  inputs: { ce: bit, half: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8), me: bit },
  outputs: { period: bus(11), mute: bit },
  state: { per: 0, en: 0, p: 0, neg: 0, shift: 0, divider: 0, reload: 0 },
  eval: ({ me, per, neg, shift }: SweepIn) => {
    const change = per >> shift;
    const target = neg ? per - change - (me ? 0 : 1) : per + change;
    return { period: per, mute: per < 8 || (!neg && target > 0x7ff) ? 1 : 0 };
  },
  onTick: ({
    ce,
    half,
    cs,
    rw,
    addr,
    data,
    me,
    per,
    en,
    p,
    neg,
    shift,
    divider,
    reload,
  }: SweepIn) => {
    if (!ce) return { per, en, p, neg, shift, divider, reload };
    const change = per >> shift;
    const target = neg ? per - change - (me ? 0 : 1) : per + change;
    const mute = per < 8 || (!neg && target > 0x7ff);
    let nPer = per;
    let nDivider = divider;
    let nReload = reload;
    if (half) {
      if (divider === 0 && en && shift > 0 && !mute) nPer = target & 0x7ff;
      if (divider === 0 || reload) {
        nDivider = p;
        nReload = 0;
      } else {
        nDivider = divider - 1;
      }
    }
    let nEn = en;
    let nP = p;
    let nNeg = neg;
    let nShift = shift;
    if (cs && !rw && (addr & 0x1c) === (me ? 4 : 0)) {
      const reg = addr & 3;
      if (reg === 1) {
        nEn = (data >> 7) & 1;
        nP = (data >> 4) & 7;
        nNeg = (data >> 3) & 1;
        nShift = data & 7;
        nReload = 1;
      } else if (reg === 2) {
        nPer = (nPer & 0x700) | data;
      } else if (reg === 3) {
        nPer = (nPer & 0xff) | ((data & 7) << 8);
      }
    }
    return {
      per: nPer & 0x7ff,
      en: nEn,
      p: nP,
      neg: nNeg,
      shift: nShift,
      divider: nDivider & 7,
      reload: nReload,
    };
  },
  meta: { category: 'io', icon: 'SWP', description: 'NES APU pulse sweep' },
});

interface PulseIn {
  ce: number;
  apu: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
  me: number;
  period: number;
  mute: number;
  duty: number;
  lc: number;
  cv: number;
  vol: number;
  timer: number;
  step: number;
}

/**
 * The duty sequencer and timer, and reg 0. The timer counts down on APU
 * cycles and, passing 0, reloads with the period and steps the sequencer,
 * which runs 0, 7, 6, … 1. The duties, by step 0-7: 01000000, 01100000,
 * 01111000, 10011111. A reg 3 write resets the step.
 */
const ApuPulseCore = circuit('ApuPulseCore', {
  inputs: {
    ce: bit,
    apu: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    me: bit,
    period: bus(11),
    mute: bit,
  },
  outputs: { gate: bit, loop: bit, constant: bit, env_period: bus(4), restart: bit },
  state: { duty: 0, lc: 0, cv: 0, vol: 0, timer: 0, step: 0 },
  eval: ({ cs, rw, addr, me, mute, duty, lc, cv, vol, step }: PulseIn) => {
    let pattern = 0xf9;
    if (duty === 0) pattern = 0x02;
    else if (duty === 1) pattern = 0x06;
    else if (duty === 2) pattern = 0x1e;
    return {
      gate: (pattern >> step) & 1 && !mute ? 1 : 0,
      loop: lc,
      constant: cv,
      env_period: vol,
      restart: cs && !rw && addr === (me ? 7 : 3) ? 1 : 0,
    };
  },
  onTick: ({
    ce,
    apu,
    cs,
    rw,
    addr,
    data,
    me,
    period,
    duty,
    lc,
    cv,
    vol,
    timer,
    step,
  }: PulseIn) => {
    if (!ce) return { duty, lc, cv, vol, timer, step };
    let nTimer = timer;
    let nStep = step;
    if (apu) {
      if (timer === 0) {
        nTimer = period;
        nStep = (step + 7) & 7;
      } else {
        nTimer = timer - 1;
      }
    }
    let nDuty = duty;
    let nLc = lc;
    let nCv = cv;
    let nVol = vol;
    const write = cs && !rw && (addr & 0x1c) === (me ? 4 : 0);
    if (write && (addr & 3) === 0) {
      nDuty = (data >> 6) & 3;
      nLc = (data >> 5) & 1;
      nCv = (data >> 4) & 1;
      nVol = data & 15;
    }
    if (write && (addr & 3) === 3) nStep = 0;
    return { duty: nDuty, lc: nLc, cv: nCv, vol: nVol, timer: nTimer & 0x7ff, step: nStep };
  },
  meta: { category: 'io', icon: 'PLS', description: 'NES APU pulse sequencer' },
});

/** A pulse channel. \`me\` is 0 for pulse 1, 1 for pulse 2 ($4004-$4007). */
const ApuPulse = circuit('ApuPulse', {
  inputs: {
    ce: bit,
    apu: bit,
    quarter: bit,
    half: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    enabled: bit,
    me: bit,
  },
  outputs: { out: bus(4), active: bit },
  nodes: {
    sweep: ApuSweep,
    core: ApuPulseCore,
    env: ApuEnvelope,
    len: ApuLength,
    table: ApuLengthTable,
    gate: ApuGate,
  },
  connect: ({ inputs: i, outputs: o, nodes: { sweep, core, env, len, table, gate } }) => [
    i.ce.to(sweep.ce, core.ce, env.ce, len.ce),
    i.apu.to(core.apu),
    i.quarter.to(env.quarter),
    i.half.to(sweep.half, len.half),
    i.cs.to(sweep.cs, core.cs),
    i.rw.to(sweep.rw, core.rw),
    i.addr.to(sweep.addr, core.addr),
    i.data.to(sweep.data, core.data, table.data),
    i.enabled.to(len.enabled),
    i.me.to(sweep.me, core.me),
    sweep.period.to(core.period),
    sweep.mute.to(core.mute),
    core.loop.to(env.loop, len.halt),
    core.constant.to(env.constant),
    core.env_period.to(env.period),
    core.restart.to(env.restart, len.load),
    table.value.to(len.value),
    core.gate.to(gate.gate),
    len.active.to(gate.active, o.active),
    env.volume.to(gate.volume),
    gate.out.to(o.out),
  ],
});

// ── nes/src/apu/triangle.ts ──

/**
 * The triangle channel ($4008-$400B): a 32-step sequencer, a linear counter
 * and a length counter. No volume control.
 *
 *   $4008  CRRR RRRR  control (length halt, and keeps the linear reload flag),
 *                     linear counter reload value
 *   $400A  timer low 8 bits
 *   $400B  LLLL Lttt  length index, timer high 3 bits; sets the linear
 *                     reload flag
 *
 * The timer counts down every CPU cycle and, passing 0, reloads with the
 * period and steps the sequence 15, 14, … 0, 0, 1, … 15, while both the
 * linear and length counters are non-zero. On a quarter frame the linear
 * counter reloads if the flag is set, else counts down; the flag then clears
 * unless control is set. Silencing it freezes the sequence where it is,
 * output and all, as the real chip does. Very short periods are not muted.
 */

interface TriangleIn {
  ce: number;
  quarter: number;
  cs: number;
  rw: number;
  addr: number;
  data: number;
  active: number;
  control: number;
  reloadValue: number;
  period: number;
  timer: number;
  step: number;
  linear: number;
  reload: number;
}

const ApuTriangleCore = circuit('ApuTriangleCore', {
  inputs: {
    ce: bit,
    quarter: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    active: bit,
  },
  outputs: { out: bus(4), halt: bit, load: bit },
  state: { control: 0, reloadValue: 0, period: 0, timer: 0, step: 0, linear: 0, reload: 0 },
  eval: ({ cs, rw, addr, control, step }: TriangleIn) => ({
    out: step < 16 ? 15 - step : step - 16,
    halt: control,
    load: cs && !rw && addr === 0x0b ? 1 : 0,
  }),
  onTick: ({
    ce,
    quarter,
    cs,
    rw,
    addr,
    data,
    active,
    control,
    reloadValue,
    period,
    timer,
    step,
    linear,
    reload,
  }: TriangleIn) => {
    if (!ce) return { control, reloadValue, period, timer, step, linear, reload };
    let nTimer = timer;
    let nStep = step;
    if (timer === 0) {
      nTimer = period;
      if (active && linear > 0) nStep = (step + 1) & 31;
    } else {
      nTimer = timer - 1;
    }
    let nLinear = linear;
    let nReload = reload;
    if (quarter) {
      if (reload) nLinear = reloadValue;
      else if (linear > 0) nLinear = linear - 1;
      if (!control) nReload = 0;
    }
    let nControl = control;
    let nReloadValue = reloadValue;
    let nPeriod = period;
    if (cs && !rw && addr === 0x08) {
      nControl = (data >> 7) & 1;
      nReloadValue = data & 0x7f;
    } else if (cs && !rw && addr === 0x0a) {
      nPeriod = (period & 0x700) | data;
    } else if (cs && !rw && addr === 0x0b) {
      nPeriod = (period & 0xff) | ((data & 7) << 8);
      nReload = 1;
    }
    return {
      control: nControl,
      reloadValue: nReloadValue,
      period: nPeriod & 0x7ff,
      timer: nTimer & 0x7ff,
      step: nStep,
      linear: nLinear & 0x7f,
      reload: nReload,
    };
  },
  meta: { category: 'io', icon: 'TRI', description: 'NES APU triangle' },
});

const ApuTriangle = circuit('ApuTriangle', {
  inputs: {
    ce: bit,
    quarter: bit,
    half: bit,
    cs: bit,
    rw: bit,
    addr: bus(5),
    data: bus(8),
    enabled: bit,
  },
  outputs: { out: bus(4), active: bit },
  nodes: { core: ApuTriangleCore, len: ApuLength, table: ApuLengthTable },
  connect: ({ inputs: i, outputs: o, nodes: { core, len, table } }) => [
    i.ce.to(core.ce, len.ce),
    i.quarter.to(core.quarter),
    i.half.to(len.half),
    i.cs.to(core.cs),
    i.rw.to(core.rw),
    i.addr.to(core.addr),
    i.data.to(core.data, table.data),
    i.enabled.to(len.enabled),
    core.halt.to(len.halt),
    core.load.to(len.load),
    table.value.to(len.value),
    len.active.to(core.active, o.active),
    core.out.to(o.out),
  ],
});

// ── nes/src/apu/apu.ts ──

/**
 * The 2A03's APU: two pulse channels, triangle, noise, the DMC's output level,
 * the frame counter, $4015 and the mixer. Written from the NESdev wiki's
 * description of the hardware (#612).
 *
 * The CPU bus comes in as \`cs\` (high on CPU cycles that access the APU:
 * $4000-$4013, $4015, and $4017 writes), \`rw\`, \`addr\` (A0-A4) and \`data\`.
 * Reads return $4015 on \`data_out\`. \`irq\` is the frame IRQ. \`audio\` is the
 * mixed output as an unsigned 16-bit sample, one per CPU cycle. \`p1\`, \`p2\`,
 * \`t\` and \`n\` are the channels' 4-bit outputs before mixing.
 *
 * DMC sample playback (and its IRQ and DMA) is not built yet: $4011 sets its
 * output level and that is all.
 */

const Apu = circuit('Apu', {
  inputs: { ce: bit, cs: bit, rw: bit, addr: bus(5), data: bus(8) },
  outputs: {
    data_out: bus(8),
    irq: bit,
    audio: bus(16),
    p1: bus(4),
    p2: bus(4),
    t: bus(4),
    n: bus(4),
  },
  nodes: {
    frame: ApuFrame,
    status: ApuStatus,
    pulse1: ApuPulse,
    pulse2: ApuPulse,
    first: Constant({ value: 0 }),
    second: Constant({ value: 1 }),
    triangle: ApuTriangle,
    noise: ApuNoise,
    dmc: ApuDmc,
    mixer: ApuMixer,
  },
  connect: ({ inputs: i, outputs: o, nodes: n }) => {
    const { frame, status, pulse1, pulse2, triangle, noise, dmc, mixer } = n;
    return [
      n.first.out.to(pulse1.me),
      n.second.out.to(pulse2.me),
      i.ce.to(frame.ce, status.ce, pulse1.ce, pulse2.ce, triangle.ce, noise.ce, dmc.ce),
      i.cs.to(frame.cs, status.cs, pulse1.cs, pulse2.cs, triangle.cs, noise.cs, dmc.cs),
      i.rw.to(frame.rw, status.rw, pulse1.rw, pulse2.rw, triangle.rw, noise.rw, dmc.rw),
      i.addr.to(frame.addr, status.addr, pulse1.addr, pulse2.addr, triangle.addr, noise.addr),
      i.addr.to(dmc.addr),
      i.data.to(frame.data, status.data, pulse1.data, pulse2.data, triangle.data, noise.data),
      i.data.to(dmc.data),
      frame.apu.to(pulse1.apu, pulse2.apu),
      frame.quarter.to(pulse1.quarter, pulse2.quarter, triangle.quarter, noise.quarter),
      frame.half.to(pulse1.half, pulse2.half, triangle.half, noise.half),
      frame.irq.to(status.irq, o.irq),
      status.en_p1.to(pulse1.enabled),
      status.en_p2.to(pulse2.enabled),
      status.en_t.to(triangle.enabled),
      status.en_n.to(noise.enabled),
      pulse1.active.to(status.p1),
      pulse2.active.to(status.p2),
      triangle.active.to(status.t),
      noise.active.to(status.n),
      status.data_out.to(o.data_out),
      pulse1.out.to(mixer.p1, o.p1),
      pulse2.out.to(mixer.p2, o.p2),
      triangle.out.to(mixer.t, o.t),
      noise.out.to(mixer.n, o.n),
      dmc.out.to(mixer.d),
      mixer.audio.to(o.audio),
    ];
  },
});

// ── nes/src/cart.ts ──

/**
 * The cartridge connector, and the NROM (mapper 0) cartridge.
 *
 * The NES splits at a 72-pin edge connector: the console brings out the CPU
 * and PPU buses, and the cartridge decides what answers on them. That is
 * where mappers live, and also the nametable mirroring: the cart wires the
 * console's 2 KB of nametable RAM (CIRAM) through its A10 and chip-enable
 * pins. The ports here are those pins, with two simplifications:
 *
 * - \`romsel\` is CPU A15, active high. The real /ROMSEL is active low and
 *   gated by M2; \`m2\` is passed separately as the CPU cycle strobe (the
 *   board's \`ce\`), and a cart writes on \`m2 && !cpu_rw\`.
 * - The data buses are split into read and write halves, and a cart drives
 *   \`cpu_rdata\` with 0 where real hardware would leave the bus open.
 *
 * Console to cart: \`cpu_addr\` (A0-A14), \`romsel\`, \`m2\`, \`cpu_rw\`,
 * \`cpu_wdata\`, \`ppu_addr\` (A0-A13), \`ppu_we\`, \`ppu_wdata\`.
 * Cart to console: \`cpu_rdata\`, \`irq\`, \`ppu_rdata\`, \`ciram_a10\`, \`ciram_ce\`.
 */

/** ROM contents, as \`romFromBytes\` makes them. */
type Contents = ReturnType<typeof romFromBytes>;

/** The connector's ports, from the cartridge's side. */
const CART_INPUTS = {
  cpu_addr: bus(15),
  romsel: bit,
  m2: bit,
  cpu_rw: bit,
  cpu_wdata: bus(8),
  ppu_addr: bus(14),
  ppu_we: bit,
  ppu_wdata: bus(8),
};
const CART_OUTPUTS = {
  cpu_rdata: bus(8),
  irq: bit,
  ppu_rdata: bus(8),
  ciram_a10: bit,
  ciram_ce: bit,
};

/** NROM's address decode. */
const NromDecode = circuit(
  'NromDecode',
  (_opts: { prgSize?: number; vertical?: number; wram?: number } = {}) => ({
    inputs: {
      cpu_addr: bus(15),
      romsel: bit,
      m2: bit,
      cpu_rw: bit,
      ppu_addr: bus(14),
      prg_data: bus(8),
      chr_data: bus(8),
      wram_data: bus(8),
    },
    outputs: {
      prg_addr: bus(16),
      chr_addr: bus(16),
      wram_addr: bus(13),
      wram_we: bit,
      cpu_rdata: bus(8),
      ppu_rdata: bus(8),
      ciram_a10: bit,
      ciram_ce: bit,
    },
    eval: ({
      cpu_addr,
      romsel,
      m2,
      cpu_rw,
      ppu_addr,
      prg_data,
      chr_data,
      wram_data,
      prgSize = 0x8000,
      vertical = 0,
      wram = 0,
    }) => {
      // $6000-$7FFF: A15 low, A14 and A13 high.
      const ram = wram && !romsel && (cpu_addr & 0x6000) === 0x6000;
      let read = 0;
      if (romsel) read = prg_data;
      else if (ram) read = wram_data;
      return {
        prg_addr: cpu_addr & ((prgSize as number) - 1),
        chr_addr: ppu_addr & 0x1fff,
        wram_addr: cpu_addr & 0x1fff,
        wram_we: ram && m2 && !cpu_rw ? 1 : 0,
        cpu_rdata: read,
        ppu_rdata: chr_data,
        // The mirroring pad: vertical mirroring wires CIRAM A10 to PPU A10,
        // horizontal to PPU A11.
        ciram_a10: vertical ? (ppu_addr >> 10) & 1 : (ppu_addr >> 11) & 1,
        // CIRAM answers at $2000-$3FFF (PPU A13), CHR ROM below.
        ciram_ce: (ppu_addr >> 13) & 1,
      };
    },
  }),
);

/**
 * NROM: 16 or 32 KB of PRG ROM (\`prgSize\`; 16 KB mirrors at $C000), 8 KB of
 * CHR ROM, and fixed mirroring (\`vertical\` 1 for vertical). \`wram\` 1 adds
 * 8 KB of PRG RAM at $6000-$7FFF, which plain NROM boards lack but test
 * cartridges and some homebrew use. The ROMs are nodes \`prg\` and \`chr\`:
 * load them through \`simulate\`'s \`memory\`, or bake contents in with \`prg\`
 * and \`chr\`.
 */
const NromCart = circuit(
  'NromCart',
  ({
    prgSize = 0x8000,
    vertical = 0,
    wram = 0,
    prg,
    chr,
  }: {
    prgSize?: number;
    vertical?: number;
    wram?: number;
    prg?: Contents;
    chr?: Contents;
  } = {}) => {
    // The RAM exists only with \`wram\`; it stays in the node type so the
    // connect below can name it.
    const ram = DualPortRAM({ addressWidth: 13, dataWidth: 8 });
    const nodes = {
      decode: NromDecode({ prgSize, vertical, wram }),
      prg: ROM(prg ? { memory: prg } : {}),
      chr: ROM(chr ? { memory: chr } : {}),
      low: Constant({ value: 0 }),
      ...(wram ? { ram } : {}),
    } as {
      decode: ReturnType<typeof NromDecode>;
      prg: ReturnType<typeof ROM>;
      chr: ReturnType<typeof ROM>;
      low: ReturnType<typeof Constant>;
      ram: typeof ram;
    };
    return {
      inputs: CART_INPUTS,
      outputs: CART_OUTPUTS,
      nodes,
      connect: ({ inputs: i, outputs: o, nodes: n }) => {
        const rows = [
          i.cpu_addr.to(n.decode.cpu_addr),
          i.romsel.to(n.decode.romsel),
          i.m2.to(n.decode.m2),
          i.cpu_rw.to(n.decode.cpu_rw),
          i.ppu_addr.to(n.decode.ppu_addr),
          n.decode.prg_addr.to(n.prg.addr),
          n.prg.data_out.to(n.decode.prg_data),
          n.decode.chr_addr.to(n.chr.addr),
          n.chr.data_out.to(n.decode.chr_data),
          n.decode.cpu_rdata.to(o.cpu_rdata),
          n.decode.ppu_rdata.to(o.ppu_rdata),
          n.decode.ciram_a10.to(o.ciram_a10),
          n.decode.ciram_ce.to(o.ciram_ce),
          n.low.out.to(o.irq),
        ];
        if (wram) {
          rows.push(
            i.cpu_wdata.to(n.ram.dataA),
            n.decode.wram_addr.to(n.ram.addrA),
            n.decode.wram_we.to(n.ram.weA),
            n.ram.outA.to(n.decode.wram_data),
          );
        }
        return rows;
      },
    };
  },
);

// ── nes/src/dma.ts ──

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
 * It steps on CPU cycles only (\`ce\`). Get and put cycles alternate from
 * power-on: even CPU cycles are gets. The real chip takes the phase from its
 * APU clock divider, which this doesn't model.
 */

// \`phase\`: 0 idle, 1 waiting for the CPU to halt, 2 copying. Numbers, not
// named constants, so the Verilog export can translate onTick.

interface DmaState {
  phase: number;
  /** High byte of the source page. */
  page: number;
  /** Bytes copied so far. */
  n: number;
  /** 1 between a get and its put: \`latch\` holds the byte. */
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

const OamDma = circuit('OamDma', {
  inputs: { ce: bit, cpu_addr: bus(16), cpu_rw: bit, cpu_out: bus(8), read: bus(8) },
  outputs: { rdy: bit, addr: bus(16), rw: bit, out: bus(8) },
  state: { phase: 0, page: 0, n: 0, held: 0, latch: 0, odd: 0 },
  eval: ({ cpu_addr, cpu_rw, cpu_out, phase, page, n, held, latch, odd }: DmaIn) => {
    const rdy = phase === 0 ? 1 : 0; // idle
    if (phase === 2 && held) return { rdy, addr: 0x2004, rw: 0, out: latch };
    if (phase === 2 && !odd) return { rdy, addr: (page << 8) | n, rw: 1, out: cpu_out };
    return { rdy, addr: cpu_addr, rw: cpu_rw, out: cpu_out };
  },
  onTick: ({ ce, cpu_addr, cpu_rw, cpu_out, read, phase, page, n, held, latch, odd }: DmaIn) => {
    // Off CPU cycles nothing changes; on them parity flips and the phase steps.
    const flip = (ce ? odd ^ 1 : odd) & 1;
    let nPhase = phase;
    let nPage = page;
    let nN = n;
    let nHeld = held;
    let nLatch = latch;
    if (!ce) {
      return { phase, page, n, held, latch, odd };
    }
    if (phase === 0) {
      if (!cpu_rw && cpu_addr === 0x4014) {
        nPhase = 1;
        nPage = cpu_out;
      }
    } else if (phase === 1) {
      // RDY was low: on a read cycle the CPU halted, on a write it carried on.
      if (cpu_rw) {
        nPhase = 2;
        nN = 0;
        nHeld = 0;
      }
    } else if (held) {
      const done = n === 255;
      nPhase = done ? 0 : 2;
      nN = done ? 0 : (n + 1) & 0xff;
      nHeld = 0;
    } else if (!odd) {
      nHeld = 1;
      nLatch = read;
    }
    return { phase: nPhase, page: nPage, n: nN, held: nHeld, latch: nLatch, odd: flip };
  },
  meta: { category: 'io', icon: 'DMA', description: 'NES OAM DMA ($4014)' },
});

// ── nes/src/pads.ts ──

/**
 * The two controller ports and standard pads.
 *
 * A pad is an 8-bit parallel-in, serial-out shift register (a 4021) holding
 * the buttons, bit 0 first:
 *
 *   0 A   1 B   2 Select   3 Start   4 Up   5 Down   6 Left   7 Right
 *
 * Bit 0 of a $4016 write is the 2A03's OUT0 pin, the strobe to both pads.
 * While it is high the shift registers keep loading the buttons, so reads
 * return A. Once it goes low they hold, and each read of $4016 (pad 1) or
 * $4017 (pad 2) returns the next button in bit 0 and shifts. After 8 reads an
 * official pad returns 1. A button reads 1 when pressed.
 *
 * Bits 7-5 of the read are open bus, which is $40 here: the high byte of the
 * address, the last thing on the bus. Bits 4-1 read 0.
 *
 * \`cs\` is high for one tick per CPU access to $4016 or $4017, so each read
 * shifts once.
 */

/** Bits of \`pad1\` and \`pad2\`, one per button. */
const BUTTON = {
  A: 0x01,
  B: 0x02,
  SELECT: 0x04,
  START: 0x08,
  UP: 0x10,
  DOWN: 0x20,
  LEFT: 0x40,
  RIGHT: 0x80,
} as const;

const NesPadsLogic = circuit('NesPadsLogic', {
  inputs: {
    cs: bit,
    rw: bit,
    port: bit,
    data_in: bus(8),
    pad1: bus(8),
    pad2: bus(8),
    strobe: bit,
    shift1: bus(8),
    shift2: bus(8),
  },
  outputs: { data_out: bus(8), next_strobe: bit, next_shift1: bus(8), next_shift2: bus(8) },
  meta: { category: 'nes', icon: 'J', description: 'NES controller ports: $4016, $4017' },
  eval: ({ cs, rw, port, data_in, pad1, pad2, strobe, shift1, shift2 }) => {
    const s1 = shift1 as number;
    const s2 = shift2 as number;
    const read1 = cs === 1 && rw === 1 && port === 0;
    const read2 = cs === 1 && rw === 1 && port === 1;
    const bit1 = strobe === 1 ? (pad1 as number) & 1 : s1 & 1;
    const bit2 = strobe === 1 ? (pad2 as number) & 1 : s2 & 1;

    // Strobe high: load. Otherwise a read shifts, filling with 1s.
    let next1 = s1;
    if (strobe === 1) next1 = pad1 as number;
    else if (read1) next1 = (s1 >> 1) | 0x80;
    let next2 = s2;
    if (strobe === 1) next2 = pad2 as number;
    else if (read2) next2 = (s2 >> 1) | 0x80;

    const write = cs === 1 && rw === 0 && port === 0;
    return {
      data_out: 0x40 | (port === 1 ? bit2 : bit1),
      next_strobe: write ? (data_in as number) & 1 : (strobe as number),
      next_shift1: next1,
      next_shift2: next2,
    };
  },
});

const NesPads = circuit('NesPads', {
  inputs: { cs: bit, rw: bit, port: bit, data_in: bus(8), pad1: bus(8), pad2: bus(8) },
  outputs: { data_out: bus(8) },
  nodes: {
    strobe: Register({ width: 1 }),
    shift1: Register({ width: 8 }),
    shift2: Register({ width: 8 }),
    logic: NesPadsLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.strobe.we, n.shift1.we, n.shift2.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.port.to(n.logic.port),
    inputs.data_in.to(n.logic.data_in),
    inputs.pad1.to(n.logic.pad1),
    inputs.pad2.to(n.logic.pad2),
    n.strobe.q.to(n.logic.strobe),
    n.shift1.q.to(n.logic.shift1),
    n.shift2.q.to(n.logic.shift2),
    n.logic.next_strobe.to(n.strobe.data),
    n.logic.next_shift1.to(n.shift1.data),
    n.logic.next_shift2.to(n.shift2.data),
    n.logic.data_out.to(outputs.data_out),
  ],
});

// ── nes/src/ppu/background.ts ──

/**
 * The background: fetch tiles, shift them out a pixel per dot.
 *
 * Fetch. While rendering, on lines 0-239 and the pre-render line, dots 1-256
 * fetch the tiles for this line and dots 321-336 the first two of the next.
 * Each tile takes 8 dots, two per read, and the byte is latched on the
 * second dot:
 *
 *   dots 1-2  nametable byte    $2000 | (v & $0FFF)
 *   dots 3-4  attribute byte    $23C0 | NT | coarse Y / 4 | coarse X / 4,
 *                               kept as the 2 palette bits for this tile
 *   dots 5-6  pattern, plane 0  PPUCTRL bit 4 table | tile × 16 | fine Y
 *   dots 7-8  pattern, plane 1  the same + 8
 *
 * Outside those dots the PPU's bus belongs to the $2007 port.
 *
 * Shift. Two 16-bit pattern shift registers and two 8-bit attribute shift
 * registers, each attribute register fed by a 1-bit latch. They shift on
 * dots 2-257 and 322-337; on dots 9, 17, ... 257, 329 and 337 the low bytes
 * load the latched pattern bytes and the attribute latches the tile's
 * palette bits. Fine x picks the bit: pattern bit 15 - x, attribute bit 7 - x.
 *
 * The pixel for dot d (1-256) is screen x = d - 1: a 4-bit palette index,
 * palette × 4 + pattern bits, or 0 (the backdrop) when the pattern bits are 0,
 * the background is off (PPUMASK bit 3), or x < 8 with PPUMASK bit 1 clear.
 */

const PpuBgFetch = circuit('PpuBgFetch', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    data_addr: bus(14),
    vram_rdata: bus(8),
    nt: bus(8),
    at: bus(2),
    lo: bus(8),
    hi: bus(8),
  },
  outputs: {
    vram_addr: bus(14),
    next_nt: bus(8),
    next_at: bus(2),
    next_lo: bus(8),
    next_hi: bus(8),
  },
  meta: {
    category: 'nes',
    icon: 'F',
    description: 'PPU background fetch: tile, attribute, pattern',
  },
  eval: ({ dot, line, mask, ctrl, v, data_addr, vram_rdata, nt, at, lo, hi }) => {
    const dt = dot as number;
    const va = v as number;
    const d = vram_rdata as number;
    const rendering = ((mask as number) & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const fetching = rendering && ((dt >= 1 && dt <= 256) || (dt >= 321 && dt <= 336));
    const phase = (dt - 1) & 7;
    const pattern = (((ctrl as number) & 0x10) << 8) | ((nt as number) << 4) | ((va >> 12) & 7);

    let addr = data_addr as number;
    if (fetching && phase < 2) addr = 0x2000 | (va & 0x0fff);
    else if (fetching && phase < 4)
      addr = 0x23c0 | (va & 0x0c00) | ((va >> 4) & 0x38) | ((va >> 2) & 7);
    else if (fetching && phase < 6) addr = pattern;
    else if (fetching) addr = pattern | 8;

    // The quadrant of the 32x32 area: coarse Y bit 1 picks the top or bottom
    // half of the attribute byte, coarse X bit 1 the left or right pair.
    const quadrant = ((va >> 4) & 4) | (va & 2);
    return {
      vram_addr: addr,
      next_nt: fetching && phase === 1 ? d : (nt as number),
      next_at: fetching && phase === 3 ? (d >> quadrant) & 3 : (at as number),
      next_lo: fetching && phase === 5 ? d : (lo as number),
      next_hi: fetching && phase === 7 ? d : (hi as number),
    };
  },
});

const PpuBgShift = circuit('PpuBgShift', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    x: bus(3),
    at: bus(2),
    lo: bus(8),
    hi: bus(8),
    p0: bus(16),
    p1: bus(16),
    a0: bus(8),
    a1: bus(8),
    l0: bus(1),
    l1: bus(1),
  },
  outputs: {
    pixel: bus(5),
    next_p0: bus(16),
    next_p1: bus(16),
    next_a0: bus(8),
    next_a1: bus(8),
    next_l0: bus(1),
    next_l1: bus(1),
  },
  meta: { category: 'nes', icon: '»', description: 'PPU background shifters and fine x select' },
  eval: ({ dot, line, mask, x, at, lo, hi, p0, p1, a0, a1, l0, l1 }) => {
    const dt = dot as number;
    const m = mask as number;
    const rendering = (m & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const shifting = rendering && ((dt >= 2 && dt <= 257) || (dt >= 322 && dt <= 337));
    const reload = shifting && ((dt - 1) & 7) === 0;

    let s0 = p0 as number;
    let s1 = p1 as number;
    let t0 = a0 as number;
    let t1 = a1 as number;
    if (shifting) {
      s0 = (s0 << 1) & 0xffff;
      s1 = (s1 << 1) & 0xffff;
      t0 = ((t0 << 1) | (l0 as number)) & 0xff;
      t1 = ((t1 << 1) | (l1 as number)) & 0xff;
    }

    const fx = x as number;
    const bits = ((s0 >> (15 - fx)) & 1) | (((s1 >> (15 - fx)) & 1) << 1);
    const palette = ((t0 >> (7 - fx)) & 1) | (((t1 >> (7 - fx)) & 1) << 1);
    const shown = (m & 0x08) !== 0 && ((m & 0x02) !== 0 || dt > 8);
    return {
      pixel: shown && bits !== 0 ? (palette << 2) | bits : 0,
      next_p0: reload ? (s0 & 0xff00) | (lo as number) : s0,
      next_p1: reload ? (s1 & 0xff00) | (hi as number) : s1,
      next_a0: t0,
      next_a1: t1,
      next_l0: reload ? (at as number) & 1 : (l0 as number),
      next_l1: reload ? ((at as number) >> 1) & 1 : (l1 as number),
    };
  },
});

const PpuBackground = circuit('PpuBackground', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    x: bus(3),
    data_addr: bus(14),
    vram_rdata: bus(8),
  },
  outputs: { vram_addr: bus(14), pixel: bus(5) },
  nodes: {
    fetch: PpuBgFetch,
    nt: Register({ width: 8 }),
    at: Register({ width: 2 }),
    lo: Register({ width: 8 }),
    hi: Register({ width: 8 }),
    shift: PpuBgShift,
    p0: Register({ width: 16 }),
    p1: Register({ width: 16 }),
    a0: Register({ width: 8 }),
    a1: Register({ width: 8 }),
    l0: Register({ width: 1 }),
    l1: Register({ width: 1 }),
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(
      n.nt.we,
      n.at.we,
      n.lo.we,
      n.hi.we,
      n.p0.we,
      n.p1.we,
      n.a0.we,
      n.a1.we,
      n.l0.we,
      n.l1.we,
    ),
    inputs.dot.to(n.fetch.dot, n.shift.dot),
    inputs.line.to(n.fetch.line, n.shift.line),
    inputs.mask.to(n.fetch.mask, n.shift.mask),
    inputs.ctrl.to(n.fetch.ctrl),
    inputs.v.to(n.fetch.v),
    inputs.x.to(n.shift.x),
    inputs.data_addr.to(n.fetch.data_addr),
    inputs.vram_rdata.to(n.fetch.vram_rdata),
    n.nt.q.to(n.fetch.nt),
    n.at.q.to(n.fetch.at, n.shift.at),
    n.lo.q.to(n.fetch.lo, n.shift.lo),
    n.hi.q.to(n.fetch.hi, n.shift.hi),
    n.fetch.next_nt.to(n.nt.data),
    n.fetch.next_at.to(n.at.data),
    n.fetch.next_lo.to(n.lo.data),
    n.fetch.next_hi.to(n.hi.data),
    n.fetch.vram_addr.to(outputs.vram_addr),
    n.p0.q.to(n.shift.p0),
    n.p1.q.to(n.shift.p1),
    n.a0.q.to(n.shift.a0),
    n.a1.q.to(n.shift.a1),
    n.l0.q.to(n.shift.l0),
    n.l1.q.to(n.shift.l1),
    n.shift.next_p0.to(n.p0.data),
    n.shift.next_p1.to(n.p1.data),
    n.shift.next_a0.to(n.a0.data),
    n.shift.next_a1.to(n.a1.data),
    n.shift.next_l0.to(n.l0.data),
    n.shift.next_l1.to(n.l1.data),
    n.shift.pixel.to(outputs.pixel),
  ],
});

// ── nes/src/ppu/data.ts ──

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

const PpuData = circuit('PpuData', {
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

// ── nes/src/ppu/regs.ts ──

/**
 * PPU registers as the CPU sees them, $2000-$2007 (mirrored to $3FFF):
 *
 *   $2000  PPUCTRL    write. Bit 7: raise NMI at vblank.
 *   $2001  PPUMASK    write. Bits 3-4 turn rendering on.
 *   $2002  PPUSTATUS  read. Bit 7 vblank; reading clears it.
 *   $2002  bits 6-5   sprite 0 hit and sprite overflow (sprites.ts, oam.ts)
 *   $2003  OAMADDR    write, and
 *   $2004  OAMDATA    read and write OAM (oam.ts); reads come in on \`data4\`
 *   $2005, $2006      scroll and address (scroll.ts)
 *   $2007  PPUDATA    read or write PPU memory at v (data.ts); reads come in
 *                     on \`data7\`
 *
 * \`cs\` is high for one tick per CPU access, so each access counts once.
 *
 * Reads of write-only registers return the PPU's I/O latch: the last value
 * written to or read from any register (decay is not modelled). PPUSTATUS
 * fills its low 5 bits from it.
 *
 * \`nmi\` is vblank AND PPUCTRL bit 7, so setting bit 7 during vblank raises it
 * at once. A $2002 read on the tick the flag would go up (241, 0) reads 0 and
 * the flag stays down for that frame, so no NMI.
 */

const PpuRegsLogic = circuit('PpuRegsLogic', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    data4: bus(8),
    data7: bus(8),
    hit: bit,
    overflow: bit,
    ctrl: bus(8),
    mask: bus(8),
    vbl: bit,
    latch: bus(8),
    vbl_set: bit,
    flags_clear: bit,
  },
  outputs: {
    data_out: bus(8),
    nmi: bit,
    next_ctrl: bus(8),
    next_mask: bus(8),
    next_vbl: bit,
    next_latch: bus(8),
  },
  meta: { category: 'nes', icon: 'R', description: 'PPU register logic: CPU reads and writes' },
  eval: ({
    cs,
    rw,
    addr,
    data_in,
    data4,
    data7,
    hit,
    overflow,
    ctrl,
    mask,
    vbl,
    latch,
    vbl_set,
    flags_clear,
  }) => {
    const reg = addr as number;
    const write = cs === 1 && rw === 0;
    const readStatus = cs === 1 && rw === 1 && reg === 2;
    const readData = cs === 1 && rw === 1 && (reg === 4 || reg === 7);
    const flags = ((vbl as number) << 7) | ((hit as number) << 6) | ((overflow as number) << 5);
    let out = latch as number;
    if (reg === 2) out = flags | ((latch as number) & 0x1f);
    else if (reg === 4) out = data4 as number;
    else if (reg === 7) out = data7 as number;

    let nextVbl = vbl as number;
    if (flags_clear || readStatus) nextVbl = 0;
    else if (vbl_set) nextVbl = 1;

    let nextLatch = latch as number;
    if (write) nextLatch = data_in as number;
    else if (readStatus || readData) nextLatch = out;

    return {
      data_out: out,
      nmi: vbl === 1 && ((ctrl as number) & 0x80) !== 0 ? 1 : 0,
      next_ctrl: write && reg === 0 ? (data_in as number) : (ctrl as number),
      next_mask: write && reg === 1 ? (data_in as number) : (mask as number),
      next_vbl: nextVbl,
      next_latch: nextLatch,
    };
  },
});

const PpuRegs = circuit('PpuRegs', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    data4: bus(8),
    data7: bus(8),
    hit: bit,
    overflow: bit,
    vbl_set: bit,
    flags_clear: bit,
  },
  outputs: { data_out: bus(8), nmi: bit, ctrl: bus(8), mask: bus(8) },
  nodes: {
    ctrl: Register({ width: 8 }),
    mask: Register({ width: 8 }),
    vbl: Register({ width: 1 }),
    latch: Register({ width: 8 }),
    logic: PpuRegsLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.ctrl.we, n.mask.we, n.vbl.we, n.latch.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.addr.to(n.logic.addr),
    inputs.data_in.to(n.logic.data_in),
    inputs.data4.to(n.logic.data4),
    inputs.data7.to(n.logic.data7),
    inputs.hit.to(n.logic.hit),
    inputs.overflow.to(n.logic.overflow),
    inputs.vbl_set.to(n.logic.vbl_set),
    inputs.flags_clear.to(n.logic.flags_clear),
    n.ctrl.q.to(n.logic.ctrl, outputs.ctrl),
    n.mask.q.to(n.logic.mask, outputs.mask),
    n.vbl.q.to(n.logic.vbl),
    n.latch.q.to(n.logic.latch),
    n.logic.next_ctrl.to(n.ctrl.data),
    n.logic.next_mask.to(n.mask.data),
    n.logic.next_vbl.to(n.vbl.data),
    n.logic.next_latch.to(n.latch.data),
    n.logic.data_out.to(outputs.data_out),
    n.logic.nmi.to(outputs.nmi),
  ],
});

// ── nes/src/ppu/scroll.ts ──

/**
 * The PPU's internal scroll and address registers, as the NESdev wiki names
 * them:
 *
 *   v  15 bits  current VRAM address (during rendering: the scroll position)
 *   t  15 bits  temporary address, the top-left of the screen
 *   x   3 bits  fine X scroll
 *   w   1 bit   first or second write toggle, shared by $2005 and $2006
 *
 * Bits of v and t: yyy NN YYYYY XXXXX (fine Y, nametable, coarse Y, coarse X).
 *
 *   $2000 write   t: NN = d & 3
 *   $2002 read    w = 0
 *   $2005 write   w=0: t coarse X = d >> 3, x = d & 7
 *                 w=1: t fine Y = d & 7, coarse Y = d >> 3
 *   $2006 write   w=0: t bits 13-8 = d & $3F, bit 14 = 0
 *                 w=1: t bits 7-0 = d, then v = t
 *   $2007 access  v += 1, or 32 with PPUCTRL bit 2
 *
 * While rendering (PPUMASK bit 3 or 4) on lines 0-239 and the pre-render
 * line 261, v also walks the screen with the background fetches:
 *
 *   dots 8, 16, ... 256, 328, 336  coarse X + 1, into the next nametable at 31
 *   dot 256                        Y + 1: fine Y, then coarse Y, into the next
 *                                  nametable after row 29 (row 31 wraps to 0)
 *   dot 257                        v's horizontal bits (coarse X, NT bit 10) = t's
 *   line 261, dots 280-304         v's vertical bits (fine Y, coarse Y, NT bit 11) = t's
 *
 * A CPU access in the same dot is applied after these.
 */

/** Rendering's walk across the screen: v after this dot's fetch-side updates. */
const PpuScrollRender = circuit('PpuScrollRender', {
  inputs: { mask: bus(8), dot: bus(9), line: bus(9), v: bus(15), t: bus(15) },
  outputs: { v_out: bus(15) },
  meta: { category: 'nes', icon: 'S', description: 'PPU scroll: rendering increments and copies' },
  eval: ({ mask, dot, line, v, t }) => {
    const dt = dot as number;
    const tt = t as number;
    let nv = v as number;
    const rendering = ((mask as number) & 0x18) !== 0 && ((line as number) < 240 || line === 261);
    const fetching = (dt >= 1 && dt <= 256) || (dt >= 321 && dt <= 336);
    if (rendering && fetching && (dt & 7) === 0) {
      nv = (nv & 0x1f) === 31 ? (nv & 0x7fe0) ^ 0x0400 : nv + 1;
    }
    if (rendering && dt === 256) {
      // Fine Y first; when it wraps, coarse Y. Row 29 is the last row of
      // tiles, so it moves to the next nametable down; rows 30-31 are the
      // attribute table and wrap to 0 without moving.
      const row = (nv >> 5) & 31;
      const nextRow = row === 29 || row === 31 ? 0 : row + 1;
      const flip = row === 29 ? 0x0800 : 0;
      if ((nv & 0x7000) !== 0x7000) nv = nv + 0x1000;
      else nv = ((nv & 0x0c1f) | (nextRow << 5)) ^ flip;
    }
    if (rendering && dt === 257) nv = (nv & 0x7be0) | (tt & 0x041f);
    if (rendering && line === 261 && dt >= 280 && dt <= 304) nv = (nv & 0x041f) | (tt & 0x7be0);
    return { v_out: nv };
  },
});

/** CPU register accesses, applied after rendering's updates. */
const PpuScrollCpu = circuit('PpuScrollCpu', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    ctrl: bus(8),
    v: bus(15),
    t: bus(15),
    x: bus(3),
    w: bit,
  },
  outputs: { next_v: bus(15), next_t: bus(15), next_x: bus(3), next_w: bit },
  meta: { category: 'nes', icon: 'S', description: 'PPU scroll: $2000, $2002, $2005-$2007' },
  eval: ({ cs, rw, addr, data_in, ctrl, v, t, x, w }) => {
    const reg = cs === 1 ? (addr as number) : 8;
    const d = data_in as number;
    const write = rw === 0;
    let nv = v as number;
    let nt = t as number;
    let nx = x as number;
    let nw = w as number;
    if (write && reg === 0) {
      nt = (nt & 0x73ff) | ((d & 3) << 10);
    } else if (!write && reg === 2) {
      nw = 0;
    } else if (write && reg === 5) {
      if (w === 0) nt = (nt & 0x7fe0) | (d >> 3);
      else nt = (nt & 0x0c1f) | ((d & 7) << 12) | ((d >> 3) << 5);
      if (w === 0) nx = d & 7;
      nw = (w as number) ^ 1;
    } else if (write && reg === 6) {
      nt = w === 0 ? (nt & 0x00ff) | ((d & 0x3f) << 8) : (nt & 0x7f00) | d;
      if (w === 1) nv = nt;
      nw = (w as number) ^ 1;
    } else if (reg === 7) {
      nv = (nv + (((ctrl as number) & 4) !== 0 ? 32 : 1)) & 0x7fff;
    }
    return { next_v: nv, next_t: nt, next_x: nx, next_w: nw };
  },
});

const PpuScroll = circuit('PpuScroll', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    ctrl: bus(8),
    mask: bus(8),
    dot: bus(9),
    line: bus(9),
  },
  outputs: { v: bus(15), x: bus(3) },
  nodes: {
    v: Register({ width: 15 }),
    t: Register({ width: 15 }),
    x: Register({ width: 3 }),
    w: Register({ width: 1 }),
    render: PpuScrollRender,
    cpu: PpuScrollCpu,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.v.we, n.t.we, n.x.we, n.w.we),
    inputs.cs.to(n.cpu.cs),
    inputs.rw.to(n.cpu.rw),
    inputs.addr.to(n.cpu.addr),
    inputs.data_in.to(n.cpu.data_in),
    inputs.ctrl.to(n.cpu.ctrl),
    inputs.mask.to(n.render.mask),
    inputs.dot.to(n.render.dot),
    inputs.line.to(n.render.line),
    n.v.q.to(n.render.v, outputs.v),
    n.t.q.to(n.render.t, n.cpu.t),
    n.x.q.to(n.cpu.x, outputs.x),
    n.w.q.to(n.cpu.w),
    n.render.v_out.to(n.cpu.v),
    n.cpu.next_v.to(n.v.data),
    n.cpu.next_t.to(n.t.data),
    n.cpu.next_x.to(n.x.data),
    n.cpu.next_w.to(n.w.data),
  ],
});

// ── nes/src/ppu/oam.ts ──

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
 * \`sprite0\` goes up when the first sprite checked (dot 66) is in range: it
 * is then in slot 0 of the next line. During rendering, $2004 writes don't
 * store and step OAMADDR by 4, and reads on dots 1-64 return $FF.
 */

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

const PpuOam = circuit('PpuOam', {
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

// ── nes/src/ppu/sprites.ts ──

/**
 * Sprites: fetch the next line's sprites, draw them, put them in front of
 * or behind the background.
 *
 * Fetch. On dots 257-320 of each rendering line, 8 dots per slot of
 * secondary OAM (oam.ts), the same rhythm as a background tile:
 *
 *   dots 1-4   read the slot's Y, tile, attributes and X from secondary OAM;
 *              meanwhile the PPU bus does two unused nametable reads
 *   dots 5-6   pattern, plane 0
 *   dots 7-8   pattern, plane 1; the slot's sprite unit loads
 *
 * The row is L - Y, upside down with attribute bit 7. 8x8 sprites take their
 * pattern table from PPUCTRL bit 3; 8x16 sprites from tile bit 0, using tiles
 * (tile & $FE) for the top half and the next for the bottom. Attribute bit 6
 * mirrors the bytes. Slots evaluation left empty load transparent rows, and
 * so does the pre-render line, so nothing shows on line 0.
 *
 * Units. Eight, one per slot, each two 8-bit pattern shifters, the palette
 * and priority bits, and an X counter. On each visible dot a unit counts X
 * down to 0, then shifts out one pixel per dot.
 *
 * Pixel. The lowest-numbered unit with an opaque pixel is the sprite pixel;
 * PPUMASK bit 4 shows sprites and bit 2 shows them in the left 8 pixels. It
 * wins over the background unless its priority bit says behind and the
 * background is opaque there. Sprite palettes are $3F10-$3F1F, so the 5-bit
 * pixel is $10 | palette × 4 + pattern bits.
 *
 * Sprite 0 hit goes up on an opaque pixel of unit 0 over an opaque background
 * pixel, when unit 0 holds sprite 0, except at x = 255. It stays up until the
 * pre-render line.
 */

/**
 * The sprite's pattern address for this line, and the byte read there as the
 * unit takes it: mirrored with attribute bit 6, transparent for an empty slot.
 */
const PpuSpritePattern = circuit('PpuSpritePattern', {
  inputs: {
    line: bus(9),
    ctrl: bus(8),
    y: bus(8),
    tile: bus(8),
    attr: bus(8),
    used: bit,
    vram_rdata: bus(8),
  },
  outputs: { addr: bus(14), bits: bus(8) },
  meta: { category: 'nes', icon: 'T', description: 'PPU sprite pattern address and row' },
  eval: ({ line, ctrl, y, tile, attr, used, vram_rdata }) => {
    const at = attr as number;
    const t = tile as number;
    const c = ctrl as number;
    const tall = (c & 0x20) !== 0;
    const last = tall ? 15 : 7;
    let row = ((line as number) - (y as number)) & last;
    if ((at & 0x80) !== 0) row = last - row;
    const addr = tall
      ? ((t & 1) << 12) | (((t & 0xfe) | (row >> 3)) << 4) | (row & 7)
      : ((c & 0x08) << 9) | (t << 4) | row;

    const d = vram_rdata as number;
    const mirrored =
      ((d & 0x01) << 7) |
      ((d & 0x02) << 5) |
      ((d & 0x04) << 3) |
      ((d & 0x08) << 1) |
      ((d & 0x10) >> 1) |
      ((d & 0x20) >> 3) |
      ((d & 0x40) >> 5) |
      ((d & 0x80) >> 7);
    let bits = (at & 0x40) !== 0 ? mirrored : d;
    if (used === 0) bits = 0;
    return { addr, bits };
  },
});

/** Secondary OAM to the units: the slot's bytes, its pattern rows, the load. */
const PpuSpriteFetch = circuit('PpuSpriteFetch', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    v: bus(15),
    bg_addr: bus(14),
    pattern: bus(14),
    bits: bus(8),
    sec_data: bus(8),
    found: bus(6),
    first: bit,
    y: bus(8),
    tile: bus(8),
    attr: bus(8),
    x: bus(8),
    lo: bus(8),
    zero: bit,
  },
  outputs: {
    vram_addr: bus(14),
    fetch_addr: bus(5),
    slot: bus(3),
    used: bit,
    load: bit,
    next_y: bus(8),
    next_tile: bus(8),
    next_attr: bus(8),
    next_x: bus(8),
    next_lo: bus(8),
    next_zero: bit,
  },
  meta: { category: 'nes', icon: 'F', description: 'PPU sprite fetch: secondary OAM to units' },
  eval: ({
    dot,
    line,
    mask,
    v,
    bg_addr,
    pattern,
    bits,
    sec_data,
    found,
    first,
    y,
    tile,
    attr,
    x,
    lo,
    zero,
  }) => {
    const dt = dot as number;
    const ln = line as number;
    const rendering = ((mask as number) & 0x18) !== 0 && (ln < 240 || ln === 261);
    const fetching = rendering && dt >= 257 && dt <= 320;
    const slot = ((dt - 257) >> 3) & 7;
    const phase = (dt - 257) & 7;

    let addr = bg_addr as number;
    if (fetching && phase < 4) addr = 0x2000 | ((v as number) & 0x0fff);
    else if (fetching && phase < 6) addr = pattern as number;
    else if (fetching) addr = (pattern as number) | 8;

    // Which byte this dot latches: 0-3 the slot's, 5 plane 0; 8 for none.
    const latch = fetching ? phase : 8;
    const s = sec_data as number;
    const visibleLine = ln < 240 ? 1 : 0;
    return {
      vram_addr: addr,
      fetch_addr: (slot << 2) | (phase < 3 ? phase : 3),
      slot,
      used: slot * 4 < (found as number) ? visibleLine : 0,
      load: fetching && phase === 7 ? 1 : 0,
      next_y: latch === 0 ? s : (y as number),
      next_tile: latch === 1 ? s : (tile as number),
      next_attr: latch === 2 ? s : (attr as number),
      next_x: latch === 3 ? s : (x as number),
      next_lo: latch === 5 ? (bits as number) : (lo as number),
      next_zero: fetching && dt === 257 ? (first as number) & visibleLine : (zero as number),
    };
  },
});

/** A sprite unit's next state and its pixel. */
const PpuSpriteUnitLogic = circuit('PpuSpriteUnitLogic', {
  inputs: {
    slot: bus(3),
    me: bus(3),
    load: bit,
    run: bit,
    in_lo: bus(8),
    in_hi: bus(8),
    in_attr: bus(8),
    in_x: bus(8),
    lo: bus(8),
    hi: bus(8),
    attr: bus(3),
    x: bus(8),
  },
  outputs: {
    pixel: bus(4),
    behind: bit,
    next_lo: bus(8),
    next_hi: bus(8),
    next_attr: bus(3),
    next_x: bus(8),
  },
  meta: { category: 'nes', icon: 'U', description: 'PPU sprite unit: X counter and shifters' },
  eval: ({ slot, me, load, run, in_lo, in_hi, in_attr, in_x, lo, hi, attr, x }) => {
    const l = lo as number;
    const h = hi as number;
    const xc = x as number;
    const bits = xc === 0 ? ((l >> 7) & 1) | (((h >> 7) & 1) << 1) : 0;
    const loading = load === 1 && slot === me;
    const shift = run === 1 && xc === 0;
    let nextX = xc;
    if (loading) nextX = in_x as number;
    else if (run === 1 && xc !== 0) nextX = xc - 1;
    let nextLo = shift ? (l << 1) & 0xff : l;
    let nextHi = shift ? (h << 1) & 0xff : h;
    if (loading) nextLo = in_lo as number;
    if (loading) nextHi = in_hi as number;
    const ia = in_attr as number;
    return {
      pixel: bits !== 0 ? (((attr as number) & 3) << 2) | bits : 0,
      behind: ((attr as number) >> 2) & 1,
      next_lo: nextLo,
      next_hi: nextHi,
      next_attr: loading ? ((ia >> 3) & 4) | (ia & 3) : (attr as number),
      next_x: nextX,
    };
  },
});

/**
 * One of the eight sprite units. \`me\` is its slot number, tied to a
 * constant; it loads when the fetch says \`load\` for that slot.
 */
const PpuSpriteUnit = circuit('PpuSpriteUnit', {
  inputs: {
    slot: bus(3),
    me: bus(3),
    load: bit,
    run: bit,
    in_lo: bus(8),
    in_hi: bus(8),
    in_attr: bus(8),
    in_x: bus(8),
  },
  outputs: { pixel: bus(4), behind: bit },
  nodes: {
    lo: Register({ width: 8 }),
    hi: Register({ width: 8 }),
    attr: Register({ width: 3 }),
    x: Register({ width: 8 }),
    logic: PpuSpriteUnitLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.lo.we, n.hi.we, n.attr.we, n.x.we),
    inputs.slot.to(n.logic.slot),
    inputs.me.to(n.logic.me),
    inputs.load.to(n.logic.load),
    inputs.run.to(n.logic.run),
    inputs.in_lo.to(n.logic.in_lo),
    inputs.in_hi.to(n.logic.in_hi),
    inputs.in_attr.to(n.logic.in_attr),
    inputs.in_x.to(n.logic.in_x),
    n.lo.q.to(n.logic.lo),
    n.hi.q.to(n.logic.hi),
    n.attr.q.to(n.logic.attr),
    n.x.q.to(n.logic.x),
    n.logic.next_lo.to(n.lo.data),
    n.logic.next_hi.to(n.hi.data),
    n.logic.next_attr.to(n.attr.data),
    n.logic.next_x.to(n.x.data),
    n.logic.pixel.to(outputs.pixel),
    n.logic.behind.to(outputs.behind),
  ],
});

/** Front-most sprite, priority against the background, sprite 0 hit. */
const PpuSpritePixel = circuit('PpuSpritePixel', {
  inputs: {
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    bg: bus(5),
    p0: bus(4),
    p1: bus(4),
    p2: bus(4),
    p3: bus(4),
    p4: bus(4),
    p5: bus(4),
    p6: bus(4),
    p7: bus(4),
    b0: bit,
    b1: bit,
    b2: bit,
    b3: bit,
    b4: bit,
    b5: bit,
    b6: bit,
    b7: bit,
    zero: bit,
    hit: bit,
    flags_clear: bit,
  },
  outputs: { pixel: bus(5), run: bit, next_hit: bit },
  meta: { category: 'nes', icon: 'P', description: 'PPU pixel: sprite priority, sprite 0 hit' },
  eval: ({
    dot,
    line,
    mask,
    bg,
    p0,
    p1,
    p2,
    p3,
    p4,
    p5,
    p6,
    p7,
    b0,
    b1,
    b2,
    b3,
    b4,
    b5,
    b6,
    b7,
    zero,
    hit,
    flags_clear,
  }) => {
    const dt = dot as number;
    const m = mask as number;
    const visible = (m & 0x18) !== 0 && (line as number) < 240 && dt >= 1 && dt <= 256;
    const shown = visible && (m & 0x10) !== 0 && ((m & 0x04) !== 0 || dt > 8);

    // Unit 7 first, so the lowest opaque unit is the last to overwrite.
    let sp = 0;
    let behind = 0;
    if (((p7 as number) & 3) !== 0) {
      sp = p7 as number;
      behind = b7 as number;
    }
    if (((p6 as number) & 3) !== 0) {
      sp = p6 as number;
      behind = b6 as number;
    }
    if (((p5 as number) & 3) !== 0) {
      sp = p5 as number;
      behind = b5 as number;
    }
    if (((p4 as number) & 3) !== 0) {
      sp = p4 as number;
      behind = b4 as number;
    }
    if (((p3 as number) & 3) !== 0) {
      sp = p3 as number;
      behind = b3 as number;
    }
    if (((p2 as number) & 3) !== 0) {
      sp = p2 as number;
      behind = b2 as number;
    }
    if (((p1 as number) & 3) !== 0) {
      sp = p1 as number;
      behind = b1 as number;
    }
    if (((p0 as number) & 3) !== 0) {
      sp = p0 as number;
      behind = b0 as number;
    }
    if (!shown) sp = 0;

    const b = bg as number;
    const bgOpaque = (b & 3) !== 0;
    const sprite = sp !== 0 && (!bgOpaque || behind === 0);
    const zeroHit = zero === 1 && shown && ((p0 as number) & 3) !== 0 && bgOpaque && dt !== 256;
    let nextHit = hit as number;
    if (flags_clear === 1) nextHit = 0;
    else if (zeroHit) nextHit = 1;
    return {
      pixel: sprite ? 0x10 | sp : b,
      run: visible ? 1 : 0,
      next_hit: nextHit,
    };
  },
});

const UNITS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const PpuSprites = circuit('PpuSprites', {
  inputs: {
    cs: bit,
    rw: bit,
    addr: bus(3),
    data_in: bus(8),
    dot: bus(9),
    line: bus(9),
    mask: bus(8),
    ctrl: bus(8),
    v: bus(15),
    flags_clear: bit,
    bg_addr: bus(14),
    bg_pixel: bus(5),
    vram_rdata: bus(8),
  },
  outputs: {
    data_out: bus(8),
    vram_addr: bus(14),
    pixel: bus(5),
    hit: bit,
    overflow: bit,
  },
  nodes: {
    oam: PpuOam,
    fetch: PpuSpriteFetch,
    pattern: PpuSpritePattern,
    y: Register({ width: 8 }),
    tile: Register({ width: 8 }),
    attr: Register({ width: 8 }),
    x: Register({ width: 8 }),
    lo: Register({ width: 8 }),
    zero: Register({ width: 1 }),
    u0: PpuSpriteUnit,
    u1: PpuSpriteUnit,
    u2: PpuSpriteUnit,
    u3: PpuSpriteUnit,
    u4: PpuSpriteUnit,
    u5: PpuSpriteUnit,
    u6: PpuSpriteUnit,
    u7: PpuSpriteUnit,
    n0: Constant({ value: 0, width: 3 }),
    n1: Constant({ value: 1, width: 3 }),
    n2: Constant({ value: 2, width: 3 }),
    n3: Constant({ value: 3, width: 3 }),
    n4: Constant({ value: 4, width: 3 }),
    n5: Constant({ value: 5, width: 3 }),
    n6: Constant({ value: 6, width: 3 }),
    n7: Constant({ value: 7, width: 3 }),
    pix: PpuSpritePixel,
    hit: Register({ width: 1 }),
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => {
    const units = [n.u0, n.u1, n.u2, n.u3, n.u4, n.u5, n.u6, n.u7];
    const ids = [n.n0, n.n1, n.n2, n.n3, n.n4, n.n5, n.n6, n.n7];
    const pixels = [n.pix.p0, n.pix.p1, n.pix.p2, n.pix.p3, n.pix.p4, n.pix.p5, n.pix.p6, n.pix.p7];
    const behind = [n.pix.b0, n.pix.b1, n.pix.b2, n.pix.b3, n.pix.b4, n.pix.b5, n.pix.b6, n.pix.b7];
    return [
      n.always.out.to(n.y.we, n.tile.we, n.attr.we, n.x.we, n.lo.we, n.zero.we, n.hit.we),
      inputs.cs.to(n.oam.cs),
      inputs.rw.to(n.oam.rw),
      inputs.addr.to(n.oam.addr),
      inputs.data_in.to(n.oam.data_in),
      inputs.dot.to(n.oam.dot, n.fetch.dot, n.pix.dot),
      inputs.line.to(n.oam.line, n.fetch.line, n.pattern.line, n.pix.line),
      inputs.mask.to(n.oam.mask, n.fetch.mask, n.pix.mask),
      inputs.ctrl.to(n.oam.ctrl, n.pattern.ctrl),
      inputs.v.to(n.fetch.v),
      inputs.flags_clear.to(n.oam.flags_clear, n.pix.flags_clear),
      inputs.bg_addr.to(n.fetch.bg_addr),
      inputs.bg_pixel.to(n.pix.bg),
      inputs.vram_rdata.to(n.pattern.vram_rdata),
      n.oam.data_out.to(outputs.data_out),
      n.oam.overflow.to(outputs.overflow),
      n.oam.sec_data.to(n.fetch.sec_data),
      n.oam.found.to(n.fetch.found),
      n.oam.first.to(n.fetch.first),
      n.fetch.fetch_addr.to(n.oam.fetch_addr),
      n.fetch.vram_addr.to(outputs.vram_addr),
      n.y.q.to(n.fetch.y, n.pattern.y),
      n.tile.q.to(n.fetch.tile, n.pattern.tile),
      n.attr.q.to(n.fetch.attr, n.pattern.attr, ...units.map((u) => u.in_attr)),
      n.x.q.to(n.fetch.x, ...units.map((u) => u.in_x)),
      n.lo.q.to(n.fetch.lo, ...units.map((u) => u.in_lo)),
      n.zero.q.to(n.fetch.zero, n.pix.zero),
      n.fetch.next_y.to(n.y.data),
      n.fetch.next_tile.to(n.tile.data),
      n.fetch.next_attr.to(n.attr.data),
      n.fetch.next_x.to(n.x.data),
      n.fetch.next_lo.to(n.lo.data),
      n.fetch.next_zero.to(n.zero.data),
      n.fetch.slot.to(...units.map((u) => u.slot)),
      n.fetch.load.to(...units.map((u) => u.load)),
      n.fetch.used.to(n.pattern.used),
      n.pattern.addr.to(n.fetch.pattern),
      n.pattern.bits.to(n.fetch.bits, ...units.map((u) => u.in_hi)),
      n.pix.run.to(...units.map((u) => u.run)),
      ...UNITS.map((i) => ids[i].out.to(units[i].me)),
      ...UNITS.map((i) => units[i].pixel.to(pixels[i])),
      ...UNITS.map((i) => units[i].behind.to(behind[i])),
      n.hit.q.to(n.pix.hit, outputs.hit),
      n.pix.next_hit.to(n.hit.data),
      n.pix.pixel.to(outputs.pixel),
    ];
  },
});

// ── nes/src/ppu/timing.ts ──

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
 * can be read from that dot on: \`vbl_set\` is high on (241, 0) and the flag
 * reads 1 from (241, 1).
 */

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

const PpuTiming = circuit('PpuTiming', {
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

// ── nes/src/ppu/ppu.ts ──

/**
 * The NES picture processor (2C02), built up block by block (#601). So far:
 * timing (dot and scanline, vblank), the CPU-facing registers with NMI, the
 * scroll/address registers, the $2007 data port with palette RAM, the
 * background, and sprites with OAM.
 *
 * One tick is one dot. The CPU side is \`cs\` (high for one tick per CPU access
 * to $2000-$3FFF), \`rw\`, \`addr\` (the low 3 address bits) and the data buses.
 * The memory side is the PPU's own bus to the board: \`vram_addr\` (14 bits),
 * \`vram_we\`, \`vram_wdata\` out and \`vram_rdata\` in, read the same tick.
 *
 * Video out: on dots 1-256 of lines 0-239 \`video_we\` is high and \`color\` is
 * the 6-bit colour of pixel (\`video_x\`, \`video_y\`) = (dot - 1, line).
 */

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

const Ppu = circuit('Ppu', {
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
    sprites: PpuSprites,
    video: PpuVideo,
  },
  connect: ({
    inputs,
    outputs,
    nodes: { timing, regs, scroll, data, background, sprites, video },
  }) => [
    inputs.cs.to(regs.cs, scroll.cs, data.cs, sprites.cs),
    inputs.rw.to(regs.rw, scroll.rw, data.rw, sprites.rw),
    inputs.addr.to(regs.addr, scroll.addr, data.addr, sprites.addr),
    inputs.data_in.to(
      regs.data_in,
      scroll.data_in,
      data.data_in,
      sprites.data_in,
      outputs.vram_wdata,
    ),
    inputs.vram_rdata.to(data.vram_rdata, background.vram_rdata, sprites.vram_rdata),
    regs.mask.to(timing.mask, scroll.mask, background.mask, sprites.mask, data.mask),
    regs.ctrl.to(scroll.ctrl, background.ctrl, sprites.ctrl),
    timing.dot.to(scroll.dot, background.dot, sprites.dot, video.dot, outputs.dot),
    timing.line.to(scroll.line, background.line, sprites.line, video.line, outputs.line),
    scroll.v.to(data.v, background.v, sprites.v),
    scroll.x.to(background.x),
    data.data_out.to(regs.data7),
    data.vram_addr.to(background.data_addr),
    background.vram_addr.to(sprites.bg_addr),
    sprites.vram_addr.to(outputs.vram_addr),
    sprites.data_out.to(regs.data4),
    sprites.hit.to(regs.hit),
    sprites.overflow.to(regs.overflow),
    data.vram_we.to(outputs.vram_we),
    background.pixel.to(sprites.bg_pixel),
    sprites.pixel.to(data.pixel),
    data.color.to(outputs.color),
    timing.vbl_set.to(regs.vbl_set),
    timing.flags_clear.to(regs.flags_clear, sprites.flags_clear),
    regs.data_out.to(outputs.data_out),
    regs.nmi.to(outputs.nmi),
    video.video_x.to(outputs.video_x),
    video.video_y.to(outputs.video_y),
    video.video_we.to(outputs.video_we),
  ],
});

// ── nes/src/board.ts ──

/**
 * The NES: the console (the 6502 core, 2 KB of work RAM, the PPU, OAM DMA and
 * the controller ports) and, through the cartridge connector, a cartridge
 * (cart.ts). \`NesConsole\` is the console alone, with the connector as ports;
 * \`Nes\` is the console with an NROM cart plugged in.
 *
 * CPU memory map:
 *   $0000-$1FFF  2 KB work RAM, mirrored every $0800
 *   $2000-$3FFF  PPU registers, mirrored every 8 bytes (ppu/regs.ts).
 *   $4000-$401F  APU and I/O registers. The APU (apu/) has $4000-$4013,
 *                $4015 and $4017 writes. $4014 is OAM DMA (dma.ts), which
 *                halts the CPU and copies a page to $2004; $4016 and $4017
 *                reads are the controller ports (pads.ts). The rest read $00.
 *   $4020-$FFFF  The cartridge. NROM puts PRG ROM at $8000 (16 KB mirrored
 *                at $C000, or 32 KB) and reads $00 below it, or its PRG RAM
 *                at $6000 if it has one. Open bus is not modelled.
 *
 * The CPU is the 2A03's: a 6502 with decimal mode disconnected (D still sets
 * and clears, ADC and SBC stay binary) and RDY driven by the OAM DMA unit.
 * PPU memory: the cartridge at $0000-$1FFF (NROM's 8 KB of CHR ROM), and the
 * console's 2 KB of nametable RAM at $2000-$3EFF, mirrored by the cartridge:
 * horizontal mirroring (iNES flag 0) makes $2000 = $2400 and $2800 = $2C00,
 * vertical makes $2000 = $2800 and $2400 = $2C00. Palette RAM is inside the
 * PPU.
 *
 * The PPU drives nmi; the APU's frame IRQ and the cartridge drive irq. \`audio\`
 * is the APU's mixed output, one 16-bit sample per tick. The core runs its reset sequence
 * at power-on and starts at the reset vector in $FFFC.
 *
 * \`addr\`, \`rw\` and \`data\` are the bus, so during a DMA they show the copy.
 *
 * One tick is one PPU dot. The CPU runs on every third tick (\`ce\`, the
 * connector's \`m2\`), as the 2A03 does from the same crystal, and work RAM and
 * the DMA unit act only on those ticks, so a CPU cycle reads or writes each
 * device once. Between them the bus holds the cycle the next CPU tick runs.
 * Step one CPU cycle with \`sim.tick(3)\`.
 *
 * Load a cartridge's ROMs with
 * \`simulate(Nes(...), { memory: { 'cart.prg': ..., 'cart.chr': ... } })\`, or
 * use \`createNes\`.
 */

type B = ReturnType<typeof bus>;

/**
 * Address decode and the CPU's read data mux. $4020 and up is the
 * cartridge's: the console reads whatever the cart drives there.
 */
const NesBus = circuit('NesBus', {
  inputs: {
    addr: bus(16),
    rw: bit,
    ce: bit,
    cpu_out: bus(8),
    ram_data: bus(8),
    ppu_data: bus(8),
    pads_data: bus(8),
    apu_data: bus(8),
    cart_data: bus(8),
    apu_irq: bit,
    cart_irq: bit,
  },
  outputs: {
    ram_addr: bus(11),
    ram_we: bit,
    ppu_cs: bit,
    ppu_addr: bus(3),
    pads_cs: bit,
    pads_port: bit,
    apu_cs: bit,
    apu_addr: bus(5),
    cart_addr: bus(15),
    romsel: bit,
    cpu_in: bus(8),
    data: bus(8),
    irq: bit,
  },
  eval: ({
    addr,
    rw,
    ce,
    cpu_out,
    ram_data,
    ppu_data,
    pads_data,
    apu_data,
    cart_data,
    apu_irq,
    cart_irq,
  }) => {
    const ppu = addr >= 0x2000 && addr < 0x4000;
    const pads = addr === 0x4016 || (addr === 0x4017 && rw);
    // $4000-$4013, $4015 and $4017 writes. $4014 is OAM DMA.
    const apu = (addr >= 0x4000 && addr < 0x4014) || addr === 0x4015 || (addr === 0x4017 && !rw);
    let read = 0;
    if (addr < 0x2000) read = ram_data;
    else if (ppu) read = ppu_data;
    else if (pads) read = pads_data;
    else if (addr === 0x4015) read = apu_data;
    else if (addr >= 0x4020) read = cart_data;
    return {
      ram_addr: addr & 0x7ff,
      ram_we: ce && !rw && addr < 0x2000 ? 1 : 0,
      ppu_cs: ce && ppu ? 1 : 0,
      ppu_addr: addr & 7,
      pads_cs: ce && pads ? 1 : 0,
      pads_port: addr & 1,
      apu_cs: ce && apu ? 1 : 0,
      apu_addr: addr & 0x1f,
      cart_addr: addr & 0x7fff,
      romsel: (addr >> 15) & 1,
      cpu_in: read,
      data: rw ? read : cpu_out,
      irq: apu_irq || cart_irq ? 1 : 0,
    };
  },
});

/**
 * PPU memory: the console's nametable RAM where the cartridge enables it,
 * at the address the cartridge's CIRAM A10 picks; otherwise the cart.
 */
const NesVramBus = circuit('NesVramBus', {
  inputs: {
    addr: bus(14),
    we: bit,
    cart_data: bus(8),
    ciram_data: bus(8),
    ciram_a10: bit,
    ciram_ce: bit,
  },
  outputs: { ciram_addr: bus(11), ciram_we: bit, data: bus(8) },
  eval: ({ addr, we, cart_data, ciram_data, ciram_a10, ciram_ce }) => ({
    ciram_addr: (ciram_a10 << 10) | (addr & 0x3ff),
    ciram_we: we && ciram_ce ? 1 : 0,
    data: ciram_ce ? ciram_data : cart_data,
  }),
});

/** The CPU's clock enable: high on every third tick, starting with the first. */
const CpuClock = circuit('CpuClock', {
  outputs: { ce: bit },
  state: { phase: 0 },
  eval: ({ phase }) => ({ ce: phase === 0 ? 1 : 0 }),
  onTick: ({ phase }) => ({ phase: phase === 2 ? 0 : ((phase as number) + 1) & 3 }),
});

type BoardOuts = {
  addr: B;
  rw: typeof bit;
  sync: typeof bit;
  data: B;
  video_x: B;
  video_y: B;
  video_we: typeof bit;
  color: B;
  audio: B;
  pc: B;
  a: B;
  x: B;
  y: B;
  s: B;
  p: B;
};

/** What the console and the whole NES both output. */
const consoleOutputs = (debug: boolean) =>
  ({
    addr: bus(16),
    rw: bit,
    sync: bit,
    data: bus(8),
    video_x: bus(8),
    video_y: bus(8),
    video_we: bit,
    color: bus(6),
    audio: bus(16),
    ...(debug ? { pc: bus(16), a: bus(8), x: bus(8), y: bus(8), s: bus(8), p: bus(8) } : {}),
  }) as unknown as BoardOuts;

/**
 * The console without a cartridge: its connector is ports (see cart.ts).
 * \`debug\` adds the core's register outputs (\`pc\`, \`a\`, \`x\`, \`y\`, \`s\`, \`p\`).
 * \`addr\`, \`rw\`, \`sync\` and \`data\` (the byte the CPU reads or writes this
 * cycle) are always outputs, and so is the PPU's video: \`color\` for pixel
 * (\`video_x\`, \`video_y\`) on ticks where \`video_we\` is high.
 * Inputs \`pad1\` and \`pad2\` are the controllers' buttons, 1 = pressed (see
 * \`BUTTON\` in pads.ts).
 */
const NesConsole = circuit('NesConsole', ({ debug = false }: { debug?: boolean } = {}) => ({
  inputs: { pad1: bus(8), pad2: bus(8), ...CART_OUTPUTS },
  outputs: { ...consoleOutputs(debug), ...CART_INPUTS },
  nodes: {
    clock: CpuClock,
    cpu: MOS6502_Core({ debug, decimal: false, rdy: true, ce: true }),
    dma: OamDma,
    ppu: Ppu,
    pads: NesPads,
    apu: Apu,
    bus: NesBus,
    ram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
    vbus: NesVramBus,
    ciram: DualPortRAM({ addressWidth: 11, dataWidth: 8 }),
    low: Constant({ value: 0 }),
  },
  connect: ({
    inputs: i,
    outputs: o,
    nodes: { clock, cpu, dma, ppu, pads, apu, bus: b, ram, vbus, ciram, low },
  }) => {
    const rows = [
      clock.ce.to(cpu.ce, dma.ce, b.ce, apu.ce, o.m2),
      low.out.to(cpu.reset),
      i.irq.to(b.cart_irq),
      apu.irq.to(b.apu_irq),
      b.irq.to(cpu.irq),
      b.apu_cs.to(apu.cs),
      b.apu_addr.to(apu.addr),
      apu.data_out.to(b.apu_data),
      apu.audio.to(o.audio),
      ppu.nmi.to(cpu.nmi),
      b.ppu_cs.to(ppu.cs),
      b.ppu_addr.to(ppu.addr),
      ppu.data_out.to(b.ppu_data),
      b.pads_cs.to(pads.cs),
      b.pads_port.to(pads.port),
      pads.data_out.to(b.pads_data),
      i.pad1.to(pads.pad1),
      i.pad2.to(pads.pad2),
      cpu.addr.to(dma.cpu_addr),
      cpu.rw.to(dma.cpu_rw),
      cpu.data_out.to(dma.cpu_out),
      dma.rdy.to(cpu.rdy),
      dma.addr.to(b.addr, o.addr),
      dma.rw.to(b.rw, o.rw, ppu.rw, pads.rw, apu.rw, o.cpu_rw),
      dma.out.to(ram.dataA, b.cpu_out, ppu.data_in, pads.data_in, apu.data, o.cpu_wdata),
      cpu.sync.to(o.sync),
      b.ram_addr.to(ram.addrA, ram.addrB),
      b.ram_we.to(ram.weA),
      ram.outA.to(b.ram_data),
      b.cart_addr.to(o.cpu_addr),
      b.romsel.to(o.romsel),
      i.cpu_rdata.to(b.cart_data),
      b.cpu_in.to(cpu.data_in, dma.read),
      b.data.to(o.data),
      ppu.vram_addr.to(vbus.addr, o.ppu_addr),
      ppu.vram_we.to(vbus.we, o.ppu_we),
      ppu.vram_wdata.to(ciram.dataA, o.ppu_wdata),
      i.ppu_rdata.to(vbus.cart_data),
      i.ciram_a10.to(vbus.ciram_a10),
      i.ciram_ce.to(vbus.ciram_ce),
      vbus.ciram_addr.to(ciram.addrA, ciram.addrB),
      vbus.ciram_we.to(ciram.weA),
      ciram.outA.to(vbus.ciram_data),
      vbus.data.to(ppu.vram_rdata),
      ppu.video_x.to(o.video_x),
      ppu.video_y.to(o.video_y),
      ppu.video_we.to(o.video_we),
      ppu.color.to(o.color),
    ];
    if (debug) {
      rows.push(
        cpu.pc.to(o.pc),
        cpu.a.to(o.a),
        cpu.x.to(o.x),
        cpu.y.to(o.y),
        cpu.s.to(o.s),
        cpu.p.to(o.p),
      );
    }
    return rows;
  },
}));

/**
 * The console with an NROM cartridge plugged in. \`prgSize\` is 0x4000 (16 KB,
 * mirrored) or 0x8000 (32 KB); \`vertical\` is 1 for vertical nametable
 * mirroring; \`wram\` 1 adds 8 KB of PRG RAM at $6000. Ports as \`NesConsole\`'s,
 * less the connector. The ROMs are nodes \`cart.prg\` and \`cart.chr\`; \`prg\`
 * and \`chr\` bake contents in instead.
 */
const Nes = circuit(
  'Nes',
  ({
    prgSize = 0x8000,
    vertical = 0,
    wram = 0,
    debug = false,
    prg,
    chr,
  }: {
    prgSize?: number;
    vertical?: number;
    wram?: number;
    prg?: ReturnType<typeof romFromBytes>;
    chr?: ReturnType<typeof romFromBytes>;
    debug?: boolean;
  } = {}) => ({
    inputs: { pad1: bus(8), pad2: bus(8) },
    outputs: consoleOutputs(debug),
    nodes: {
      console: NesConsole({ debug }),
      cart: NromCart({ prgSize, vertical, wram, prg, chr }),
    },
    connect: ({ inputs: i, outputs: o, nodes: { console: c, cart } }) => {
      const rows = [
        i.pad1.to(c.pad1),
        i.pad2.to(c.pad2),
        c.cpu_addr.to(cart.cpu_addr),
        c.romsel.to(cart.romsel),
        c.m2.to(cart.m2),
        c.cpu_rw.to(cart.cpu_rw),
        c.cpu_wdata.to(cart.cpu_wdata),
        c.ppu_addr.to(cart.ppu_addr),
        c.ppu_we.to(cart.ppu_we),
        c.ppu_wdata.to(cart.ppu_wdata),
        cart.cpu_rdata.to(c.cpu_rdata),
        cart.irq.to(c.irq),
        cart.ppu_rdata.to(c.ppu_rdata),
        cart.ciram_a10.to(c.ciram_a10),
        cart.ciram_ce.to(c.ciram_ce),
        c.addr.to(o.addr),
        c.rw.to(o.rw),
        c.sync.to(o.sync),
        c.data.to(o.data),
        c.video_x.to(o.video_x),
        c.video_y.to(o.video_y),
        c.video_we.to(o.video_we),
        c.color.to(o.color),
        c.audio.to(o.audio),
      ];
      if (debug) {
        rows.push(c.pc.to(o.pc), c.a.to(o.a), c.x.to(o.x), c.y.to(o.y), c.s.to(o.s), c.p.to(o.p));
      }
      return rows;
    },
  }),
);

// ── nes/src/demo.ts ──

/**
 * A demo cartridge for the NES, and the NES wired to a screen. The program
 * waits for the PPU's first vblank, loads a palette, writes the simten logo
 * (the square wave from the site's header) into the middle of the first
 * nametable, and turns the background on. From the next frame the PPU draws
 * it, dot by dot.
 *
 *   8000  78        SEI            no interrupts
 *   8001  D8        CLD
 *   8002  A2 FF     LDX #$FF       stack at $01FF
 *   8004  9A        TXS
 *   8005  2C 02 20  BIT $2002      wait for vblank: PPUSTATUS bit 7
 *   8008  10 FB     BPL $8005
 *   800A  A9 3F     LDA #$3F       PPUADDR = $3F00, the palette
 *   800C  8D 06 20  STA $2006
 *   800F  A9 00     LDA #$00
 *   8011  8D 06 20  STA $2006
 *   8014  A2 00     LDX #0
 *   8016  BD 4B 80  LDA $804B,X    four colours
 *   8019  8D 07 20  STA $2007
 *   801C  E8        INX
 *   801D  E0 04     CPX #4
 *   801F  D0 F5     BNE $8016
 *   8021  A0 00     LDY #0         Y: logo row, 0 to 7
 *   8023  A2 00     LDX #0         X: logo tile, 0 to 95
 *   8025  B9 59 80  LDA $8059,Y    PPUADDR = the row's first tile
 *   8028  8D 06 20  STA $2006
 *   802B  B9 61 80  LDA $8061,Y
 *   802E  8D 06 20  STA $2006
 *   8031  A9 0C     LDA #12        12 tiles to the row, counted in $00
 *   8033  85 00     STA $00
 *   8035  BD 69 80  LDA $8069,X    the tile number
 *   8038  8D 07 20  STA $2007
 *   803B  E8        INX
 *   803C  C6 00     DEC $00
 *   803E  D0 F5     BNE $8035
 *   8040  C8        INY            next row
 *   8041  C0 08     CPY #8
 *   8043  D0 E0     BNE $8025
 *   8045  A9 00     LDA #0         scroll to 0, 0
 *   8047  8D 05 20  STA $2005
 *   804A  8D 05 20  STA $2005
 *   804D  A9 0A     LDA #$0A       PPUMASK: background on, left column too
 *   804F  8D 01 20  STA $2001
 *   8052  4C 52 80  JMP $8052      done; the PPU does the rest
 *   8055  0F 30 21 11              palette: black, white, light blue, blue
 *   8059  21 21 21 21 21 22 22 22  each row's address, high bytes
 *   8061  6A 8A AA CA EA 0A 2A 4A  and low: row 11 + n, column 10
 *   8069  ...                      the logo's 96 tile numbers, row by row
 *
 * It all has to happen inside the one vblank: turned on mid-frame, the PPU
 * would draw from wherever the writes left its address, as it only takes the
 * scroll at the top of a frame. So only the logo's 96 tiles are written (the
 * rest of the nametable is 0 already, the blank tile), about 2,060 CPU cycles
 * of vblank's 2,273. Frame 1 is blank while the program waits; frame 2 has
 * the logo.
 */

const DEMO_PROGRAM = [
  0x78, 0xd8, 0xa2, 0xff, 0x9a, 0x2c, 0x02, 0x20, 0x10, 0xfb, 0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9,
  0x00, 0x8d, 0x06, 0x20, 0xa2, 0x00, 0xbd, 0x55, 0x80, 0x8d, 0x07, 0x20, 0xe8, 0xe0, 0x04, 0xd0,
  0xf5, 0xa0, 0x00, 0xa2, 0x00, 0xb9, 0x59, 0x80, 0x8d, 0x06, 0x20, 0xb9, 0x61, 0x80, 0x8d, 0x06,
  0x20, 0xa9, 0x0c, 0x85, 0x00, 0xbd, 0x69, 0x80, 0x8d, 0x07, 0x20, 0xe8, 0xc6, 0x00, 0xd0, 0xf5,
  0xc8, 0xc0, 0x08, 0xd0, 0xe0, 0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20, 0xa9, 0x0a, 0x8d,
  0x01, 0x20, 0x4c, 0x52, 0x80,
];
const PALETTE = [0x0f, 0x30, 0x21, 0x11];
/** Where the program's tables sit after it: palette, row addresses, tiles. */
const AT_PALETTE = 0x55;
const AT_ROW_HI = 0x59;
const AT_ROW_LO = 0x61;
const AT_TILES = 0x69;

/** The logo is 12×8 tiles (96×64 pixels), at column 10, row 11: centred. */
const LOGO_COLS = 12;
const LOGO_ROWS = 8;
const LOGO_COL = 10;
const LOGO_ROW = 11;

/**
 * The logo's square wave as corners, in pixels within its 96×64 box: a wide
 * pulse, then two narrow ones, on a 3-pixel line.
 */
const LOGO_WAVE: [number, number][] = [
  [1, 60],
  [22, 60],
  [22, 3],
  [44, 3],
  [44, 60],
  [58, 60],
  [58, 3],
  [66, 3],
  [66, 60],
  [72, 60],
  [72, 3],
  [80, 3],
  [80, 60],
  [94, 60],
];

/** The logo as rows of pixels, 1 where the line is. */
function logoBitmap(): number[][] {
  const w = LOGO_COLS * 8;
  const h = LOGO_ROWS * 8;
  const px = Array.from({ length: h }, () => new Array<number>(w).fill(0));
  for (let i = 1; i < LOGO_WAVE.length; i++) {
    const [x0, y0] = LOGO_WAVE[i - 1];
    const [x1, y1] = LOGO_WAVE[i];
    for (let y = Math.min(y0, y1) - 1; y <= Math.max(y0, y1) + 1; y++) {
      for (let x = Math.min(x0, x1) - 1; x <= Math.max(x0, x1) + 1; x++) {
        if (y >= 0 && y < h && x >= 0 && x < w) px[y][x] = 1;
      }
    }
  }
  return px;
}

/**
 * The logo cut into 8×8 tiles: each distinct tile once, as its 8 rows of
 * bits (tile 0, blank, is left out), and which tile goes where.
 */
function logoTiles(): { tiles: number[][]; map: number[][] } {
  const px = logoBitmap();
  const tiles: number[][] = [];
  const ids = new Map<string, number>();
  const map = Array.from({ length: LOGO_ROWS }, (_, ty) =>
    Array.from({ length: LOGO_COLS }, (_, tx) => {
      const rows = Array.from({ length: 8 }, (_, y) =>
        px[ty * 8 + y].slice(tx * 8, tx * 8 + 8).reduce((b, bit) => (b << 1) | bit, 0),
      );
      if (rows.every((r) => r === 0)) return 0;
      const key = rows.join(',');
      let id = ids.get(key);
      if (id === undefined) {
        tiles.push(rows);
        id = tiles.length;
        ids.set(key, id);
      }
      return id;
    }),
  );
  return { tiles, map };
}

/** Each logo row's nametable address: row LOGO_ROW + n, column LOGO_COL. */
const rowAddresses = Array.from(
  { length: LOGO_ROWS },
  (_, n) => 0x2000 + (LOGO_ROW + n) * 32 + LOGO_COL,
);

/** The 16 KB PRG ROM: the program at $8000, the reset vector pointing at it. */
function demoPrg(): number[] {
  const prg = new Array(0x4000).fill(0);
  const put = (at: number, bytes: number[]) => {
    bytes.forEach((b, i) => {
      prg[at + i] = b;
    });
  };
  put(0, DEMO_PROGRAM);
  put(AT_PALETTE, PALETTE);
  put(
    AT_ROW_HI,
    rowAddresses.map((a) => a >> 8),
  );
  put(
    AT_ROW_LO,
    rowAddresses.map((a) => a & 0xff),
  );
  put(AT_TILES, logoTiles().map.flat());
  prg[0x3ffc] = 0x00; // reset vector, $FFFC (mirrored from $BFFC)
  prg[0x3ffd] = 0x80;
  return prg;
}

/** The 8 KB CHR ROM: tile 0 blank, then the logo's tiles (plane 0 only). */
function demoChr(): number[] {
  const chr = new Array(0x2000).fill(0);
  logoTiles().tiles.forEach((rows, t) => {
    rows.forEach((row, y) => {
      chr[(t + 1) * 16 + y] = row;
    });
  });
  return chr;
}

/**
 * The NES with the demo cartridge in, drawing to a screen, with a byte to
 * type in as controller 1 and its audio shown. Press Run and turn the clock
 * up: one frame is 89,342 ticks, about 9 seconds at the editor's top speed.
 * The first frame is blank while the program waits for the PPU; the second
 * draws the logo.
 */
const NesDemo = circuit('NesDemo', {
  nodes: {
    pad1: Input(),
    nes: Nes({ prgSize: 0x4000, prg: romFromBytes(demoPrg()), chr: romFromBytes(demoChr()) }),
    tv: PaletteDisplay(),
    audio: HexDisplay({ width: 16 }),
  },
  connect: ({ nodes: { pad1, nes, tv, audio } }) => [
    pad1.out.to(nes.pad1),
    nes.video_x.to(tv.x),
    nes.video_y.to(tv.y),
    nes.color.to(tv.color),
    nes.video_we.to(tv.we),
    nes.audio.to(audio.in),
  ],
});
`;
