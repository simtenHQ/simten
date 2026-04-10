import { useState, useEffect, useRef, useCallback } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { CORDICCircuit } from "./circuits";

export function useCORDICSimulator() {
  const sim = useCircuitSimulator(CORDICCircuit);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Monitor done signal
  useEffect(() => {
    if (sim.portValues) {
      for (const [key, value] of sim.portValues) {
        if (key.includes("doneLed") && value) {
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
    handleReset,
  };
}
