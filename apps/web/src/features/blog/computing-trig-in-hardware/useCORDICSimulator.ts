import { useCircuitSimulator } from '@simten/embed';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CORDICCircuit } from './circuits';

export function useCORDICSimulator() {
  const sim = useCircuitSimulator(CORDICCircuit);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Monitor the circuit's formal `done` output port (was previously a
  // substring scan over portValues looking for a node named "doneLed" —
  // replaced with a declared top-level port).
  useEffect(() => {
    const done = sim.portValues?.get('__top__.done');
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
