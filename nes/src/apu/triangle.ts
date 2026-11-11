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

import { bit, bus, circuit } from '@simten/core';
import { ApuLength, ApuLengthTable } from './units.js';

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

export const ApuTriangleCore = circuit('ApuTriangleCore', {
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

export const ApuTriangle = circuit('ApuTriangle', {
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
