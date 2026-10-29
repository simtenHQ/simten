/**
 * The `circuit` a project's files get when file-runner loads them.
 *
 * file-runner points each `@simten/core` import in
 * the project at a module that re-exports the real one with this `circuit` in
 * its place, so every circuit the files build is recorded here in the order
 * they built it. That is what check_circuit lists and simulate_circuit picks
 * its default from, the same as for source text (see executeJsCode in core).
 */

import { circuit as coreCircuit } from '@simten/core';

/** What each `circuit(...)` call in the project returned, in call order. */
export const built: unknown[] = [];

function tracking(...args: Parameters<typeof coreCircuit>) {
  const made = coreCircuit(...args);
  built.push(made);
  return made;
}

export const circuit = tracking as typeof coreCircuit;
