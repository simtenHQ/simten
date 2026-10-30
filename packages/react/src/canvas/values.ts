/**
 * How a node on the canvas gets its value, and how a click reaches the
 * simulation.
 *
 * The drawing (nodes and wires) is built from the circuit alone, once per
 * circuit. Values change on every update, so they don't go through it: the
 * canvas keeps the session's values in a small store, and each node and wire
 * reads its own value from the store by the session's key (`a.out`,
 * `__top__.sum`). A node re-renders when its value changes, not when any
 * value does. Both reach the nodes through `CanvasContext`, with the actions
 * a click calls.
 */

import type { PeripheralValue } from '@simten/core/internal';
import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { NodeData } from '../nodes';

/** A session's values, keyed as the session keys them. */
export interface SessionValues {
  /** Every port value, as `state.portValues`. Null before the first update. */
  ports: ReadonlyMap<string, number> | null;
  /** Screens, consoles, UARTs and the memories behind them, by session path. */
  peripherals: ReadonlyMap<string, PeripheralValue>;
}

/** The latest `SessionValues`, for nodes to subscribe to. */
export interface ValueStore {
  get(): SessionValues;
  subscribe(listener: () => void): () => void;
}

/** What a click on the canvas can do, by the node's path in the session. */
export interface CanvasActions {
  /** Flip a switch. Without it, switches are lamps. */
  toggle?: (path: string) => void;
  /** Set a number input. Without it, number inputs are readings. */
  set?: (path: string, value: number) => void;
  /** Load a program onto a memory, or clear it with an empty map. */
  loadMemory?: (path: string, contents: Map<number, number>) => void;
}

const NO_PERIPHERALS: ReadonlyMap<string, PeripheralValue> = new Map();
const NO_VALUES: SessionValues = { ports: null, peripherals: NO_PERIPHERALS };

/**
 * A store holding `ports` and `peripherals`. It keeps one identity, and tells
 * its subscribers when either changes.
 */
export function useValueStore(
  ports: ReadonlyMap<string, number> | null,
  peripherals: ReadonlyMap<string, PeripheralValue> = NO_PERIPHERALS,
): ValueStore {
  const [store] = useState(() => {
    let current: SessionValues = { ports, peripherals };
    const listeners = new Set<() => void>();
    return {
      get: () => current,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      publish: (next: SessionValues) => {
        current = next;
        for (const listener of listeners) listener();
      },
    };
  });
  // Before paint, so a node never shows a frame behind the canvas around it.
  useLayoutEffect(() => {
    const now = store.get();
    if (now.ports !== ports || now.peripherals !== peripherals)
      store.publish({ ports, peripherals });
  }, [store, ports, peripherals]);
  return store;
}

const EMPTY_STORE: ValueStore = { get: () => NO_VALUES, subscribe: () => () => {} };

export const CanvasContext = createContext<{ values: ValueStore; actions: CanvasActions }>({
  values: EMPTY_STORE,
  actions: {},
});

export const useCanvasActions = (): CanvasActions => useContext(CanvasContext).actions;

/** The value at `key` in the session, or undefined without one. */
export function usePortValue(key: string | undefined): number | undefined {
  const { values } = useContext(CanvasContext);
  return useSyncExternalStore(values.subscribe, () =>
    key === undefined ? undefined : values.get().ports?.get(key),
  );
}

/** The peripheral state at `path` in the session: a screen's memory, a console's text. */
export function usePeripheral(path: string | undefined): PeripheralValue | undefined {
  const { values } = useContext(CanvasContext);
  return useSyncExternalStore(values.subscribe, () =>
    path === undefined ? undefined : values.get().peripherals.get(path),
  );
}

/**
 * A switch's, lamp's or number's value: the session's, or before the session
 * has one, the `value` it was built with.
 */
export function useNodeValue(data: NodeData): number | undefined {
  const live = usePortValue(data.valueKey);
  if (live !== undefined || data.valueKey === undefined) return live;
  const built = data.arguments?.value;
  if (typeof built === 'boolean') return built ? 1 : 0;
  return typeof built === 'number' ? built : undefined;
}

/** A display's pixels from the memory behind it: `count` of them, 0 where it has none. */
export function pixelsOf(memory: PeripheralValue | undefined, count: number): number[] {
  return Array.from({ length: count }, (_, address) =>
    memory instanceof Map ? (memory.get(address) ?? 0) : 0,
  );
}
