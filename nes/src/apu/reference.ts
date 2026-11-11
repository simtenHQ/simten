/**
 * A behavioural APU, for testing the circuit: plain TypeScript written from
 * the same NESdev description (#612), one call per CPU cycle. `outputs()` is
 * what the circuit shows during a cycle; `clock()` is the edge at its end,
 * with that cycle's bus access. Where the description leaves the order open,
 * a register write in the same cycle as a clock wins, as in the circuit.
 */

import { mixerTables } from './mixer.js';

const LENGTHS = [
  10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96, 22, 192,
  24, 72, 26, 16, 28, 32, 30,
];
const DUTY = [0x02, 0x06, 0x1e, 0xf9];
const NOISE = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];

class Envelope {
  start = false;
  divider = 0;
  decay = 0;
  loop = false;
  constant = false;
  period = 0;
  volume() {
    return this.constant ? this.period : this.decay;
  }
  quarter() {
    if (this.start) {
      this.start = false;
      this.decay = 15;
      this.divider = this.period;
    } else if (this.divider === 0) {
      this.divider = this.period;
      if (this.decay > 0) this.decay--;
      else if (this.loop) this.decay = 15;
    } else this.divider--;
  }
  reg0(d: number) {
    this.loop = (d & 0x20) !== 0;
    this.constant = (d & 0x10) !== 0;
    this.period = d & 15;
  }
}

class Length {
  count = 0;
  half(halt: boolean) {
    if (!halt && this.count > 0) this.count--;
  }
}

class Pulse {
  env = new Envelope();
  len = new Length();
  duty = 0;
  step = 0;
  timer = 0;
  period = 0;
  sweepOn = false;
  sweepP = 0;
  negate = false;
  shift = 0;
  divider = 0;
  reload = false;
  constructor(private second: boolean) {}
  target() {
    const change = this.period >> this.shift;
    return this.negate ? this.period - change - (this.second ? 0 : 1) : this.period + change;
  }
  muted() {
    return this.period < 8 || (!this.negate && this.target() > 0x7ff);
  }
  out() {
    const on = (DUTY[this.duty] >> this.step) & 1;
    return on && !this.muted() && this.len.count > 0 ? this.env.volume() : 0;
  }
  sweep() {
    if (this.divider === 0 && this.sweepOn && this.shift > 0 && !this.muted()) {
      this.period = this.target() & 0x7ff;
    }
    if (this.divider === 0 || this.reload) {
      this.divider = this.sweepP;
      this.reload = false;
    } else this.divider--;
  }
  timerTick() {
    if (this.timer === 0) {
      this.timer = this.period;
      this.step = (this.step + 7) & 7;
    } else this.timer--;
  }
  write(reg: number, d: number, enabled: boolean) {
    if (reg === 0) {
      this.duty = d >> 6;
      this.env.reg0(d);
    } else if (reg === 1) {
      this.sweepOn = (d & 0x80) !== 0;
      this.sweepP = (d >> 4) & 7;
      this.negate = (d & 8) !== 0;
      this.shift = d & 7;
      this.reload = true;
    } else if (reg === 2) {
      this.period = (this.period & 0x700) | d;
    } else {
      this.period = (this.period & 0xff) | ((d & 7) << 8);
      this.step = 0;
      this.env.start = true;
      if (enabled) this.len.count = LENGTHS[d >> 3];
    }
  }
}

class Triangle {
  len = new Length();
  control = false;
  reloadValue = 0;
  period = 0;
  timer = 0;
  step = 0;
  linear = 0;
  reload = false;
  out() {
    return this.step < 16 ? 15 - this.step : this.step - 16;
  }
  timerTick() {
    if (this.timer === 0) {
      this.timer = this.period;
      if (this.len.count > 0 && this.linear > 0) this.step = (this.step + 1) & 31;
    } else this.timer--;
  }
  quarter() {
    if (this.reload) this.linear = this.reloadValue;
    else if (this.linear > 0) this.linear--;
    if (!this.control) this.reload = false;
  }
  write(reg: number, d: number, enabled: boolean) {
    if (reg === 0) {
      this.control = (d & 0x80) !== 0;
      this.reloadValue = d & 0x7f;
    } else if (reg === 2) {
      this.period = (this.period & 0x700) | d;
    } else if (reg === 3) {
      this.period = (this.period & 0xff) | ((d & 7) << 8);
      this.reload = true;
      if (enabled) this.len.count = LENGTHS[d >> 3];
    }
  }
}

class Noise {
  env = new Envelope();
  len = new Length();
  mode = false;
  sel = 0;
  timer = 0;
  lfsr = 1;
  out() {
    return (this.lfsr & 1) === 0 && this.len.count > 0 ? this.env.volume() : 0;
  }
  timerTick() {
    if (this.timer === 0) {
      this.timer = NOISE[this.sel] - 1;
      const feedback = (this.lfsr ^ (this.lfsr >> (this.mode ? 6 : 1))) & 1;
      this.lfsr = (this.lfsr >> 1) | (feedback << 14);
    } else this.timer--;
  }
  write(reg: number, d: number, enabled: boolean) {
    if (reg === 0) this.env.reg0(d);
    else if (reg === 2) {
      this.mode = (d & 0x80) !== 0;
      this.sel = d & 15;
    } else if (reg === 3) {
      this.env.start = true;
      if (enabled) this.len.count = LENGTHS[d >> 3];
    }
  }
}

/** One bus access in a cycle: a write, or a read of `addr`. */
export interface Access {
  addr: number;
  data?: number;
}

export class ApuModel {
  p1 = new Pulse(false);
  p2 = new Pulse(true);
  tri = new Triangle();
  noise = new Noise();
  dmc = 0;
  enables = 0;
  cycle = 0;
  five = false;
  inhibit = false;
  flag = false;
  delay = 0;
  force = false;
  wrap = false;
  odd = false;
  private tables = mixerTables();

  private end() {
    return this.five ? 37281 : 29829;
  }
  private quarter() {
    const c = this.cycle;
    return this.force || c === 7457 || c === 14913 || c === 22371 || c === this.end();
  }
  private half() {
    return this.force || this.cycle === 14913 || this.cycle === this.end();
  }

  outputs() {
    const p1 = this.p1.out();
    const p2 = this.p2.out();
    const t = this.tri.out();
    const n = this.noise.out();
    const status =
      (Number(this.flag) << 6) |
      (Number(this.noise.len.count > 0) << 3) |
      (Number(this.tri.len.count > 0) << 2) |
      (Number(this.p2.len.count > 0) << 1) |
      Number(this.p1.len.count > 0);
    const audio = (this.tables.pulse[p1 + p2] + this.tables.tnd[3 * t + 2 * n + this.dmc]) & 0xffff;
    return { p1, p2, t, n, irq: Number(this.flag), status, audio };
  }

  /** The end of a CPU cycle, with `access` the cycle's bus access, if any. */
  clock(access?: Access) {
    // Everything here happens on one clock edge, so each unit acts on the
    // state from before it: the timers on the period before a sweep changes
    // it. A $4015 write is the exception: it clears the disabled channels'
    // length counters on its own edge.
    const quarter = this.quarter();
    const half = this.half();
    const enables = this.enables;
    const units = [this.p1, this.p2, this.tri, this.noise];
    if (this.odd) {
      this.p1.timerTick();
      this.p2.timerTick();
    }
    this.tri.timerTick();
    this.noise.timerTick();
    if (quarter) {
      this.p1.env.quarter();
      this.p2.env.quarter();
      this.noise.env.quarter();
      this.tri.quarter();
    }
    if (half) {
      this.p1.sweep();
      this.p2.sweep();
      this.p1.len.half(this.p1.env.loop);
      this.p2.len.half(this.p2.env.loop);
      this.tri.len.half(this.tri.control);
      this.noise.len.half(this.noise.env.loop);
    }
    this.frameTick(access);
    if (access?.data !== undefined) this.write(access.addr, access.data, enables);
    units.forEach((u, i) => {
      if (!((this.enables >> i) & 1)) u.len.count = 0;
    });
  }

  private frameTick(access?: Access) {
    const end = this.end();
    const wrapped = this.cycle >= end;
    let next = wrapped ? 0 : this.cycle + 1;
    let force = false;
    if (this.delay) {
      this.delay--;
      if (this.delay === 0) {
        next = 0;
        force = this.five;
      }
    }
    const c = this.cycle;
    const set =
      !this.five && !this.inhibit && (c === 29828 || c === 29829 || (c === 0 && this.wrap));
    if (access && access.data === undefined && access.addr === 0x4015) this.flag = false;
    if (set) this.flag = true;
    this.wrap = !this.five && wrapped;
    if (access?.data !== undefined && access.addr === 0x4017) {
      this.five = (access.data & 0x80) !== 0;
      this.inhibit = (access.data & 0x40) !== 0;
      if (this.inhibit) this.flag = false;
      this.delay = this.odd ? 3 : 4;
    }
    this.cycle = next;
    this.force = force;
    this.odd = !this.odd;
  }

  private write(addr: number, d: number, enables: number) {
    const enabled = (i: number) => ((enables >> i) & 1) === 1;
    if (addr < 0x4004) this.p1.write(addr & 3, d, enabled(0));
    else if (addr < 0x4008) this.p2.write(addr & 3, d, enabled(1));
    else if (addr < 0x400c) this.tri.write(addr & 3, d, enabled(2));
    else if (addr < 0x4010) this.noise.write(addr & 3, d, enabled(3));
    else if (addr === 0x4011) this.dmc = d & 0x7f;
    else if (addr === 0x4015) this.enables = d & 15;
  }
}
