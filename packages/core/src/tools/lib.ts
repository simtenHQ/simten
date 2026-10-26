/**
 * Shared Component Library
 *
 * The standard library as a CircuitLibrary and a behaviour table, built from
 * the std circuits themselves. Both are read-only: a compile that uses std
 * starts from them and adds its own circuits to a copy.
 */

import { type Behaviour, type BehaviourTable, behaviourOf } from '../circuit/behaviour.js';
import type { CircuitIR, CircuitLibrary, MutableCircuitLibrary } from '../ir/circuit-ir.js';
import { STDLIB_CIRCUITS } from '../std/index.js';

let cachedLibrary: CircuitLibrary | null = null;
let cachedBehaviours: BehaviourTable | null = null;

/** Each std circuit, then its dependencies; the first definition of a name wins. */
function buildStd(): { library: CircuitLibrary; behaviours: BehaviourTable } {
  const { library } = createMutableLibrary();
  const behaviours = new Map<string, Behaviour>();
  for (const built of STDLIB_CIRCUITS) {
    for (const c of [built, ...built._dependencies.values()]) {
      library.addCircuit(c.circuit);
      const behaviour = behaviourOf(c);
      if (behaviour && !behaviours.has(c.circuit.name)) behaviours.set(c.circuit.name, behaviour);
    }
  }
  cachedLibrary = library;
  cachedBehaviours = behaviours;
  return { library, behaviours };
}

/**
 * Returns the canonical stdlib CircuitLibrary (cached).
 */
export function getLibrary(): CircuitLibrary {
  return cachedLibrary ?? buildStd().library;
}

/**
 * The standard library's behaviour, by component name: the base for a
 * compile that only has IR (and perhaps behaviour as source text), such as the
 * sandbox's compile-ir or a page-side canvas showing std components.
 */
export function getStdBehaviours(): BehaviourTable {
  return cachedBehaviours ?? buildStd().behaviours;
}

export function createMutableLibrary(): {
  library: MutableCircuitLibrary;
  circuits: CircuitIR[];
} {
  const circuits: CircuitIR[] = [];

  const library: MutableCircuitLibrary = {
    resolveCircuit: (name: string) => circuits.find((c) => c.name === name),
    getAllPrimitiveNames: () =>
      circuits.filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
    addCircuit: (circuit: CircuitIR) => {
      circuits.push(circuit);
    },
    getAllCircuitNames: () => circuits.map((c) => c.name),
  };

  return { library, circuits };
}
