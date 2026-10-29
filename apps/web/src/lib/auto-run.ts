/**
 * A demo's Run button and speed slider over the sandbox's auto-run.
 *
 * The demos' sliders are in milliseconds per cycle; the sandbox runs in
 * cycles per second, in its worker, so the page keeps no clock of its own.
 * `run(speed)` is the one way to set the sandbox's speed, so the slider's value
 * is kept here and sent with each run.
 */

import type { UseSimulationResult } from '@simten/react';
import { useCallback, useState } from 'react';

/** Cycles per second for one cycle every `ms` milliseconds. */
function cyclesPerSecond(ms: number): number {
  return 1000 / ms;
}

/** Run, pause and a speed in ms per cycle, starting at `initialMs`. */
export function useAutoRun(sim: UseSimulationResult, initialMs: number) {
  const { state, actions } = sim;
  const [speed, setSpeedMs] = useState(initialMs);
  const isRunning = state.isRunning;
  const setSpeed = useCallback(
    (ms: number) => {
      setSpeedMs(ms);
      if (isRunning) void actions.run(cyclesPerSecond(ms));
    },
    [actions, isRunning],
  );
  const setIsRunning = useCallback(
    (on: boolean) => void (on ? actions.run(cyclesPerSecond(speed)) : actions.pause()),
    [actions, speed],
  );
  return { isRunning, setIsRunning, speed, setSpeed };
}
