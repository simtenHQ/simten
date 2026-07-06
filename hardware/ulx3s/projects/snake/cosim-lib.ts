/**
 * cosim-lib.ts — shared engine for gameplay.verify.ts and fault-check.ts.
 *
 * Drives the Snake circuit and the plain-JS reference model through
 * the same direction sequence, scanning the circuit's framebuffer through its
 * own scan port (scan_addr → pixel_out, the path the VGA wrapper uses on the
 * FPGA) and comparing against the model after every game tick (4 clock
 * cycles). fault-check.ts passes a `mutate` hook to corrupt the circuit IR
 * before simulation and asserts the comparison throws.
 */

import { simulate } from '@simten/core/sim';
import type { Circuit } from '@simten/core/simulator';
import { buildSnake } from './index.js';
import { FB_SIZE, GRID, SnakeRefModel } from './ref-model.js';

export type SnakeBuilt = ReturnType<typeof buildSnake>['built'];
export type SnakeSim = ReturnType<typeof buildSim>;

export function buildSim(mutate?: (built: SnakeBuilt) => void) {
  const { built } = buildSnake();
  mutate?.(built);
  return simulate(built);
}

/**
 * Overwrite one argument of a named node in the circuit IR (fault injection).
 * `circuitName` addresses the composite the node lives in — the top circuit
 * or any dependency (e.g. 'Snake_FoodUnit'). buildSnake() constructs
 * fresh circuit objects per call, so mutations never leak between builds.
 */
export function setNodeArg(
  built: SnakeBuilt,
  circuitName: string,
  nodeId: string,
  key: string,
  value: number,
): void {
  const circuit: Circuit | undefined =
    built.circuit.name === circuitName
      ? built.circuit
      : built._dependencies.get(circuitName)?.circuit;
  if (!circuit) {
    throw new Error(
      `setNodeArg: circuit '${circuitName}' not found (have: ${[...built._dependencies.keys()].join(', ')})`,
    );
  }
  const node = circuit.nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new Error(
      `setNodeArg: node '${nodeId}' not in ${circuitName} (have: ${circuit.nodes.map((n) => n.id).join(', ')})`,
    );
  }
  node.arguments = { ...node.arguments, [key]: value };
}

/** Read the full framebuffer through the circuit's scan port, no clocking. */
export function scanFb(sim: SnakeSim): Uint8Array {
  const fb = new Uint8Array(FB_SIZE);
  for (let a = 0; a < FB_SIZE; a++) {
    sim.set({ scan_addr: a });
    sim.session.runCombinational();
    fb[a] = sim.get('pixel_out');
  }
  return fb;
}

export function renderFb(fb: Uint8Array): string {
  const rows: string[] = [];
  for (let y = 0; y < GRID; y++) {
    rows.push([...fb.slice(y * GRID, (y + 1) * GRID)].map((v) => (v ? '#' : '.')).join(''));
  }
  return rows.join('\n');
}

export function assertFbEqual(sim: SnakeSim, model: SnakeRefModel, context: string): void {
  const got = scanFb(sim);
  for (let a = 0; a < FB_SIZE; a++) {
    if (got[a] !== model.fb[a]) {
      throw new Error(
        `${context}: framebuffer mismatch at addr ${a} (x=${a % GRID}, y=${Math.floor(a / GRID)}): ` +
          `circuit=${got[a]} model=${model.fb[a]}\ncircuit:\n${renderFb(got)}\nmodel:\n${renderFb(model.fb)}`,
      );
    }
  }
}

/**
 * Drive both the circuit and the model through a direction sequence,
 * comparing the framebuffer at every game tick. Returns the model so callers
 * can assert game-level facts (e.g. that food was actually eaten).
 */
export function coSim(dirs: number[], mutate?: (built: SnakeBuilt) => void): SnakeRefModel {
  const sim = buildSim(mutate);
  const model = new SnakeRefModel();
  try {
    assertFbEqual(sim, model, 'initial state');
    for (let i = 0; i < dirs.length; i++) {
      sim.set({ dir: dirs[i] });
      sim.tickN(4);
      model.step(dirs[i]);
      assertFbEqual(sim, model, `tick ${i + 1} (dir=${dirs[i]})`);
    }
    return model;
  } finally {
    sim.dispose();
  }
}

/** Greedy chase: one wrap-aware step toward the model's current food. */
export function chaseDir(model: SnakeRefModel): number {
  const dx = (model.foodX - model.headX) & (GRID - 1);
  if (dx !== 0) return dx <= GRID / 2 ? 1 : 3; // right if shorter, else left
  const dy = (model.foodY - model.headY) & (GRID - 1);
  return dy <= GRID / 2 ? 2 : 0; // down if shorter, else up
}
