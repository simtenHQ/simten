/**
 * Synth Voice — renders a circuit to a .wav file
 *
 * A wavetable voice built entirely from stdlib primitives: a 16-bit phase
 * accumulator drives a 4096-entry wavetable ROM, the sample is centred to
 * two's complement, and a linear-decay envelope scales it. One tick produces
 * one audio sample, because everything between the registers is combinational.
 *
 * Nothing about the sound lives in this file except the wavetable contents and
 * the note list. The signal path is the circuit.
 *
 * Run: pnpm --filter @simten/demos synth-wav
 */

import { writeFileSync } from 'node:fs';
import { bit, bus, circuit } from '@simten/core/circuit';
import { simulate } from '@simten/core/sim';
import {
  Adder,
  BitSlice,
  Comparator,
  Constant,
  Mux,
  Register,
  ROM,
  romFromBytes,
  SignedMultiplier,
  Subtractor,
} from '@simten/core/std';

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 22050; // Nyquist 11.025 kHz — vintage-correct, and cheap
const TABLE_BITS = 12;
const TABLE_SIZE = 1 << TABLE_BITS; // 4096
const HARMONICS = 8; // highest partial stays under Nyquist for every note below
const ENV_FULL = 32767;
const ENV_STEP = 8; // 32767 / 8 ≈ 4096 samples ≈ 186 ms to silence

/**
 * Band-limited sawtooth. Summing 1/k sin(k·θ) up to a fixed harmonic count
 * keeps every partial under Nyquist, which is the difference between "vintage
 * digital" and "aliasing mush" at this sample rate.
 */
function sawTable(size: number, harmonics: number): number[] {
  const raw = Array.from({ length: size }, (_, i) => {
    let v = 0;
    for (let k = 1; k <= harmonics; k++) v += Math.sin((2 * Math.PI * k * i) / size) / k;
    return v;
  });
  const peak = Math.max(...raw.map(Math.abs));
  return raw.map((v) => Math.round(((v / peak) * 0.5 + 0.5) * 255));
}

// ── Circuit ──────────────────────────────────────────────────────────────────

const SynthVoice = circuit('SynthVoice', {
  inputs: { inc: bus(16), trig: bit },
  outputs: { audio: bus(16) },
  nodes: {
    // Phase accumulator: phase += inc every sample, wrapping at 2^16.
    phaseReg: Register({ width: 16 }),
    phaseAdd: Adder({ width: 16 }),
    // Top TABLE_BITS of the phase index the table; the low bits are the
    // fractional part we simply discard (zero-order hold, as the era did).
    tabAddr: BitSlice({ low: 16 - TABLE_BITS, high: 15 }),
    rom: ROM({ memory: romFromBytes(sawTable(TABLE_SIZE, HARMONICS)) }),
    // Table holds 0..255; shift to -128..127 so the envelope scales amplitude
    // rather than modulating a DC offset (which would click on every note).
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
    cStep: Constant({ value: ENV_STEP, width: 16 }),
    cZero16: Constant({ value: 0, width: 16 }),
    cFull: Constant({ value: ENV_FULL, width: 16 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    // Phase accumulator
    n.phaseReg.q.to(n.phaseAdd.a, n.tabAddr.in),
    inputs.inc.to(n.phaseAdd.b),
    n.lo.out.to(n.phaseAdd.carry_in),
    n.phaseAdd.sum.to(n.phaseReg.data),
    n.hi.out.to(n.phaseReg.we),

    // Wavetable lookup and DC centring
    n.tabAddr.out.to(n.rom.addr),
    n.rom.data_out.to(n.dcSub.a),
    n.c128.out.to(n.dcSub.b),
    n.lo.out.to(n.dcSub.borrow_in),

    // Envelope
    n.envReg.q.to(n.envSub.a, n.envCmp.a, n.envTop.in),
    n.cStep.out.to(n.envSub.b, n.envCmp.b),
    n.lo.out.to(n.envSub.borrow_in),
    n.cZero16.out.to(n.envFloor.in0),
    n.envSub.difference.to(n.envFloor.in1),
    n.envCmp.gt.to(n.envFloor.sel),
    n.envFloor.out.to(n.envTrig.in0),
    n.cFull.out.to(n.envTrig.in1),
    inputs.trig.to(n.envTrig.sel),
    n.envTrig.out.to(n.envReg.data),
    n.hi.out.to(n.envReg.we),

    // Amplitude
    n.dcSub.difference.to(n.amp.a),
    n.envTop.out.to(n.amp.b),
    n.amp.product.to(outputs.audio),
  ],
});

// ── Score ────────────────────────────────────────────────────────────────────

/** Phase increment for a frequency: one table pass per cycle at 2^16 wrap. */
const incFor = (hz: number) => Math.round((hz * 65536) / SAMPLE_RATE);

const NOTES: Record<string, number> = {
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
};

/** [note, beats] — a plain minor-pentatonic riff, nothing clever. */
const SCORE: [keyof typeof NOTES, number][] = [
  ['A3', 1],
  ['C4', 1],
  ['E4', 1],
  ['G4', 1],
  ['A4', 1],
  ['G4', 1],
  ['E4', 1],
  ['C4', 1],
  ['D4', 1],
  ['E4', 1],
  ['G4', 1],
  ['A4', 1],
  ['C5', 1],
  ['E5', 2],
  ['A4', 2],
];
const BEAT_SAMPLES = Math.round(SAMPLE_RATE * 0.22);

// ── Render ───────────────────────────────────────────────────────────────────

const sim = simulate(SynthVoice);

const totalSamples = SCORE.reduce((acc, [, beats]) => acc + beats * BEAT_SAMPLES, 0);
const samples = new Int16Array(totalSamples);

const started = performance.now();
let cursor = 0;
for (const [note, beats] of SCORE) {
  const inc = incFor(NOTES[note]);
  const length = beats * BEAT_SAMPLES;
  for (let i = 0; i < length; i++) {
    // trig is high for the first sample of the note only — a one-tick gate.
    sim.set({ inc, trig: i === 0 ? 1 : 0 });
    sim.tick();
    const raw = sim.get('audio');
    // SignedMultiplier encodes negatives as two's complement in 16 bits.
    const signed = raw > 0x7fff ? raw - 0x10000 : raw;
    // Peak magnitude is 128 * 127; scale to full 16-bit range.
    samples[cursor++] = Math.max(-32768, Math.min(32767, Math.round((signed / 16256) * 30000)));
  }
}
const elapsed = (performance.now() - started) / 1000;

// ── WAV ──────────────────────────────────────────────────────────────────────

function wav16Mono(pcm: Int16Array, rate: number): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const out = new URL('../out/synth.wav', import.meta.url).pathname;
writeFileSync(out, wav16Mono(samples, SAMPLE_RATE));

const audioSeconds = totalSamples / SAMPLE_RATE;
console.log(`
  wrote      ${out}
  circuit    ${TABLE_SIZE}-entry wavetable, one tick per sample
  audio      ${audioSeconds.toFixed(2)}s @ ${SAMPLE_RATE} Hz (${totalSamples} samples, 1 tick each)
  render     ${elapsed.toFixed(2)}s  →  ${(audioSeconds / elapsed).toFixed(1)}x realtime
  throughput ${(totalSamples / elapsed / 1000).toFixed(0)}k ticks/s
`);
