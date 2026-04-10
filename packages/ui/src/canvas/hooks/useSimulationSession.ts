/**
 * React binding for SimulationSession.
 *
 * Thin wrapper using useSyncExternalStore — the session's getState()
 * returns a stable reference, so React only re-renders when something
 * actually changes.
 */

"use client";

import { useSyncExternalStore, useCallback, useMemo } from "react";
import type {
  SimulationSession,
  SimulationSessionState,
  SessionSnapshot,
} from "@simten/core/simulator";
import type { BitValue, BusValue } from "@simten/core/simulator";

const EMPTY_STATE: SimulationSessionState = {
  portValues: new Map(),
  sequentialState: null,
  cycle: 0,
  isSequential: false,
  history: [],
  historyIndex: -1,
  isViewingPast: false,
  isRunning: false,
  speed: 0,
};

const noopUnsubscribe = () => {};
const noopSubscribe = () => noopUnsubscribe;

export interface UseSimulationSessionResult<TMeta = unknown>
  extends SimulationSessionState<TMeta> {
  tick: (metadata?: TMeta) => void;
  reset: () => void;
  setNode: (name: string, value: BitValue | BusValue) => void;
  runCombinational: () => void;
  stepBack: () => SessionSnapshot<TMeta> | null;
  stepForward: () => SessionSnapshot<TMeta> | null;
  seek: (index: number) => SessionSnapshot<TMeta> | null;
  startAutoRun: SimulationSession<TMeta>["startAutoRun"];
  stopAutoRun: () => void;
  setSpeed: (ticksPerSecond: number) => void;
}

export function useSimulationSession<TMeta = unknown>(
  session: SimulationSession<TMeta> | null,
): UseSimulationSessionResult<TMeta> {
  const subscribe = useCallback(
    (listener: () => void) =>
      session ? session.subscribe(listener) : noopSubscribe(),
    [session],
  );

  const getSnapshot = useCallback(
    () => (session ? session.getState() : EMPTY_STATE as SimulationSessionState<TMeta>),
    [session],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);


  const actions = useMemo(() => ({
    tick: (metadata?: TMeta) => session?.tick(metadata),
    reset: () => session?.reset(),
    setNode: (name: string, value: BitValue | BusValue) => session?.setNode(name, value),
    runCombinational: () => session?.runCombinational(),
    stepBack: () => session?.stepBack() ?? null,
    stepForward: () => session?.stepForward() ?? null,
    seek: (index: number) => session?.seek(index) ?? null,
    startAutoRun: (...args: Parameters<SimulationSession<TMeta>["startAutoRun"]>) =>
      session?.startAutoRun(...args),
    stopAutoRun: () => session?.stopAutoRun(),
    setSpeed: (tps: number) => session?.setSpeed(tps),
  }), [session]);

  return { ...state, ...actions } as UseSimulationSessionResult<TMeta>;
}
