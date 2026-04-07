/**
 * useCircuitSession — creates a SimulationSession from a compiled Circuit.
 *
 * For consumers that already have a Circuit object (editor, inspector).
 * For consumers that have a Circuit IR, use useCircuitSimulator from @turing-incomplete/embed instead.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import {
  SimulationSession,
  createSimulatorFromCircuit,
  type CircuitLibrary,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core";
import { useSimulationSession, type UseSimulationSessionResult } from "./useSimulationSession";

function detectSequential(
  circuit: Circuit,
  resolveCircuit: (name: string) => Circuit | undefined,
): boolean {
  const visited = new Set<string>();
  function check(c: Circuit): boolean {
    if (visited.has(c.name)) return false;
    visited.add(c.name);
    for (const node of c.nodes) {
      const def = resolveCircuit(node.componentRef);
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
  componentLibrary: CircuitLibrary | null,
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
      return;
    }
    prevStructureRef.current = structure;

    // Dispose old session
    if (sessionRef.current) {
      sessionRef.current.dispose();
      sessionRef.current = null;
    }

    try {
      const isSeq = detectSequential(circuit, componentLibrary.resolveCircuit);
      const engine = createSimulatorFromCircuit(circuit, componentLibrary);
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
  }, [circuit, componentLibrary]);

  const simState = useSimulationSession(session);

  return { ...simState, session };
}
