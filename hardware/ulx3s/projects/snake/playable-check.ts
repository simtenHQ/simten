#!/usr/bin/env tsx

/**
 * playable-check.ts — the /circuit editor's playable snake actually plays.
 *
 * parity-check.ts proves the example's SnakeCore is the FPGA circuit;
 * gameplay.verify.ts proves that circuit plays correct snake. What's left is
 * the editor-only harness: keyboard Input → DirDecoder → core ⇄ RAM. This
 * script builds the example source through executeCircuitCode (the editor
 * sandbox's path), drives the keyboard node with PC scan codes exactly the
 * way EditorWorkspace does on keydown (setNode on the Input), and checks the
 * RAM's framebuffer region against the reference model every game tick.
 *
 * Covers: scan-code decode (72/77/80/75 → up/right/down/left), direction
 * hold across non-arrow keys, and the core-to-RAM wiring of the harness.
 */

import { executeCircuitCode } from '@simten/core/circuit';
import { simulate } from '@simten/core/sim';
import { EXAMPLES } from '../../../../apps/web/src/features/visual-editor/examples.js';
import { renderFb } from './cosim-lib.js';
import { FB_SIZE, SnakeRefModel } from './ref-model.js';

const SCAN: Record<string, number> = { up: 72, right: 77, down: 80, left: 75 };
const DIR: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 };

const example = EXAMPLES.find((e) => e.id === 'snake');
if (!example) {
  console.error('❌ no snake example');
  process.exit(1);
}
const result = executeCircuitCode(example.code);
if (result.error) {
  console.error(`❌ example failed to execute: ${result.error}`);
  process.exit(1);
}
const playable = result.builtCircuits.find((c) => c.circuit.name === 'SnakePlayable');
if (!playable) {
  console.error('❌ SnakePlayable not among built circuits');
  process.exit(1);
}

const sim = simulate(playable as Parameters<typeof simulate>[0], { library: result.library });
const model = new SnakeRefModel();

function readFb(): Uint8Array {
  const fb = new Uint8Array(FB_SIZE);
  const seq = sim.session.getState().sequentialState;
  const ram = seq?.currentState.get('ram');
  if (!(ram instanceof Map)) throw new Error('ram state not found in sequential state');
  for (let a = 0; a < FB_SIZE; a++) fb[a] = (ram as Map<number, number>).get(a) ?? 0;
  return fb;
}

function expectFbEqual(context: string): void {
  const got = readFb();
  for (let a = 0; a < FB_SIZE; a++) {
    if (got[a] !== model.fb[a]) {
      console.error(
        `❌ ${context}: framebuffer mismatch at addr ${a}: ram=${got[a]} model=${model.fb[a]}`,
      );
      console.error(`ram:\n${renderFb(got)}\nmodel:\n${renderFb(model.fb)}`);
      process.exit(1);
    }
  }
}

// Keys pressed per game tick. 'hold:30' is the KeyA scan code — a non-arrow
// key must not change direction (the decoder's hold register keeps 'right'
// from the previous press... or the initial value 1).
const KEYPRESSES = [
  null,
  'right',
  'right',
  'up', // eats the food at (6,3) on the 4th tick
  'hold:30',
  null,
  'left',
  'left',
  'down',
  'down',
  'right',
  'up',
] as const;

let lastDir = 1; // decoder hold register init = right
expectFbEqual('initial state');
for (let i = 0; i < KEYPRESSES.length; i++) {
  const press = KEYPRESSES[i];
  if (press === 'hold:30') {
    sim.setNode('keyboard', 30); // KeyA — decoder must hold the last direction
  } else if (press) {
    sim.setNode('keyboard', SCAN[press]);
    lastDir = DIR[press];
  }
  sim.tickN(4);
  model.step(lastDir);
  expectFbEqual(`tick ${i + 1} (press=${press ?? 'none'}, dir=${lastDir})`);
}
if (model.eaten < 1) {
  console.error(`❌ script expected at least one eat, got ${model.eaten}`);
  process.exit(1);
}
sim.dispose();
console.log(
  `✅ playable harness works: ${KEYPRESSES.length} ticks driven by scan codes, fb matches model throughout (${model.eaten} food eaten, non-arrow key held direction)`,
);
