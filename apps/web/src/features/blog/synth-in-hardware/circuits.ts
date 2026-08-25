/**
 * Circuit definitions for the "Synth in Hardware" blog post.
 *
 * One wavetable voice: a 16-bit phase accumulator addresses a wavetable ROM,
 * the sample is recentred to two's complement, and a linear-decay envelope
 * scales it. One clock tick produces one audio sample, because everything
 * between the registers is combinational.
 *
 * Everything a listener can change is an **input port**, not a `Constant`.
 * That matters beyond tidiness: a `Constant` is hardwired once this is
 * synthesised, so a knob built on one exists only in the simulator and vanishes
 * on the way to an FPGA. As ports they are real signals, identical in the
 * browser, under Verilator, and on the board. Changing one costs nothing,
 * since inputs are already passed with every render request.
 *
 * That includes the waveform. All four tables live in one ROM, addressed by
 * concatenating a 2-bit selector onto the phase, so switching timbre is setting
 * a signal rather than a host-side trick to swap memory contents.
 *
 * `BitSlice` rather than `Slice` throughout: `Slice` has no entry in the Verilog
 * primitive map, so a design using it exports with a warning comment where the
 * logic should be. This voice is meant to reach an FPGA unchanged.
 */

import { bit, bus, circuit } from '@simten/core/circuit';
import {
  Adder,
  BitSlice,
  Comparator,
  Constant,
  LeftShifter,
  Mux,
  Register,
  ROM,
  romFromBytes,
  SignedMultiplier,
  Subtractor,
} from '@simten/core/std';

export const SAMPLE_RATE = 22050;
export const TABLE_BITS = 12;
export const TABLE_SIZE = 1 << TABLE_BITS;

/** Envelope full-scale. The decay step is an input, so its rate is a knob. */
const ENV_FULL = 32767;
export const DEFAULT_ENV_STEP = 8;

/**
 * Band-limited wave: summing `1/k · sin(k·θ)` over a fixed harmonic count keeps
 * every partial under Nyquist. That is the difference between "vintage digital"
 * and aliasing mush at 22 kHz: a naive sawtooth folds its upper harmonics back
 * down as inharmonic clangour.
 *
 * `oddOnly` gives a square/hollow character (odd harmonics only), matching how
 * a square wave decomposes.
 */
function bandLimited(harmonics: number, oddOnly = false): number[] {
  const raw = Array.from({ length: TABLE_SIZE }, (_, i) => {
    let v = 0;
    for (let k = 1; k <= harmonics; k++) {
      if (oddOnly && k % 2 === 0) continue;
      v += Math.sin((2 * Math.PI * k * i) / TABLE_SIZE) / k;
    }
    return v;
  });
  const peak = Math.max(...raw.map(Math.abs));
  return raw.map((v) => Math.round(((v / peak) * 0.5 + 0.5) * 255));
}

/** Order matters: the index is what the `wave` input selects. */
export const WAVES = ['sine', 'triangle', 'square', 'saw'] as const;
export type WaveName = (typeof WAVES)[number];

const GENERATORS: Record<WaveName, () => number[]> = {
  sine: () => bandLimited(1),
  triangle: () => bandLimited(7, true),
  square: () => bandLimited(15, true),
  saw: () => bandLimited(8),
};

/** All four tables end to end, so `wave` picks a bank by high address bits. */
function waveBank(): number[] {
  return WAVES.flatMap((name) => GENERATORS[name]());
}

/** Phase increment for a frequency; the accumulator wraps once per cycle. */
export const incFor = (hz: number) => Math.round((hz * 65536) / SAMPLE_RATE);

export function buildVoice() {
  return circuit('SynthVoice', {
    inputs: {
      /** Pitch: phase advances by this much per sample. */
      inc: bus(16),
      /** One tick high restarts the envelope. */
      trig: bit,
      /** Which of the four tables to read: the bank's high address bits. */
      wave: bus(2),
      /** Subtracted from the envelope each tick, so bigger decays faster. */
      decay: bus(16),
    },
    outputs: { audio: bus(16) },
    nodes: {
      // Phase accumulator: phase += inc every sample, wrapping at 2^16.
      phaseReg: Register({ width: 16 }),
      phaseAdd: Adder({ width: 16 }),
      // Top TABLE_BITS of the phase index within a table; the low bits are the
      // fractional part, discarded (zero-order hold, as the era did it).
      tabAddr: BitSlice({ low: 16 - TABLE_BITS, high: 15 }),
      // addr = (wave << 12) | phase[15:4], so the selector picks the bank.
      bankShift: LeftShifter({ width: 16 }),
      bankAdd: Adder({ width: 16 }),
      rom: ROM({ memory: romFromBytes(waveBank()) }),
      // Tables hold 0..255; shift to -128..127 so the envelope scales amplitude
      // rather than modulating a DC offset, which would click on every note.
      dcSub: Subtractor({ width: 8 }),

      // Envelope: linear decay, clamped at zero, reset to full on trig.
      envReg: Register({ width: 16 }),
      envSub: Subtractor({ width: 16 }),
      envCmp: Comparator({ width: 16 }),
      envFloor: Mux({ width: 16 }),
      envTrig: Mux({ width: 16 }),
      envTop: BitSlice({ low: 8, high: 15 }), // 0..127, positive as signed

      amp: SignedMultiplier,

      hi: Constant({ value: 1 }),
      lo: Constant({ value: 0 }),
      c128: Constant({ value: 128, width: 8 }),
      cTableBits: Constant({ value: TABLE_BITS, width: 16 }),
      cZero16: Constant({ value: 0, width: 16 }),
      cFull: Constant({ value: ENV_FULL, width: 16 }),
    },
    connect: ({ inputs, outputs, nodes: n }) => [
      n.phaseReg.q.to(n.phaseAdd.a, n.tabAddr.in),
      inputs.inc.to(n.phaseAdd.b),
      n.lo.out.to(n.phaseAdd.carry_in),
      n.phaseAdd.sum.to(n.phaseReg.data),
      n.hi.out.to(n.phaseReg.we),

      // Bank select: shift the wave index up past the table, then add the phase.
      inputs.wave.to(n.bankShift.value),
      n.cTableBits.out.to(n.bankShift.shift),
      n.bankShift.result.to(n.bankAdd.a),
      n.tabAddr.out.to(n.bankAdd.b),
      n.lo.out.to(n.bankAdd.carry_in),
      n.bankAdd.sum.to(n.rom.addr),

      n.rom.data_out.to(n.dcSub.a),
      n.c128.out.to(n.dcSub.b),
      n.lo.out.to(n.dcSub.borrow_in),

      n.envReg.q.to(n.envSub.a, n.envCmp.a, n.envTop.in),
      inputs.decay.to(n.envSub.b, n.envCmp.b),
      n.lo.out.to(n.envSub.borrow_in),
      n.cZero16.out.to(n.envFloor.in0),
      n.envSub.difference.to(n.envFloor.in1),
      n.envCmp.gt.to(n.envFloor.sel),
      n.envFloor.out.to(n.envTrig.in0),
      n.cFull.out.to(n.envTrig.in1),
      inputs.trig.to(n.envTrig.sel),
      n.envTrig.out.to(n.envReg.data),
      n.hi.out.to(n.envReg.we),

      n.dcSub.difference.to(n.amp.a),
      n.envTop.out.to(n.amp.b),
      n.amp.product.to(outputs.audio),
    ],
  });
}

const NOTES = {
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
} as const;

/** A minor-pentatonic run, up and back down. */
export const SCORE: { hz: number; beats: number }[] = [
  { hz: NOTES.A3, beats: 1 },
  { hz: NOTES.C4, beats: 1 },
  { hz: NOTES.E4, beats: 1 },
  { hz: NOTES.G4, beats: 1 },
  { hz: NOTES.A4, beats: 1 },
  { hz: NOTES.G4, beats: 1 },
  { hz: NOTES.E4, beats: 1 },
  { hz: NOTES.C4, beats: 1 },
  { hz: NOTES.D4, beats: 1 },
  { hz: NOTES.E4, beats: 1 },
  { hz: NOTES.G4, beats: 1 },
  { hz: NOTES.A4, beats: 1 },
  { hz: NOTES.C5, beats: 1 },
  { hz: NOTES.E5, beats: 2 },
  { hz: NOTES.A4, beats: 2 },
];

export const BEAT_SAMPLES = Math.round(SAMPLE_RATE * 0.22);
