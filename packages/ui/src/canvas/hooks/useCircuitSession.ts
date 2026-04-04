/**
 * useCircuitSession — creates a SimulationSession from a compiled Circuit.
 *
 * For consumers that already have a Circuit object (editor, inspector).
 * For consumers that have DSL text, use useCircuitSimulator from @turing-incomplete/embed instead.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import {
  SimulationSession,
  createSimulatorFromCircuit,
  type ComponentLibrary,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core/dsl";
import { useSimulationSession, type UseSimulationSessionResult } from "./useSimulationSession";

function detectSequential(
  circuit: Circuit,
  resolveComponent: (name: string) => Circuit | undefined,
): boolean {
  const visited = new Set<string>();
  function check(c: Circuit): boolean {
    if (visited.has(c.name)) return false;
    visited.add(c.name);
    for (const node of c.nodes) {
      const def = resolveComponent(node.componentRef);
      if (!def) continue;
      if (def.clocks.length > 0 || def.state.length > 0) return true;
      if (def.implementation.kind === "composite" && check(def)) return true;
    }
    return false;
  }
  return check(circuit);
}

export function useCircuitSession(
  circuit: Circuit | null,
  componentLibrary: ComponentLibrary | null,
  memoryData?: Map<string, Map<number, number>>,
): UseSimulationSessionResult & { session: SimulationSession | null } {
  const [session, setSession] = useState<SimulationSession | null>(null);
  const sessionRef = useRef<SimulationSession | null>(null);

  // Track structure to avoid recreating session on value-only changes
  const prevStructureRef = useRef("");

  useEffect(() => {
    if (!circuit || !componentLibrary || circuit.nodes.length === 0) {
      if (sessionRef.current) {
        sessionRef.current.dispose();
        sessionRef.current = null;
      }
      setSession(null);
      return;
    }

    // Fast structure fingerprint — node IDs + refs + connection count.
    // Much cheaper than JSON.stringify on every render.
    const structure = circuit.nodes.map(n => `${n.id}:${n.componentRef}`).join('|')
      + `#${circuit.connections.length}`;

    if (structure === prevStructureRef.current && sessionRef.current) {
      // Structure unchanged — sync input values to existing engine
      const engine = sessionRef.current.getEngine();
      if (engine) {
        for (const node of circuit.nodes) {
          if (node.arguments?.value !== undefined) {
            engine.setInput(node.id, node.arguments.value as boolean | number);
          }
        }
        // Always run combinational to propagate values (switches, LEDs).
        // For sequential circuits this doesn't advance the clock.
        sessionRef.current.runCombinational();
      }
      return;
    }
    prevStructureRef.current = structure;

    // Dispose old session
    if (sessionRef.current) {
      sessionRef.current.dispose();
      sessionRef.current = null;
    }

    try {
      const isSeq = detectSequential(circuit, componentLibrary.resolveComponent);
      const engine = createSimulatorFromCircuit(circuit, componentLibrary, memoryData);
      engine.runCombinational();
      const s = new SimulationSession(engine, { isSequential: isSeq });
      sessionRef.current = s;
      setSession(s);
      return () => {
        if (sessionRef.current === s) {
          s.dispose();
          sessionRef.current = null;
        }
      };
    } catch (e) {
      console.error("[useCircuitSession] Init failed:", e);
      setSession(null);
    }
  }, [circuit, componentLibrary, memoryData]);

  const simState = useSimulationSession(session);

  return { ...simState, session };
}
