"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@turing-incomplete/ui/embed";
import { SYSTOLIC_DSL } from "./circuits";

export function useSystolicSimulator() {
  const sim = useCircuitSimulator(SYSTOLIC_DSL);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Find the actual mangled node ID for "start" from the compiled circuit.
  const startNodeId = useMemo(() => {
    if (!sim.circuit?.nodes) return null;
    for (const node of sim.circuit.nodes) {
      if (node.label === "start" || node.id === "start") return node.id;
    }
    return null;
  }, [sim.circuit]);

  // Monitor done signal
  useEffect(() => {
    if (sim.portValues) {
      for (const [key, value] of sim.portValues) {
        if (key.includes("done_led") && value) {
          setIsDone(true);
          setIsRunning(false);
          break;
        }
      }
    }
  }, [sim.portValues]);

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

  const handleStart = useCallback(() => {
    if (startNodeId) {
      sim.toggleNode(startNodeId);
    }
    setIsDone(false);
    setIsRunning(true);
  }, [startNodeId, sim]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsDone(false);
    sim.reset();
  }, [sim]);

  return {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    isDone,
    handleStart,
    handleReset,
  };
}
