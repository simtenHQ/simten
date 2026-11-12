/** The page: picks a ROM, draws frames from the worker, sends the keys. */

import { PALETTE_2C02 } from '@simten/core/std';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const stats = document.getElementById('stats') as HTMLDivElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const image = ctx.createImageData(256, 240);
const rgba = new Uint32Array(image.data.buffer);
// ImageData is RGBA in memory: on little-endian that is 0xAABBGGRR.
const palette = (PALETTE_2C02 as readonly number[]).map(
  (c) => (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0,
);

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

// Sound: the worker sends the APU's samples each frame; a worklet plays them
// from a ring buffer, and counts the samples it had to fill with silence
// because the simulation fell behind.
const PLAYER = `
class Player extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(65536);
    this.r = 0;
    this.w = 0;
    this.short = 0;
    this.played = 0;
    // Wait for ~35 ms of sound before playing, and again after running dry,
    // so a late frame is a short pause, not crackle.
    this.filling = true;
    this.port.onmessage = (e) => {
      for (const v of e.data) { this.buf[this.w] = v; this.w = (this.w + 1) & 65535; }
      // A safety net: the worker holds the queue near 40 ms, but if it
      // somehow passes ~200 ms, skip back rather than lag the game.
      if (((this.w - this.r) & 65535) > 8820) this.r = (this.w - 1764) & 65535;
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    const queued = (this.w - this.r) & 65535;
    if (this.filling && queued >= 1536) this.filling = false;
    for (let i = 0; i < out.length; i++) {
      if (this.filling || this.r === this.w) { out[i] = 0; this.short++; this.filling = true; }
      else { out[i] = this.buf[this.r]; this.r = (this.r + 1) & 65535; }
    }
    this.played += out.length;
    this.since = (this.since || 0) + out.length;
    if (this.since >= sampleRate / 20) {
      this.since = 0;
      this.port.postMessage({ queued: (this.w - this.r) & 65535 });
    }
    if (this.played >= sampleRate) {
      this.port.postMessage({ gap: this.short / this.played, queued: (this.w - this.r) & 65535 });
      this.short = 0;
      this.played = 0;
    }
    return true;
  }
}
registerProcessor('player', Player);
`;
let audio: { ctx: AudioContext; node: AudioWorkletNode } | undefined;
let gap = 0;
let queuedMs = 0;
async function startAudio() {
  if (audio) return audio.ctx.resume();
  const ctx = new AudioContext({ sampleRate: 44100 });
  await ctx.audioWorklet.addModule(
    URL.createObjectURL(new Blob([PLAYER], { type: 'text/javascript' })),
  );
  const node = new AudioWorkletNode(ctx, 'player');
  node.port.onmessage = (e) => {
    if (e.data.gap !== undefined) gap = e.data.gap as number;
    queuedMs = ((e.data.queued as number) / 44100) * 1000;
    worker.postMessage({ type: 'queue', ms: queuedMs });
  };
  node.connect(ctx.destination);
  audio = { ctx, node };
}
// The APU's output sits well above 0 (the triangle idles at 15): a gentle
// high-pass takes the offset out, as the console's output stage does.
let prevIn = 0;
let prevOut = 0;
function play(samples: Uint16Array) {
  if (!audio) return;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i] / 65000;
    prevOut = 0.996 * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut * 0.9;
  }
  audio.node.port.postMessage(out, [out.buffer]);
}

// Frames are drawn on the display's refresh, newest first, so movement
// doesn't hitch when the NES's 60.1 Hz and the screen's rate beat.
let latest: Uint8Array | undefined;
function draw() {
  if (latest) {
    const px = latest;
    latest = undefined;
    for (let i = 0; i < px.length; i++) rgba[i] = palette[px[i] & 63];
    ctx.putImageData(image, 0, 0);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'frame') {
    latest = msg.pixels as Uint8Array;
  } else if (msg.type === 'audio') {
    play(msg.samples as Uint16Array);
  } else if (msg.type === 'stats') {
    stats.textContent = `${msg.text} · audio gaps ${(gap * 100).toFixed(0)}% · sound ${queuedMs.toFixed(0)} ms behind`;
  } else if (msg.type === 'error') {
    stats.textContent = `Error: ${msg.text}`;
  }
};

(document.getElementById('rom') as HTMLInputElement).onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await startAudio();
  const bytes = await file.arrayBuffer();
  worker.postMessage({ type: 'rom', bytes }, [bytes]);
  (e.target as HTMLInputElement).blur();
};

// Pad bits: A, B, Select, Start, Up, Down, Left, Right.
const KEYS: Record<string, number> = {
  KeyX: 0x01,
  Space: 0x01,
  KeyZ: 0x02,
  ShiftLeft: 0x04,
  ShiftRight: 0x04,
  Enter: 0x08,
  ArrowUp: 0x10,
  ArrowDown: 0x20,
  ArrowLeft: 0x40,
  ArrowRight: 0x80,
};
let pad = 0;
const key = (down: boolean) => (e: KeyboardEvent) => {
  audio?.ctx.resume();
  const bit = KEYS[e.code];
  if (bit === undefined) return;
  e.preventDefault();
  pad = down ? pad | bit : pad & ~bit;
  worker.postMessage({ type: 'pad', value: pad });
};
addEventListener('keydown', key(true));
addEventListener('keyup', key(false));
