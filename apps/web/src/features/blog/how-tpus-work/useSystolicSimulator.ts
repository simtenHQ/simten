import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { TestSystolic3x3 } from "./circuits";

export function useSystolicSimulator() {
  const sim = useCircuitSimulator(TestSystolic3x3);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
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

  // Monitor the circuit's formal `done` output port (was previously a
  // substring scan over portValues looking for a node named "done_led" —
  // replaced with a declared top-level port).
  useEffect(() => {
    const done = sim.portValues?.get("__top__.done");
    if (done) {
      setIsDone(true);
      setIsRunning(false);
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
      sim.setNodeValue(startNodeId, 1);
    }
    setHasStarted(true);
    setIsDone(false);
    setIsRunning(true);
  }, [startNodeId, sim]);

  const handleStep = useCallback(() => {
    if (!hasStarted && startNodeId) {
      sim.setNodeValue(startNodeId, 1);
      setHasStarted(true);
    }
    sim.tick();
  }, [hasStarted, startNodeId, sim]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setHasStarted(false);
    setIsDone(false);
    sim.reset();
  }, [sim]);

  return {
    sim,
    isRunning,
    setIsRunning,
    hasStarted,
    speed,
    setSpeed,
    isDone,
    handleStart,
    handleStep,
    handleReset,
  };
}
