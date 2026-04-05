/**
 * useCompileCode — compiles TypeScript circuit code into a Circuit + ComponentLibrary.
 *
 * Uses executeComponentCode() from the builder API.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { executeComponentCode } from "@turing-incomplete/core/builder";
import {
  elaborate,
  type ComponentLibrary,
  type FlatCircuit,
  type Circuit,
} from "@turing-incomplete/core";

export interface CompileCodeResult {
  circuit: Circuit | null;
  componentLibrary: ComponentLibrary | null;
  flatCircuit: FlatCircuit | null;
  isSequential: boolean;
  ready: boolean;
  error: string | null;
  inputs: Record<string, boolean | number>;
}

export function useCompileCode(code: string): CompileCodeResult {
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

    if (!code) {
      setCircuit(null);
      return;
    }

    const result = executeComponentCode(code);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.circuits.length === 0) {
      setError("No circuits found. Call .build() on your component() definitions.");
      return;
    }

    const mainCircuit = result.circuit!;
    libraryRef.current = result.library;

    const initialInputs: Record<string, boolean | number> = {};
    for (const input of mainCircuit.inputs) {
      initialInputs[input.name] = input.portType.kind === 'bit' ? false : 0;
    }
    // Only update if inputs actually changed (prevents render loops)
    setInputs(prev => {
      const keys = Object.keys(initialInputs);
      if (keys.length !== Object.keys(prev).length) return initialInputs;
      if (keys.every(k => prev[k] === initialInputs[k])) return prev;
      return initialInputs;
    });

    try {
      const flatCircuit = elaborate(mainCircuit, result.library);
      flatCircuitRef.current = flatCircuit;

      let hasClocks = !!(mainCircuit.clocks && mainCircuit.clocks.length > 0);
      if (!hasClocks) {
        for (const node of flatCircuit.nodes) {
          if (node.primitiveType) {
            const def = result.library.resolveComponent(node.primitiveType);
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
  }, [code]);

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
