/**
 * The moment a level is solved.
 *
 * Rather than asserting "correct", it drives the player's own circuit through
 * the truth table one row at a time: the harness switches flip, the LED
 * lights, and each row ticks off as it passes. The proof is the machine
 * running, which is the thing they actually built.
 *
 * The harness names each Switch node after the port it feeds
 * (auto-harness.ts:70), so a vector's input names are already the node ids.
 *
 * Runs are cancellable by token because the source can change mid-sequence,
 * an edit invalidates the verdict, and a half-finished run writing to state
 * afterwards would leave rows lit under a circuit that no longer passes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vector } from './types';

/** Dwell per row. Fast enough to feel like a sweep, slow enough to read. */
const STEP_MS = 320;

export interface VictoryRun {
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
  drive: (nodeId: string, value: number) => Promise<unknown> | unknown,
  tick: () => void,
): VictoryRun {
  const [active, setActive] = useState<number | null>(null);
  const [proven, setProven] = useState(0);
  const [complete, setComplete] = useState(false);

  // Bumped on every start/reset/unmount; a run whose token is stale exits.
  const token = useRef(0);
  const driveRef = useRef(drive);
  driveRef.current = drive;
  const tickRef = useRef(tick);
  tickRef.current = tick;

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
      for (let i = 0; i < vectors.length; i++) {
        if (token.current !== mine) return;
        setActive(i);
        for (const [name, value] of Object.entries(vectors[i].inputs)) {
          await driveRef.current(name, value);
        }
        // Then a clock edge, exactly as the grader does for every vector.
        //
        // Driving inputs propagates but does not advance a clock, so without
        // this a clocked circuit would sit frozen while the grader, which
        // ticks, passed it. The run would contradict the verdict, and it would
        // read as a broken animation rather than a missing edge. Unconditional
        // rather than keyed off `sequential`, because matching the grader for
        // every level is what stops the two drifting apart again; on a
        // combinational circuit a tick changes nothing anyone can see.
        tickRef.current();
        if (token.current !== mine) return;
        setProven(i + 1);
        await new Promise((r) => setTimeout(r, STEP_MS));
      }
      if (token.current !== mine) return;
      setActive(null);
      setComplete(true);
    })();
  }, [vectors]);

  return { active, proven, complete, start, reset };
}
