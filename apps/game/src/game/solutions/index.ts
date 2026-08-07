/**
 * Reference solutions, one per level id.
 *
 * These are the validation gate's known-good answers — `__tests__/levels.test.ts`
 * asserts every one passes its level, and that the set matches `LEVELS` exactly.
 *
 * Real `.ts` files rather than string literals, loaded as text with Vite's
 * `?raw`. The point is that they typecheck: a solution with a typo or a wrong
 * port name now fails `tsc` while you are writing it, instead of surviving to
 * become a confusing grader failure. They also format and lint like any other
 * source, and no backtick needs escaping.
 *
 * The imports at the top of each file are real, which is what makes `tsc` able
 * to check them. The sandbox strips imports before execution and injects the
 * stdlib as globals, so the same file is valid in both places.
 *
 * ⚠️ `?raw` is a Vite feature. Vitest resolves it because it runs through Vite's
 * pipeline; a bare `tsx` script importing this module would fail with "does not
 * provide an export named 'default'". Nothing in the repo does that today —
 * `check-exports.ts` is the only `tsx` entry point and it reads package.json
 * files — but it is the reason to reach for vitest rather than tsx when poking
 * at these.
 *
 * ⚠️ These are the answers, and this module ships to the browser. Anyone can
 * read them out of the bundle. That is deliberate and temporary: the map's
 * drilldown needs *some* circuit to draw before progress is persisted. Once
 * `simten:game:drafts` exists the drilldown should read the player's own source
 * and this becomes test-only again.
 */

import andFromNand from './and-from-nand.ts?raw';
import firstWire from './first-wire.ts?raw';
import fullAdder from './full-adder.ts?raw';
import halfAdder from './half-adder.ts?raw';
import makingAComponent from './making-a-component.ts?raw';
import norFromNand from './nor-from-nand.ts?raw';
import notFromNand from './not-from-nand.ts?raw';
import orFromNand from './or-from-nand.ts?raw';
import xnorFromNand from './xnor-from-nand.ts?raw';
import xorFromNand from './xor-from-nand.ts?raw';

export const SOLUTIONS: Record<string, string> = {
  'first-wire': firstWire,
  'not-from-nand': notFromNand,
  'and-from-nand': andFromNand,
  'or-from-nand': orFromNand,
  'nor-from-nand': norFromNand,
  'xor-from-nand': xorFromNand,
  'xnor-from-nand': xnorFromNand,
  'making-a-component': makingAComponent,
  'half-adder': halfAdder,
  'full-adder': fullAdder,
};
