import { useSimulation } from '@simten/react';
import { useCallback, useEffect } from 'react';
import { useAutoRun } from '@/lib/auto-run';
import { CORDICCircuit } from './circuits';

export function useCORDICSimulator() {
  const sim = useSimulation(CORDICCircuit);
  const { state, actions } = sim;
  // One iteration every 100ms until the slider says otherwise.
  const run = useAutoRun(sim, 100);

  // The Done lamp. It holds once the iterations run out.
  const isDone = state.portValues?.get('doneLed.in') === 1;

  // Stop the clock at Done. The worker may run a cycle or two past it before
  // the pause lands; the result registers hold, so nothing visible moves.
  useEffect(() => {
    if (isDone && state.isRunning) void actions.pause();
  }, [isDone, state.isRunning, actions]);

  const handleReset = useCallback(() => {
    void actions.pause();
    void actions.reset();
  }, [actions]);

  return { sim, ...run, isDone, handleReset };
}
