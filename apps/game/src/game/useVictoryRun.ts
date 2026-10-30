/**
 * The moment a level is solved.
 *
 * Rather than asserting "correct", it drives the player's own circuit through
 * the truth table one row at a time: the input switches flip, the LED
 * lights, and each row ticks off as it passes. The proof is the machine
 * running, which is the thing they actually built.
 *
 * A vector's input names are what the simulation's `set` takes, whether the
 * level's inputs are ports or switches, and a whole row is set in one call, so
 * a latch sees its inputs change together, as the grader writes them.
 *
 * Each run restarts the preview first, a power cycle in the sandbox, so it
 * starts where the grader did: the state a session opens in. The preview the player was using could be
 * anywhere, a counter mid-count after the last run or a latch holding what
 * they last set, and `reset` leaves the switches where they are, so a run
 * from there could disagree with the verdict it is meant to show.
 *
 * Runs are cancellable by token because the source can change mid-sequence,
 * an edit invalidates the verdict, and a half-finished run writing to state
 * afterwards would leave rows lit under a circuit that no longer passes.
 */

import type { SimulationActions } from '@simten/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vector } from './types';

/** Dwell per row. Fast enough to feel like a sweep, slow enough to read. */
const STEP_MS = 320;

interface VictoryRun {
  /** Row currently being driven, or null when not mid-run. */
  active: number | null;
  /** Rows proven so far; drives the ticks. */
  proven: number;
  /** True once every row has been driven. */
  complete: boolean;
  start: () => void;
  reset: () => void;
}

export function useVictoryRun(
  vectors: Vector[],
  preview: Pick<SimulationActions, 'restart' | 'set' | 'tick'>,
): VictoryRun {
  const [active, setActive] = useState<number | null>(null);
  const [proven, setProven] = useState(0);
  const [complete, setComplete] = useState(false);

  // Bumped on every start/reset/unmount; a run whose token is stale exits.
  const token = useRef(0);

  useEffect(() => {
    return () => {
      token.current++;
    };
  }, []);

  const reset = useCallback(() => {
    token.current++;
    setActive(null);
    setProven(0);
    setComplete(false);
  }, []);

  const start = useCallback(() => {
    const mine = ++token.current;
    setProven(0);
    setComplete(false);

    void (async () => {
      await preview.restart();
      for (let i = 0; i < vectors.length; i++) {
        if (token.current !== mine) return;
        setActive(i);
        await preview.set(vectors[i].inputs);
        // Then a clock edge, exactly as the grader does for every vector.
        //
        // Driving inputs propagates but does not advance a clock, so without
        // this a clocked circuit would sit frozen while the grader, which
        // ticks, passed it. The run would contradict the verdict, and it would
        // read as a broken animation rather than a missing edge. Unconditional
        // rather than keyed off `sequential`, because matching the grader for
        // every level is what stops the two drifting apart again; on a
        // combinational circuit a tick changes nothing anyone can see.
        await preview.tick();
        if (token.current !== mine) return;
        setProven(i + 1);
        await new Promise((r) => setTimeout(r, STEP_MS));
      }
      if (token.current !== mine) return;
      setActive(null);
      setComplete(true);
    })();
  }, [vectors, preview]);

  return { active, proven, complete, start, reset };
}
