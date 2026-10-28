import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TestSystolic3x3 } from './circuits';

export function useSystolicSimulator() {
  const sim = useSimulation(TestSystolic3x3);
  const { state, actions } = sim;
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [speed, setSpeed] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Find the actual mangled node ID for "start" from the compiled circuit.
  const startNodeId = useMemo(() => {
    if (!state.circuit?.nodes) return null;
    for (const node of state.circuit.nodes) {
      if (node.label === 'start' || node.id === 'start') return node.id;
    }
    return null;
  }, [state.circuit]);

  // Monitor the circuit's formal `done` output port (was previously a
  // substring scan over portValues looking for a node named "done_led",
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

  const handleStart = useCallback(() => {
    if (startNodeId) {
      void actions.setInput(startNodeId, 1);
    }
    setHasStarted(true);
    setIsDone(false);
    setIsRunning(true);
  }, [startNodeId, actions]);

  const handleStep = useCallback(() => {
    if (!hasStarted && startNodeId) {
      void actions.setInput(startNodeId, 1);
      setHasStarted(true);
    }
    void actions.tick();
  }, [hasStarted, startNodeId, actions]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setHasStarted(false);
    setIsDone(false);
    void actions.reset();
  }, [actions]);

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
