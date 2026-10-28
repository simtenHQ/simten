import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CORDICCircuit } from './circuits';

export function useCORDICSimulator() {
  const sim = useSimulation(CORDICCircuit);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Monitor the circuit's formal `done` output port (was previously a
  // substring scan over portValues looking for a node named "doneLed",
  // replaced with a declared top-level port).
  useEffect(() => {
    const done = state.portValues?.get('__top__.done');
    if (done) {
      setIsDone(true);
      setIsRunning(false);
    }
  }, [state.portValues]);

  // Auto-run interval
  useEffect(() => {
    if (isRunning && state.ready) {
      intervalRef.current = setInterval(() => {
        void actions.tick();
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, state.ready, speed, actions]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsDone(false);
    void actions.reset();
  }, [actions]);

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
