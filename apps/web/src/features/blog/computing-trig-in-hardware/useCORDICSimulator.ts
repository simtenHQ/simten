import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect } from 'react';
import { cyclesPerSecond, useAutoRun } from '@/lib/auto-run';
import { CORDICCircuit } from './circuits';

/** One iteration every 100ms until the slider says otherwise. */
const OPTIONS = { speed: cyclesPerSecond(100) };

export function useCORDICSimulator() {
  const sim = useSimulation(CORDICCircuit, OPTIONS);
  const { state, actions } = sim;
  const run = useAutoRun(sim);

  // The circuit's `done` output. It holds once the iterations run out.
  const isDone = state.portValues?.get('__top__.done') === 1;

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
