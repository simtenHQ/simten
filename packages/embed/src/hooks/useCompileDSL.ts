/**
 * useCompileDSL — compiles DSL text into a Circuit + ComponentLibrary.
 *
 * Compilation only, no simulation. Use useCircuitSession for simulation.
 * Creates a per-instance mutable library to avoid cross-contamination
 * between multiple embeds on the same page.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { compileDSL, type ComponentLibrary as DSLComponentLibrary } from "@turing-incomplete/core/dsl";
import {
  elaborate,
  PRIMITIVES,
  type ComponentLibrary,
  type FlatCircuit,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core/dsl";

function createMutableLibrary(primitives: Circuit[]): ComponentLibrary & DSLComponentLibrary {
  const circuitMap = new Map<string, Circuit>();
  for (const c of primitives) circuitMap.set(c.name, c);
  return {
    resolveComponent: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => Array.from(circuitMap.entries())
      .filter(([, c]) => c.implementation.kind === 'primitive').map(([name]) => name),
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => { circuitMap.set(circuit.name, circuit); },
  };
}

export interface CompileDSLResult {
  circuit: Circuit | null;
  componentLibrary: ComponentLibrary | null;
  flatCircuit: FlatCircuit | null;
  isSequential: boolean;
  ready: boolean;
  error: string | null;
  /** Top-level inputs with their default values */
  inputs: Record<string, boolean | number>;
}

export interface UseCompileDSLOptions {
  initialMemory?: Map<string, Map<number, number>>;
}

export function useCompileDSL(
  dslCode: string,
  options?: UseCompileDSLOptions,
): CompileDSLResult {
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSequential, setIsSequential] = useState(false);
  const [inputs, setInputs] = useState<Record<string, boolean | number>>({});
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const libraryRef = useRef<ComponentLibrary | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    flatCircuitRef.current = null;
    libraryRef.current = null;

    if (!dslCode) {
      setCircuit(null);
      return;
    }

    const library = createMutableLibrary([...PRIMITIVES]);
    libraryRef.current = library;

    const result = compileDSL(dslCode, library, "embed.dsl");

    if (result.errors.length > 0) {
      setError(result.errors.map(e => e.message).join("; "));
      return;
    }

    if (result.circuits.length === 0) {
      setError("No circuits found in DSL");
      return;
    }

    const mainCircuit = result.circuits[result.circuits.length - 1];

    // Initialize top-level inputs
    const initialInputs: Record<string, boolean | number> = {};
    for (const input of mainCircuit.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    setInputs(initialInputs);

    try {
      const flatCircuit = elaborate(mainCircuit, library);
      flatCircuitRef.current = flatCircuit;

      // Detect sequential
      let hasClocks = !!(mainCircuit.clocks && mainCircuit.clocks.length > 0);
      if (!hasClocks) {
        for (const node of flatCircuit.nodes) {
          if (node.primitiveType) {
            const def = library.resolveComponent(node.primitiveType);
            if (def && def.clocks && def.clocks.length > 0) {
              hasClocks = true;
              break;
            }
          }
        }
      }

      setCircuit(mainCircuit);
      setIsSequential(hasClocks);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dslCode]);

  return {
    circuit,
    componentLibrary: libraryRef.current,
    flatCircuit: flatCircuitRef.current,
    isSequential,
    ready,
    error,
    inputs,
  };
}
