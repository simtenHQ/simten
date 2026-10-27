/**
 * Circuits compiled for check_circuit and simulate_circuit, from either a
 * circuit file loaded as a module (file-runner) or source text (compile-source).
 */

import {
  addToLibrary,
  type CircuitIR,
  emptyLibrary,
  internalsOf,
  isCircuit,
  type MutableLibrary,
} from '@simten/core/internal';

export interface Compiled {
  /** The circuits built, in the order they were built. */
  circuits: CircuitIR[];
  /** Those circuits with everything they are made of, and their behavior. */
  library: MutableLibrary;
  error: string | null;
}

/** Compile what the `circuit(...)` calls returned. Factories and non-circuits are skipped. */
export function compileBuilt(built: readonly unknown[]): Compiled {
  const library = emptyLibrary();
  const circuits: CircuitIR[] = [];
  for (const made of built) {
    if (!isCircuit(made)) continue;
    circuits.push(internalsOf(made).ir);
    addToLibrary(library, made);
  }
  if (circuits.length === 0) {
    return {
      circuits,
      library,
      error: 'No circuits found. Build one with circuit(...) in this file or a file it imports.',
    };
  }
  return { circuits, library, error: null };
}

/** Nothing compiled, because of `error`. */
export function compileError(error: string): Compiled {
  return { circuits: [], library: emptyLibrary(), error };
}
