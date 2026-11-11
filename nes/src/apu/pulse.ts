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
 * `me` is 0 for pulse 1 and 1 for pulse 2. They differ in their addresses and
 * in the sweep's negate: pulse 1 subtracts the ones' complement (period −
 * change − 1), pulse 2 the two's complement (period − change).
 */

import { bit, bus, circuit } from '@simten/core';
import { ApuEnvelope, ApuGate, ApuLength, ApuLengthTable } from './units.js';

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
 * The sweep unit, which holds the channel's 11-bit timer period (`per`).
 * Target = period ± (period >> shift). The channel is muted while the period
 * is under 8 or, adding, the target is over $7FF, whether or not the sweep is
 * enabled. On a half frame, when the divider is 0, the sweep is enabled, the
 * shift is non-zero and the channel isn't muted, the period becomes the
 * target. The divider reloads from P when it is 0 or after a reg 1 write.
 */
export const ApuSweep = circuit('ApuSweep', {
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
export const ApuPulseCore = circuit('ApuPulseCore', {
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

/** A pulse channel. `me` is 0 for pulse 1, 1 for pulse 2 ($4004-$4007). */
export const ApuPulse = circuit('ApuPulse', {
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
