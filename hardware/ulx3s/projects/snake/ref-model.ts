/**
 * Plain-JS reference model of the Snake game rules.
 *
 * Tier-B oracle for gameplay.verify.ts: sequential statements over arrays and
 * a circular buffer — no muxes, adders, or phase pipeline. It restates the
 * game rules, not the netlist dataflow.
 *
 * One step() is one game tick, which the circuit spreads over 4 clock cycles
 * (phases 0–3). The model keeps the circuit's observable quirks because they
 * ARE the spec:
 *  - the tail clear is deferred by one tick after eating (the food-draw tick
 *    skips the tail latch, so the previously latched address is cleared then)
 *  - food respawns deterministically at (x+3, y+5) mod 8
 *  - walls wrap (coordinates are masked to 3 bits)
 *  - the 2-bit direction can't encode "stopped", so the snake always moves
 *  - no self-collision: crossing your own body just overdraws pixels, and a
 *    later tail pass can punch a hole through a live segment
 */

export const GRID = 8;
export const FB_SIZE = GRID * GRID;

/** dir encoding: 0=up 1=right 2=down 3=left (y grows downward). */
const DELTAS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class SnakeRefModel {
  /** 8×8 framebuffer, addr = y*8 + x, values 0/1 — compared against pixel_out. */
  fb = new Uint8Array(FB_SIZE);
  /** Circular body buffer of pixel addresses (the RAM's 64..127 region). */
  body = new Uint8Array(64);
  headPtr = 3;
  tailPtr = 0;
  len = 4;
  headX = 4;
  headY = 4;
  foodX = 6;
  foodY = 3;
  /** foodNeedsDrawing register: food is drawn one tick after it (re)spawns. */
  foodPending = true;
  /** tailPixelAddr register: tail address latched in phase 0, cleared in phase 1. */
  tailPixelLatch = 33;
  /** Number of foods eaten (model-side bookkeeping, not circuit state). */
  eaten = 0;

  constructor() {
    // Initial snake: row y=4, x=1..4, head at (4,4).
    this.body.set([33, 34, 35, 36], 0);
    for (const a of [33, 34, 35, 36]) this.fb[a] = 1;
  }

  step(dirInput: number): void {
    const dir = dirInput & 3;

    // Phase 0: draw a pending food (which skips the tail latch) or latch the
    // tail address for this tick's clear.
    if (this.foodPending) {
      this.fb[this.foodY * GRID + this.foodX] = 1;
      this.foodPending = false;
    } else if (this.len !== 0) {
      this.tailPixelLatch = this.body[this.tailPtr];
    }

    const [dx, dy] = DELTAS[dir];
    const nx = (this.headX + dx) & (GRID - 1);
    const ny = (this.headY + dy) & (GRID - 1);
    const headAddr = ny * GRID + nx;
    const willEat = nx === this.foodX && ny === this.foodY;
    const moveTail = !willEat && this.len !== 0;

    // Phase 1: clear the latched tail pixel (skipped on the eat tick — that's
    // how the snake grows).
    if (moveTail) this.fb[this.tailPixelLatch] = 0;

    // Phase 2: push the new head address into the circular body buffer.
    this.body[(this.headPtr + 1) & 63] = headAddr;

    // Phase 3: draw the head and commit registers.
    this.fb[headAddr] = 1;
    this.headX = nx;
    this.headY = ny;
    this.headPtr = (this.headPtr + 1) & 63;
    if (moveTail) this.tailPtr = (this.tailPtr + 1) & 63;
    else this.len = (this.len + 1) & 0xff;
    if (willEat) {
      this.eaten++;
      this.foodPending = true;
      this.foodX = (this.foodX + 3) & (GRID - 1);
      this.foodY = (this.foodY + 5) & (GRID - 1);
    }
  }
}
