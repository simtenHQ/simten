import { useSimulation } from '@simten/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutoRun } from '@/lib/auto-run';
import { TestSystolic3x3 } from './circuits';

export function useSystolicSimulator() {
  const sim = useSimulation(TestSystolic3x3);
  const { state, actions } = sim;
  // One cycle every 100ms until the slider says otherwise.
  const run = useAutoRun(sim, 100);
  const { setIsRunning } = run;
  const [hasStarted, setHasStarted] = useState(false);

  // Find the actual mangled node ID for "start" from the compiled circuit.
  const startNodeId = useMemo(() => {
    if (!state.circuit?.nodes) return null;
    for (const node of state.circuit.nodes) {
      if (node.label === 'start' || node.id === 'start') return node.id;
    }
    return null;
  }, [state.circuit]);

  // The Done lamp. It holds once the array has drained.
  const isDone = state.portValues?.get('done_led.in') === 1;

  // Stop the clock at Done. The worker may run a cycle past it before the
  // pause lands; the accumulators hold, so nothing visible moves.
  useEffect(() => {
    if (isDone && state.isRunning) void actions.pause();
  }, [isDone, state.isRunning, actions]);

  const handleStart = useCallback(() => {
    if (startNodeId) void actions.set({ [startNodeId]: 1 });
    setHasStarted(true);
    setIsRunning(true);
  }, [startNodeId, actions, setIsRunning]);

  const handleStep = useCallback(() => {
    if (!hasStarted && startNodeId) {
      void actions.set({ [startNodeId]: 1 });
      setHasStarted(true);
    }
    void actions.tick();
  }, [hasStarted, startNodeId, actions]);

  const handleReset = useCallback(() => {
    setHasStarted(false);
    void actions.pause();
    void actions.reset();
  }, [actions]);

  return { sim, ...run, hasStarted, isDone, handleStart, handleStep, handleReset };
}
