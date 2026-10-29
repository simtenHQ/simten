/**
 * A demo's Run button and speed slider over the sandbox's auto-run.
 *
 * The demos' sliders are in milliseconds per cycle; the sandbox runs in
 * cycles per second, in its worker, so the page keeps no clock of its own.
 */

import type { UseSimulationResult } from '@simten/react/sandbox';
import { useCallback } from 'react';

/** Cycles per second for one cycle every `ms` milliseconds. */
export function cyclesPerSecond(ms: number): number {
  return 1000 / ms;
}

export function useAutoRun(sim: UseSimulationResult) {
  const { state, actions } = sim;
  const speed = Math.round(1000 / state.speed);
  const setSpeed = useCallback((ms: number) => actions.setSpeed(cyclesPerSecond(ms)), [actions]);
  const setIsRunning = useCallback(
    (on: boolean) => void (on ? actions.run() : actions.pause()),
    [actions],
  );
  return { isRunning: state.isRunning, setIsRunning, speed, setSpeed };
}
