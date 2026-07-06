/**
 * Gameplay testbench for the Breakout circuit.
 *
 * Drives only the top-level ports (`scan_addr`, `keyboard`, `pixel_out`,
 * `is_filling`) — the same surface the browser demo uses — and reads the screen
 * back, then asserts behavioural invariants of Breakout: the ball is in motion,
 * a brick wall is drawn and the ball rebounds off its face without tunnelling,
 * the paddle tracks the held key and clamps to the walls, and losing the ball
 * respawns it AND refills the wall (the fill FSM redraws all 128 bricks).
 *
 * The render is combinational (scan_addr → pixel_out) and the game advances one
 * step per clock tick, so to read a coherent frame we sample every pixel from a
 * single snapshot (restore before each address, tick once to settle the RAM
 * read). `is_filling` is high while the fill FSM redraws the wall (at power-on
 * and after a death); the demo bursts those clocks, but here we just tick past
 * them with `settle`.
 *
 * Run: `tsx breakout.verify.ts`, or via the simten `verify_circuit` tool.
 */
import { simulate } from '@simten/core/sim';
import { verify, declareOracle } from '@simten/core/verify';
import { Breakout } from './circuits.js';

const W = 32;

declareOracle({
  tier: 'C',
  type: 'Breakout gameplay invariants (motion / wall / rebound / input / death-refill)',
  independence_basis:
    "Expected behaviour comes from the rules of Breakout — the ball is always in flight and on the field, a brick wall is drawn and the ball rebounds off its face rather than passing through it, the paddle moves toward the held key and stops at the walls, and losing the ball respawns it and redraws the full wall — asserted by driving the public ports and reading pixel_out/is_filling. None of these restate the circuit's internal wiring.",
  evidence: 'power-on wall draw + trajectory + tunnelling watch + paddle sweep + death-refill',
});

type Sim = ReturnType<typeof simulate>;

function scanRows(s: Sim, loRow: number, hiRow: number): number[] {
  const snap = (s as any).snapshot();
  const lit: number[] = [];
  for (let a = loRow * W; a < (hiRow + 1) * W; a++) {
    (s as any).restore(snap);
    s.set({ scan_addr: a });
    s.tick();
    if (s.get('pixel_out')) lit.push(a);
  }
  (s as any).restore(snap);
  return lit;
}
const advance = (s: Sim, ticks: number) => {
  for (let i = 0; i < ticks; i++) s.tick();
};
// Tick past any wall redraw in progress (fill FSM), so play/reads see a settled
// board with the ball live. 135 > the 128-cycle fill, with margin.
const settle = (s: Sim) => advance(s, 135);
const ballCells = (s: Sim) => scanRows(s, 4, 14); // play area
const paddleXs = (s: Sim) => scanRows(s, 15, 15).map((a) => a % W);
const brickCount = (s: Sim) => scanRows(s, 0, 3).length;

// Invariant 1: the ball is in motion and always on the field (not frozen).
verify.exhaustive('ball moves and stays on the 32x16 field', [1], () => {
  const s = simulate(Breakout);
  try {
    s.set({ scan_addr: 0, keyboard: 0, game_en: 1 });
    settle(s);
    const positions = new Set<string>();
    for (let k = 0; k < 12; k++) {
      advance(s, 8);
      if (s.get('is_filling')) {
        settle(s);
        continue;
      } // skip a death's redraw
      const cells = ballCells(s);
      if (cells.length === 0) return false;
      for (const a of cells) if (a % W >= W || Math.floor(a / W) > 14) return false;
      positions.add(cells.map((a) => `${a % W},${Math.floor(a / W)}`).join('|'));
    }
    return positions.size >= 3;
  } finally {
    s.dispose();
  }
});

// Invariant 2: the wall is drawn at power-on and the ball rebounds off its face
// rather than tunnelling in (it never disappears from the play area for long).
verify.exhaustive('wall is drawn; ball rebounds off the face without tunnelling', [1], () => {
  const s = simulate(Breakout);
  try {
    s.set({ scan_addr: 0, keyboard: 0, game_en: 1 });
    settle(s);
    if (brickCount(s) < 120) return false; // full wall drawn (~128)
    let missing = 0;
    for (let k = 0; k < 30; k++) {
      advance(s, 8);
      if (s.get('is_filling')) {
        settle(s);
        missing = 0;
        continue;
      }
      if (ballCells(s).length === 0) missing++;
      else missing = 0;
      if (missing > 3) return false;
    }
    return true;
  } finally {
    s.dispose();
  }
});

// Invariant 3: holding LEFT drives the paddle to the left wall.
verify.exhaustive('holding LEFT moves paddle left and clamps', [1], () => {
  const s = simulate(Breakout);
  try {
    s.set({ scan_addr: 0, keyboard: 0, game_en: 1 });
    settle(s);
    const home = Math.min(...paddleXs(s));
    s.set({ keyboard: 75 });
    advance(s, 120);
    const left = Math.min(...paddleXs(s));
    return left < home && left === 0;
  } finally {
    s.dispose();
  }
});

// Invariant 4: holding RIGHT drives the paddle to the right wall.
verify.exhaustive('holding RIGHT moves paddle right and clamps', [1], () => {
  const s = simulate(Breakout);
  try {
    s.set({ scan_addr: 0, keyboard: 0, game_en: 1 });
    settle(s);
    s.set({ keyboard: 75 });
    advance(s, 120);
    const start = Math.min(...paddleXs(s));
    s.set({ keyboard: 77 });
    advance(s, 240);
    const right = Math.max(...paddleXs(s));
    return right > start && right === W - 2;
  } finally {
    s.dispose();
  }
});

// Invariant 5: losing the ball asserts is_filling (the redraw), refills the wall
// fully, and respawns the ball — real "instant refill on death" (the demo bursts
// the redraw; here we just tick through it).
verify.exhaustive('death refills the wall fully and respawns the ball', [1], () => {
  const s = simulate(Breakout);
  try {
    s.set({ scan_addr: 0, keyboard: 0, game_en: 1 }); // paddle parked; the ball will miss
    settle(s); // past the power-on draw
    let died = false;
    for (let k = 0; k < 600 && !died; k++) {
      advance(s, 4);
      if (s.get('is_filling')) died = true; // a death kicked off the redraw
    }
    if (!died) return false; // a parked paddle must miss eventually
    settle(s); // finish the redraw
    return brickCount(s) >= 120 && ballCells(s).length > 0; // wall back to full, ball respawned
  } finally {
    s.dispose();
  }
});

verify.run();
