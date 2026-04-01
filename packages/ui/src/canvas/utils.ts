/**
 * Canvas utilities — shared helpers for drill-down and inspector.
 */

import type { Circuit, ComponentLibrary } from "@turing-incomplete/core/dsl";
import { PRIMITIVES } from "@turing-incomplete/core/simulator";

/** Create a mutable library that supports addCircuit for multi-circuit reference DSL */
export function createMutableLibraryForRef(): ComponentLibrary & { addCircuit(c: Circuit): void } {
  const circuitMap = new Map<string, Circuit>();
  for (const c of PRIMITIVES) circuitMap.set(c.name, c);
  return {
    resolveComponent: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      Array.from(circuitMap.entries())
        .filter(([, c]) => c.implementation.kind === "primitive")
        .map(([n]) => n),
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => {
      circuitMap.set(circuit.name, circuit);
    },
  };
}
