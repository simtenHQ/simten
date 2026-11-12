/**
 * Runs the compiled NES. Each round runs one frame of ticks, stopping at the
 * start of vblank so the frame sent is whole. Rounds are paced to 60.1 a
 * second against the clock, steered by the page's sound queue so the sound's
 * delay stays constant.
 */

import { type CxxrtlManifest, type CxxrtlSim, loadCxxrtl } from '@simten/core/verilog';

const NES_HZ = 5_369_318; // PPU dots per second (NTSC)
const FRAME_MS = 1000 / 60.0988;

/** How much sound to keep queued: enough to ride out a late frame. */
const TARGET_MS = 40;
/** The sound queue, as the page last reported it. */
let queuedMs = TARGET_MS;

/** Controller 1: the buttons held now, and those pressed since the last frame. */
let held = 0;
let tapped = 0;

let sim: CxxrtlSim | undefined;
let generation = 0;

async function start(bytes: ArrayBuffer) {
  const rom = new Uint8Array(bytes);
  if (rom[0] !== 0x4e || rom[1] !== 0x45 || rom[2] !== 0x53 || rom[3] !== 0x1a) {
    throw new Error('not an iNES file');
  }
  const prg = rom[4] * 0x4000;
  const chr = rom[5] * 0x2000;
  const mapper = (rom[6] >> 4) | (rom[7] & 0xf0);
  if (mapper !== 0) throw new Error(`mapper ${mapper}: only NROM (mapper 0) runs on this board`);
  if ((prg !== 0x4000 && prg !== 0x8000) || chr !== 0x2000) {
    throw new Error(`NROM with ${prg / 1024} KB PRG and ${chr / 1024} KB CHR isn't supported`);
  }
  const offset = 16 + (rom[6] & 0x04 ? 512 : 0);
  const name = `nes-${prg / 1024}k-${rom[6] & 1 ? 'v' : 'h'}`;
  const [wasm, manifest] = await Promise.all([
    fetch(`./${name}.wasm`).then((r) => r.arrayBuffer()),
    fetch(`./${name}.json`).then((r) => r.json() as Promise<CxxrtlManifest>),
  ]);
  sim = await loadCxxrtl(wasm, manifest);
  sim.writeMemory('cart_prg', rom.subarray(offset, offset + prg));
  sim.writeMemory('cart_chr', rom.subarray(offset + prg, offset + prg + chr));
  const mine = ++generation;
  run(mine, sim);
}

/** Run `f` after other messages, without a timer's 4 ms clamp. */
function yieldThen(f: () => void) {
  const ch = new MessageChannel();
  ch.port1.onmessage = f;
  ch.port2.postMessage(null);
}

function run(mine: number, s: CxxrtlSim) {
  let frames = 0;
  let ticks = 0;
  let busy = 0;
  let since = performance.now();
  let due = since;

  const sendAudio = () => {
    const samples = s.audio() as Uint16Array;
    postMessage({ type: 'audio', samples }, { transfer: [samples.buffer] });
  };

  const round = () => {
    if (mine !== generation) return;
    // The buttons for this frame: those held, and any pressed since the last
    // frame even if already let go, so a quick tap is never lost when its
    // press and release arrive together between frames.
    s.set({ pad1: held | tapped });
    tapped = 0;
    const t0 = performance.now();
    // Most of a frame in four pieces, sending the sound after each so it
    // reaches the speakers in ~4 ms steps; then dot by dot to vblank.
    for (let q = 0; q < 4; q++) {
      s.tick(22_000);
      sendAudio();
    }
    let n = 88_000;
    while (s.get('video_y') !== 240) {
      s.tick(1);
      n++;
    }
    while (s.get('video_y') === 240) {
      s.tick(1);
      n++;
    }
    const pixels = (s.video() as Uint8Array).slice();
    const spent = performance.now() - t0;
    postMessage({ type: 'frame', pixels }, { transfer: [pixels.buffer] });
    sendAudio();

    frames++;
    ticks += n;
    busy += spent;
    const now = performance.now();
    if (now - since >= 1000) {
      const speed = ticks / (busy / 1000) / NES_HZ;
      const dots = ((ticks / busy) * 1000) / 1e6;
      postMessage({
        type: 'stats',
        text: `${(frames / ((now - since) / 1000)).toFixed(1)} fps shown · simulation runs at ${(speed * 100).toFixed(0)}% of a real NES (${dots.toFixed(2)}M dots/s)`,
      });
      frames = 0;
      ticks = 0;
      busy = 0;
      since = now;
    }

    // Each frame is due a frame after the last one was due, so a late timer
    // doesn't slow the game. The speakers' clock steers it: up to 3% faster
    // or slower, to hold the sound queue near its target. Far behind (a
    // hidden tab), start over.
    const error = (queuedMs - TARGET_MS) / TARGET_MS;
    due += FRAME_MS * Math.min(1.03, Math.max(0.97, 1 + 0.03 * error));
    if (now - due > 250) due = now;
    // More than 4 ms early, sleep (browsers clamp shorter timeouts up to
    // 4 ms); otherwise yield and look again. Always yield before the next
    // frame, so the page's messages (the buttons) get in between frames.
    const wait = () => {
      if (mine !== generation) return;
      const left = due - performance.now();
      if (left > 4) setTimeout(wait, left - 4);
      else if (left > 0) yieldThen(wait);
      else yieldThen(round);
    };
    wait();
  };
  round();
}

addEventListener('message', (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'rom') {
    start(msg.bytes).catch((err: Error) => postMessage({ type: 'error', text: err.message }));
  } else if (msg.type === 'queue') {
    queuedMs = msg.ms;
  } else if (msg.type === 'pad') {
    held = msg.value;
    tapped |= msg.value;
    sim?.set({ pad1: held | tapped });
  }
});
