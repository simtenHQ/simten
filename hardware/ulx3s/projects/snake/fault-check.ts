#!/usr/bin/env tsx
/**
 * fault-check.ts — proves the snake gameplay harness can actually FAIL.
 *
 * Each fault overwrites one node argument in the freshly built circuit IR
 * (the simulator evaluates primitives from node.arguments, so this is a real
 * netlist-level corruption), then co-sims the same scripted game against the
 * unmodified reference model and requires a framebuffer divergence. If any
 * fault survives the whole script, the harness is blind and we exit non-zero.
 *
 * The minus1 fault recreates the historical Mux-width bug that shipped to the
 * FPGA (left/up mirrored to right/down because 8'd255 was truncated to 1).
 */

import { coSim, setNodeArg, type SnakeBuilt } from './cosim-lib.js';

// Eats the first food at tick 3, sees the respawn redraw at tick 4, and uses
// every direction — exercises movement, growth, and the food cycle.
const SCRIPT = [1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 0, 0];

const FAULTS: Array<{ name: string; why: string; mutate: (b: SnakeBuilt) => void }> = [
  {
    name: "DirectionUnit.minus1: Constant 255 → 1 (the historical FPGA Mux-width bug)",
    why: 'left/up deltas become +1, mirroring movement to right/down',
    mutate: (b) => setNodeArg(b, 'Snake_DirectionUnit', 'minus1', 'value', 1),
  },
  {
    name: 'FoodUnit.five: Constant 5 → 4',
    why: 'food respawns at the wrong Y — only observable after the first eat',
    mutate: (b) => setNodeArg(b, 'Snake_FoodUnit', 'five', 'value', 4),
  },
  {
    name: 'HeadUnit.headX: Register init 4 → 5',
    why: 'head starts one cell off — first head draw lands on the wrong pixel',
    mutate: (b) => setNodeArg(b, 'Snake_HeadUnit', 'headX', 'value', 5),
  },
];

let blind = 0;
for (const fault of FAULTS) {
  try {
    coSim(SCRIPT, fault.mutate);
    console.error(`❌ harness is BLIND to [${fault.name}] — ${fault.why}, yet no divergence`);
    blind++;
  } catch (e) {
    const firstLine = (e instanceof Error ? e.message : String(e)).split('\n')[0];
    console.log(`✅ caught [${fault.name}]: ${firstLine}`);
  }
}

if (blind > 0) {
  console.error(`\n${blind}/${FAULTS.length} faults went undetected`);
  process.exit(1);
}
console.log(`\nharness is valid: ${FAULTS.length}/${FAULTS.length} injected faults caught`);
