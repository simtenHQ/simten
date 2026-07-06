#!/usr/bin/env tsx

/**
 * gameplay.verify.ts — Tier-B testbench: Snake plays the same game as
 * a plain-JS reference model, framebuffer-equal after every game tick.
 *
 * Each game tick is 4 clock cycles (phases 0–3). After every tick the full
 * 8×8 framebuffer is scanned through the circuit's own scan port
 * (scan_addr → pixel_out, the path the VGA wrapper uses on the FPGA) and
 * compared against the model. Scripted scenarios pin the named behaviors
 * (wrap, growth, deferred tail clear, food respawn cycle); a fast-check
 * property fuzzes random direction sequences on top.
 *
 * Harness validity (that a corrupted netlist is caught) is proven separately
 * by fault-check.ts.
 *
 * Run: tsx projects/snake/gameplay.verify.ts  (or pnpm fpga:verify:snake)
 */

import { declareOracle, describe, verify } from '@simten/core/verify';
import * as fc from 'fast-check';
import { assertFbEqual, buildSim, chaseDir, coSim } from './cosim-lib.js';
import { SnakeRefModel } from './ref-model.js';

describe('Snake');
declareOracle({
  tier: 'B',
  type: 'imperative plain-JS snake model (arrays + circular buffer), framebuffer compared every game tick',
  independence_basis:
    'The model is paradigm-diverse: sequential statements over arrays, no muxes/adders/phase ' +
    'pipeline. It restates the game rules (move, wrap, eat+grow, deferred tail clear, food ' +
    'respawn at (+3,+5) mod 8), not the netlist dataflow it checks.',
});

verify.exhaustive('straight run wraps around both walls', [1], () => {
  // 20 ticks right crosses the right wall twice; 20 down crosses the bottom.
  coSim([...Array(20).fill(1), ...Array(20).fill(2)]);
});

verify.exhaustive('tight 2x2 loop: head re-enters just-vacated tail cells', [1], () => {
  // len 4 in a 2x2 box — every tick clears a pixel the head immediately redraws,
  // pinning the phase-1-clear-then-phase-3-draw ordering.
  const loop = [1, 2, 3, 0];
  coSim([...loop, ...loop, ...loop, ...loop]);
});

verify.exhaustive('180° reversals overdraw the body without corruption', [1], () => {
  coSim([1, 3, 1, 3, 2, 0, 2, 0, 1, 1, 3, 3]);
});

verify.exhaustive('eats the first food, grows, and redraws the respawn', [1], () => {
  // Head (4,4) → right, right → (6,4) → up onto food (6,3). Then keep moving
  // through the food-draw tick and beyond.
  const model = coSim([1, 1, 0, 0, 1, 1, 2, 2]);
  if (model.eaten !== 1)
    throw new Error(`scenario expected exactly 1 food eaten, got ${model.eaten}`);
  if (model.len !== 5) throw new Error(`snake should have grown to 5, got ${model.len}`);
});

verify.exhaustive('greedy chase eats through the full 8-position food respawn cycle', [1], () => {
  // Food respawns at (+3,+5) mod 8 — an 8-position cycle. Chase and eat all 8.
  const sim = buildSim();
  const model = new SnakeRefModel();
  try {
    assertFbEqual(sim, model, 'initial state');
    let tick = 0;
    while (model.eaten < 8 && tick < 400) {
      const dir = chaseDir(model);
      sim.set({ dir });
      sim.tickN(4);
      model.step(dir);
      tick++;
      assertFbEqual(sim, model, `tick ${tick} (dir=${dir}, eaten=${model.eaten})`);
    }
    if (model.eaten < 8) throw new Error(`chase only ate ${model.eaten}/8 foods in ${tick} ticks`);
    if (model.len !== 4 + 8) throw new Error(`snake should have grown to 12, got ${model.len}`);
    return true;
  } finally {
    sim.dispose();
  }
});

verify.check(
  'random direction sequences stay framebuffer-equal every tick',
  fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 60 }), (dirs) => {
    coSim(dirs);
    return true;
  }),
  { numRuns: 30 },
);

verify.run();
