import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cyclesPerSecond, useAutoRun } from '@/lib/auto-run';
import { TestSystolic3x3 } from './circuits';

/** One cycle every 100ms until the slider says otherwise. */
const OPTIONS = { speed: cyclesPerSecond(100) };

export function useSystolicSimulator() {
  const sim = useSimulation(TestSystolic3x3, OPTIONS);
  const { state, actions } = sim;
  const run = useAutoRun(sim);
  const [hasStarted, setHasStarted] = useState(false);

  // Find the actual mangled node ID for "start" from the compiled circuit.
  const startNodeId = useMemo(() => {
    if (!state.circuit?.nodes) return null;
    for (const node of state.circuit.nodes) {
      if (node.label === 'start' || node.id === 'start') return node.id;
    }
    return null;
  }, [state.circuit]);

  // The circuit's `done` output. It holds once the array has drained.
  const isDone = state.portValues?.get('__top__.done') === 1;

  // Stop the clock at Done. The worker may run a cycle past it before the
  // pause lands; the accumulators hold, so nothing visible moves.
  useEffect(() => {
    if (isDone && state.isRunning) void actions.pause();
  }, [isDone, state.isRunning, actions]);

  const handleStart = useCallback(() => {
    if (startNodeId) void actions.setInput(startNodeId, 1);
    setHasStarted(true);
    void actions.run();
  }, [startNodeId, actions]);

  const handleStep = useCallback(() => {
    if (!hasStarted && startNodeId) {
      void actions.setInput(startNodeId, 1);
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
