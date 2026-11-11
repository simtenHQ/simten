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

import { bit, bus, circuit } from '@simten/core';
import { ApuEnvelope, ApuGate, ApuLength, ApuLengthTable } from './units.js';

/** NTSC noise periods, in CPU cycles. */
export const ApuNoisePeriod = circuit('ApuNoisePeriod', {
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

export const ApuNoiseCore = circuit('ApuNoiseCore', {
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

export const ApuNoise = circuit('ApuNoise', {
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
