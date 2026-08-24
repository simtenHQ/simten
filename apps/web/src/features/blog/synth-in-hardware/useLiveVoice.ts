/**
 * Plays the synth voice, simulated in the sandbox like every other circuit on
 * the site.
 *
 * The audio and the canvas are fed from the same ticks of the same circuit, so
 * what you watch is what you hear rather than two simulations that agree.
 *
 * `renderSamples` is what makes that possible over the sandbox boundary:
 * `tickN` reports only where the circuit ended up, and a second of sound is
 * 22,050 intermediate values. One `tick` call per sample would be that many
 * round trips a second.
 *
 * The AudioContext has to live here — workers and iframes have no Web Audio —
 * so this asks for chunks and schedules each against `AudioContext.currentTime`
 * rather than a wall-clock timer. Keeping `LEAD_SECONDS` queued means a late
 * frame (GC, a React render, layout) costs nothing.
 */

import type { useCircuitSimulator } from '@simten/embed';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BEAT_SAMPLES, incFor, SAMPLE_RATE, SCORE } from './circuits';

/** Peak magnitude out of the multiplier is 128 * 127. */
const FULL_SCALE = 16256;
/** How far ahead of the playhead to stay queued. */
const LEAD_SECONDS = 0.2;
/** Requested chunk — kept under a note's length so inputs are constant for it. */
const CHUNK_SAMPLES = 1024;
const SCOPE_SAMPLES = 1024;

type Simulator = ReturnType<typeof useCircuitSimulator>;

export interface VoiceControls {
  /** Index into WAVES — the ROM bank the phase is read from. */
  wave: number;
  /** Subtracted from the envelope each tick; bigger decays faster. */
  decay: number;
}

export function useLiveVoice(sim: Simulator, controls: VoiceControls) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);
  /** requestAnimationFrame handle for the pump. rAF rather than a timer
   *  because it does not fire in a hidden tab — the page stops working when
   *  nobody is looking at it, with no event to miss and nothing to poll. */
  const pumpRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const busyRef = useRef(false);
  /** Position in the score, kept across chunks so notes span request boundaries. */
  const posRef = useRef({ note: 0, sample: 0 });

  const [playing, setPlaying] = useState(false);
  const [scope, setScope] = useState<Float32Array<ArrayBuffer>>(new Float32Array(SCOPE_SAMPLES));

  // Controls are plain inputs, so nothing here reacts to them changing — the
  // next render request simply carries the new values. No rebuild, no ROM
  // flash, no gap. A ref keeps the pump reading current values without
  // restarting it on every slider move.
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  /** Ask for the next run of samples, never crossing a note boundary. */
  const nextRun = useCallback(async (): Promise<number[]> => {
    const pos = posRef.current;
    const note = SCORE[pos.note];
    const remaining = note.beats * BEAT_SAMPLES - pos.sample;

    // trig is high for the first sample of a note only — a one-tick gate, so it
    // gets a run of its own.
    const count = pos.sample === 0 ? 1 : Math.min(CHUNK_SAMPLES, remaining);
    const raw = await sim.renderSamples('audio', count, {
      inc: incFor(note.hz),
      trig: pos.sample === 0 ? 1 : 0,
      wave: controlsRef.current.wave,
      decay: controlsRef.current.decay,
    });

    pos.sample += count;
    if (pos.sample >= note.beats * BEAT_SAMPLES) {
      pos.sample = 0;
      pos.note = (pos.note + 1) % SCORE.length;
    }
    return raw;
  }, [sim.renderSamples]);

  const stop = useCallback(() => {
    playingRef.current = false;
    if (pumpRef.current !== null) cancelAnimationFrame(pumpRef.current);
    pumpRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    // Cancel any existing pump first. Overwriting `pumpRef` would orphan the
    // old loop, which then reschedules itself forever with nothing holding a
    // handle to it — two pumps racing on one score position, unstoppable.
    if (pumpRef.current !== null) cancelAnimationFrame(pumpRef.current);
    pumpRef.current = null;

    const ctx = (ctxRef.current ??= new AudioContext({ sampleRate: SAMPLE_RATE }));
    void ctx.resume();
    nextStartRef.current = ctx.currentTime + 0.08;
    playingRef.current = true;

    const pump = async () => {
      // One request in flight at a time: the sandbox serialises them anyway, and
      // overlapping them would interleave the score position.
      if (busyRef.current || !playingRef.current) return;
      busyRef.current = true;
      try {
        while (playingRef.current && nextStartRef.current - ctx.currentTime < LEAD_SECONDS) {
          const raw = await nextRun();
          if (!raw.length || !playingRef.current) break;

          const samples: Float32Array<ArrayBuffer> = new Float32Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            // SignedMultiplier encodes negatives as two's complement in 16 bits.
            const v = raw[i] > 0x7fff ? raw[i] - 0x10000 : raw[i];
            samples[i] = Math.max(-1, Math.min(1, v / FULL_SCALE));
          }

          // Never schedule in the past: if the tab was backgrounded the playhead
          // will have run past us, and start() would fire the backlog at once.
          const now = ctx.currentTime;
          if (nextStartRef.current < now) nextStartRef.current = now + 0.02;

          const buf = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
          buf.copyToChannel(samples, 0);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(nextStartRef.current);
          nextStartRef.current += samples.length / SAMPLE_RATE;

          if (samples.length > 64) {
            const next: Float32Array<ArrayBuffer> = new Float32Array(SCOPE_SAMPLES);
            const take = Math.min(SCOPE_SAMPLES, samples.length);
            next.set(samples.subarray(samples.length - take), SCOPE_SAMPLES - take);
            setScope(next);
          }
        }
      } finally {
        busyRef.current = false;
      }
    };

    // Driven by rAF, which the browser simply does not call while the tab is
    // hidden or the window is covered. Playback starves and resumes on its own,
    // so a reader who scrolled away is not still simulating 22,050 ticks a
    // second. `visibilitychange` would be the obvious alternative, but it is a
    // notification that can be missed; this is the absence of work itself.
    const frame = () => {
      pumpRef.current = requestAnimationFrame(frame);
      void pump();
    };
    pumpRef.current = requestAnimationFrame(frame);
    setPlaying(true);
  }, [nextRun]);

  const toggle = useCallback(() => {
    if (playingRef.current) stop();
    else play();
  }, [play, stop]);

  useEffect(() => {
    return () => {
      if (pumpRef.current !== null) cancelAnimationFrame(pumpRef.current);
      void ctxRef.current?.close();
    };
  }, []);

  return { playing, toggle, stop, scope };
}
