/**
 * The 2A03's APU: two pulse channels, triangle, noise, the DMC's output level,
 * the frame counter, $4015 and the mixer. Written from the NESdev wiki's
 * description of the hardware (#612).
 *
 * The CPU bus comes in as `cs` (high on CPU cycles that access the APU:
 * $4000-$4013, $4015, and $4017 writes), `rw`, `addr` (A0-A4) and `data`.
 * Reads return $4015 on `data_out`. `irq` is the frame IRQ. `audio` is the
 * mixed output as an unsigned 16-bit sample, one per CPU cycle. `p1`, `p2`,
 * `t` and `n` are the channels' 4-bit outputs before mixing.
 *
 * DMC sample playback (and its IRQ and DMA) is not built yet: $4011 sets its
 * output level and that is all.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant } from '@simten/core/std';
import { ApuFrame } from './frame.js';
import { ApuMixer } from './mixer.js';
import { ApuNoise } from './noise.js';
import { ApuPulse } from './pulse.js';
import { ApuTriangle } from './triangle.js';
import { ApuDmc, ApuStatus } from './units.js';

export const Apu = circuit('Apu', {
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
