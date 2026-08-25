/**
 * Reference solutions, one per level id.
 *
 * These are the validation gate's known-good answers; `__tests__/levels.test.ts`
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
 * provide an export named 'default'". Nothing in the repo does that today,
 * `check-exports.ts` is the only `tsx` entry point and it reads package.json
 * files, but it is the reason to reach for vitest rather than tsx when poking
 * at these.
 *
 * ⚠️ These are the answers, and this module ships to the browser. Anyone can
 * read them out of the bundle. The drilldown now draws the player's own draft
 * where there is one, so this is only the fallback for levels never opened,
 * the spoiler is smaller than it was, but it is still there. Making it
 * test-only means finding something else for an unopened level to inspect to.
 */

import andGate from './and.ts?raw';
import dLatch from './d-latch.ts?raw';
import firstWire from './first-wire.ts?raw';
import fullAdder from './full-adder.ts?raw';
import halfAdder from './half-adder.ts?raw';
import latch from './latch.ts?raw';
import makingAComponent from './making-a-component.ts?raw';
import norGate from './nor.ts?raw';
import notGate from './not.ts?raw';
import orGate from './or.ts?raw';
import toggle from './toggle.ts?raw';
import xnorGate from './xnor.ts?raw';
import xorGate from './xor.ts?raw';

export const SOLUTIONS: Record<string, string> = {
  'first-wire': firstWire,
  not: notGate,
  and: andGate,
  or: orGate,
  nor: norGate,
  xor: xorGate,
  xnor: xnorGate,
  'making-a-component': makingAComponent,
  'half-adder': halfAdder,
  'd-latch': dLatch,
  latch,
  toggle,
  'full-adder': fullAdder,
};
