"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@turing-incomplete/embed";
import { SWITCH_DSL } from "./circuits";

export function useSwitchSimulator() {
  const sim = useCircuitSimulator(SWITCH_DSL);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  // Find key node IDs by label
  const nodeIds = useMemo(() => {
    if (!sim.circuit?.nodes) return null;
    const ids: Record<string, string> = {};
    for (const node of sim.circuit.nodes) {
      const label = node.label ?? node.id;
      if (
        label === "always_ready" ||
        label === "p0_byte" ||
        label === "p0_valid" ||
        label === "p1_byte" ||
        label === "p1_valid"
      ) {
        ids[label] = node.id;
      }
    }
    return ids;
  }, [sim.circuit]);

  // Auto-toggle the always_ready switch on first load
  useEffect(() => {
    if (!sim.ready || !nodeIds || initRef.current) return;
    initRef.current = true;

    if (nodeIds.always_ready) {
      sim.toggleNode(nodeIds.always_ready);
    }
  }, [sim.ready, nodeIds, sim.toggleNode]);

  // Auto-run interval
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => {
        sim.tick();
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, sim.ready, speed, sim.tick]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    initRef.current = false;
    sim.reset();
  }, [sim]);

  // Inject a packet on a given port by setting byte + valid, then ticking
  const injectByte = useCallback(
    (port: 0 | 1, byte: number) => {
      if (!nodeIds) return;
      const byteNode = port === 0 ? nodeIds.p0_byte : nodeIds.p1_byte;
      const validNode = port === 0 ? nodeIds.p0_valid : nodeIds.p1_valid;
      if (byteNode) sim.setNodeValue(byteNode, byte);
      if (validNode) sim.setNodeValue(validNode, 1);
    },
    [nodeIds, sim.setNodeValue]
  );

  const clearValid = useCallback(
    (port: 0 | 1) => {
      if (!nodeIds) return;
      const validNode = port === 0 ? nodeIds.p0_valid : nodeIds.p1_valid;
      if (validNode) sim.setNodeValue(validNode, 0);
    },
    [nodeIds, sim.setNodeValue]
  );

  return {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
    injectByte,
    clearValid,
    nodeIds,
  };
}
