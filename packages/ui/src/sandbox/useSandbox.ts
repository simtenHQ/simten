/**
 * useSandbox — iframe execution sandbox manager (HOST side of the bridge).
 *
 * The iframe-side counterpart lives at `apps/sandbox/src/main.ts`. Most
 * consumers should NOT call this directly — use `useCircuitSimulator` from
 * `@simten/embed`, which composes this transport with circuit-level concerns.
 * See `apps/web/content/docs/architecture.mdx` → "Runtime topology".
 *
 * Creates and manages a hidden iframe at SANDBOX_ORIGIN with
 * sandbox="allow-scripts". All circuit compilation and simulation
 * runs inside the sandbox — never in the main frame.
 *
 * Security guarantees:
 *   - Separate origin → browser enforces isolation (no access to
 *     main-frame cookies, localStorage, or DOM)
 *   - sandbox="allow-scripts" blocks ALL network at the browser
 *     kernel level (no fetch, XHR, WebSocket possible)
 *   - postMessage boundary: only plain JSON crosses. No functions,
 *     no Maps, no class instances.
 *   - Infinite loops: 5s timeout kills and recreates the iframe;
 *     main UI is unaffected.
 *
 * Usage:
 *   const sandbox = useSandbox();
 *   const result = await sandbox.compile(source);
 *   const tick = await sandbox.tick({ a: true });
 */

import { useRef, useEffect, useCallback } from 'react';
import type { Circuit } from '@simten/core';
import type { RLEValue } from '@simten/core/api';

// ============================================================================
// Config
// ============================================================================

// Sandbox origin: defaults work for normal dev (localhost:3002) and production
// (sandbox.simten.dev). VITE_SANDBOX_ORIGIN is an optional escape hatch for
// unusual setups (e.g. pointing local dev at a staging sandbox).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const SANDBOX_ORIGIN: string =
  env?.VITE_SANDBOX_ORIGIN
    || (env?.PROD ? 'https://sandbox.simten.dev' : 'http://localhost:3002');

// ============================================================================
// Types
// ============================================================================

/**
 * State of nodes on a peripheral's bus — exposed across the sandbox boundary
 * so the UI can render displays, consoles, NIC FIFOs, etc.
 *
 * Values are whatever the simulator stores for each node: number | boolean |
 * Map<number, number> | string. The sandbox only snapshots state for nodes
 * tagged (via circuit `meta.synthesizable: false`) or wired directly to such
 * a node — the sim analog of memory-mapped I/O.
 */
export type PeripheralState = Record<string, unknown>;

export interface CompileResult {
  circuits: Circuit[];
  libraryCircuits: Circuit[];
  portValues: Record<string, number | boolean>;
  peripheralState?: PeripheralState;
}

export interface TickResult {
  portValues: Record<string, number | boolean>;
  cycle: number;
  peripheralState?: PeripheralState;
  /** Snapshot id returned when the tick was requested with `{ snapshot: true }`. */
  snapshotId?: number;
}

export interface SimulateResult {
  circuitName: string;
  signals: Record<string, RLEValue[]>;
  vcd: string;
  ticks: number;
  steadyStateAt?: number;
}

export interface ResetResult {
  portValues: Record<string, number | boolean>;
  peripheralState?: PeripheralState;
}

export interface SetNodeResult {
  portValues: Record<string, number | boolean>;
  peripheralState?: PeripheralState;
  /** Snapshot id returned when `{ snapshot: true }` was passed. */
  snapshotId?: number;
}

export interface SnapshotResult {
  /** Undefined for combinational-only circuits (nothing to snapshot). */
  snapshotId?: number;
}

export interface RestoreResult {
  portValues: Record<string, number | boolean>;
  cycle: number;
  peripheralState?: PeripheralState;
}

export interface SandboxError {
  type: 'error';
  error: string;
}

export type SandboxResult =
  | ({ type: 'compiled' } & CompileResult)
  | ({ type: 'compiled-ir' } & { portValues: Record<string, number | boolean>; peripheralState?: PeripheralState; snapshotId?: number })
  | ({ type: 'ticked' } & TickResult)
  | ({ type: 'ticked-n' } & TickResult)
  | ({ type: 'scanned-port' } & { values: number[] })
  | ({ type: 'simulated' } & SimulateResult)
  | ({ type: 'reset' } & ResetResult)
  | ({ type: 'set-node' } & SetNodeResult)
  | ({ type: 'snapshot' } & SnapshotResult)
  | ({ type: 'restored' } & RestoreResult)
  | ({ type: 'pruned' } & { })
  | ({ type: 'disposed' } & { })
  | ({ type: 'error' } & SandboxError);

// ============================================================================
// Sandbox manager (singleton per hook instance)
// ============================================================================

type PendingResolve = (result: SandboxResult) => void;

interface SandboxState {
  iframe: HTMLIFrameElement | null;
  ready: boolean;
  pending: Map<string, PendingResolve>;
  readyQueue: Array<() => void>;
  idCounter: number;
}

function createIframe(
  state: SandboxState,
  container: HTMLElement,
  handleMessage: (event: MessageEvent) => void,
  onCrash: () => void,
): HTMLIFrameElement {
  // Remove old iframe if any
  if (state.iframe) {
    state.iframe.remove();
    state.iframe = null;
    state.ready = false;
  }

  const iframe = document.createElement('iframe');
  iframe.src = SANDBOX_ORIGIN;
  // allow-same-origin: keeps iframe's declared origin (sandbox.simten.dev / localhost:3002)
  // so the browser can load scripts and Vite dev server works.
  // Origin isolation still holds: the main app (simten.dev / localhost:3001) is a
  // different origin, so the iframe cannot access the main app's cookies or localStorage.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.style.cssText = 'display:none;width:0;height:0;position:absolute;';
  iframe.setAttribute('aria-hidden', 'true');

  // Recover from catastrophic iframe crash (e.g. OOM, failed load)
  iframe.onerror = onCrash;

  container.appendChild(iframe);
  state.iframe = iframe;
  state.ready = false;

  window.addEventListener('message', handleMessage);

  return iframe;
}

function nextId(state: SandboxState): string {
  return `sb-${++state.idCounter}`;
}

// ============================================================================
// Hook
// ============================================================================

export interface CompileIRResult {
  portValues: Record<string, number | boolean>;
  peripheralState?: PeripheralState;
  /** Snapshot of the initial state, returned when `{ snapshot: true }` was requested. */
  snapshotId?: number;
}

/** Serialized eval entry used to transfer eval functions to the sandbox */
export interface EvalSource {
  evalSource: string;
  onTickSource?: string;
  inputNames: string[];
  outputNames: string[];
  stateKeys?: string[];
}

/** Slot IDs are arbitrary strings — use any unique identifier per simulation context. */
export type SimSlot = string;

export interface SandboxHandle {
  compile(source: string, slot?: SimSlot): Promise<CompileResult | SandboxError>;
  /**
   * Compile from Circuit IR (e.g. auto-harnessed circuit).
   * Optional evalSources map transfers eval functions from the caller's context.
   * If omitted, inherits eval functions from any previously-compiled slot.
   * Pass `{ snapshot: true }` to capture the initial state for time-travel.
   */
  compileIR(circuit: any, libraryCircuits: any[], slot: SimSlot, options?: { evalSources?: Record<string, EvalSource>; snapshot?: boolean }): Promise<CompileIRResult | SandboxError>;
  /** Pass `{ snapshot: true }` to also capture a post-tick snapshot for time-travel. */
  tick(inputs?: Record<string, number | boolean>, slot?: SimSlot, options?: { snapshot?: boolean }): Promise<TickResult | SandboxError>;
  /**
   * Advance the simulator by N ticks in a single round-trip. Returns final
   * port values + one peripheral-state snapshot. Use for demos that need
   * many ticks per frame (raster displays, batched compute).
   * Pass `{ snapshot: true }` to capture a post-tickN snapshot.
   */
  tickN(n: number, inputs?: Record<string, number | boolean>, slot?: SimSlot, options?: { snapshot?: boolean }): Promise<TickResult | SandboxError>;
  /**
   * Combinationally scan a debug address input across 0..count-1, sampling
   * a value output port after each setting. Returns the array in one
   * round-trip. Clock is NOT advanced. Models JTAG-style halted-mode reads.
   */
  scanPort(addrNodeId: string, valuePortKey: string, count: number, slot?: SimSlot): Promise<{ values: number[] } | SandboxError>;
  simulate(params: {
    source?: string;
    ticks: number;
    inputs?: Record<string, number | boolean>;
    memoryData?: Record<string, Record<string, number>>;
    slot?: SimSlot;
  }): Promise<SimulateResult | SandboxError>;
  reset(slot?: SimSlot): Promise<ResetResult | SandboxError>;
  setNode(nodeId: string, value: number | boolean | Map<number, number>, slot?: SimSlot, options?: { snapshot?: boolean }): Promise<SetNodeResult | SandboxError>;
  /**
   * Take a snapshot of the current simulator state. Returns an opaque
   * snapshotId the host can later pass to `restore()`. For combinational-only
   * circuits returns `{ snapshotId: undefined }` — nothing to save.
   */
  snapshot(slot?: SimSlot): Promise<SnapshotResult | SandboxError>;
  /** Restore the simulator to a previously-captured snapshot. */
  restore(snapshotId: number, slot?: SimSlot): Promise<RestoreResult | SandboxError>;
  /**
   * Drop all snapshots with id <= keepAfterId. Called by the host when its
   * local history cap is exceeded, so old snapshots get garbage-collected
   * inside the sandbox. Silently succeeds if the slot has no snapshots.
   */
  pruneSnapshots(keepAfterId: number, slot?: SimSlot): Promise<{ type: 'pruned' } | SandboxError>;
  /** Free a slot's simulator + library when no longer needed (e.g. embed unmount). */
  dispose(slot: SimSlot): Promise<void>;
  isReady(): boolean;
}

export function useSandbox(): SandboxHandle {
  const stateRef = useRef<SandboxState>({
    iframe: null,
    ready: false,
    pending: new Map(),
    readyQueue: [],
    idCounter: 0,
  });

  // Container div injected into document body (avoids React tree)
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMessageRef = useRef<(event: MessageEvent) => void>(() => {});

  const recreateIframe = useCallback(() => {
    const state = stateRef.current;
    const container = containerRef.current;
    if (!container) return;

    // Fail all pending promises — sandbox crashed, no response coming
    for (const [, resolve] of state.pending) {
      resolve({ type: 'error', error: 'Sandbox restarted (crash)' });
    }
    state.pending.clear();
    state.readyQueue = [];

    window.removeEventListener('message', handleMessageRef.current);
    createIframe(state, container, handleMessageRef.current, recreateIframeRef.current);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== SANDBOX_ORIGIN) return;

    const state = stateRef.current;
    const data = event.data as { type: string; id?: string };

    if (data.type === 'ready') {
      state.ready = true;
      // Flush queued sends
      for (const fn of state.readyQueue) fn();
      state.readyQueue = [];
      return;
    }

    if (!data.id) return;

    const resolve = state.pending.get(data.id);
    if (!resolve) return;

    state.pending.delete(data.id);
    resolve(data as SandboxResult);
  }, []);

  // Keep refs in sync
  handleMessageRef.current = handleMessage;
  const recreateIframeRef = useRef(recreateIframe);
  recreateIframeRef.current = recreateIframe;

  useEffect(() => {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(container);
    containerRef.current = container;

    const state = stateRef.current;
    createIframe(state, container, handleMessage, recreateIframe);

    return () => {
      window.removeEventListener('message', handleMessage);
      container.remove();
      containerRef.current = null;
    };
  }, [handleMessage]);

  // No timeout here — the sandbox's own 5s worker timeout always sends back an
  // error response if user code hangs. recreateIframe() is only called by the
  // iframe's onerror handler (catastrophic crash, failed load, OOM).
  const send = useCallback(
    <T extends SandboxResult>(message: object): Promise<T | SandboxError> => {
      return new Promise((resolve) => {
        const state = stateRef.current;
        const id = nextId(state);
        const msgWithId = { ...message, id };

        state.pending.set(id, resolve as PendingResolve);

        const doSend = () => {
          const iframe = state.iframe;
          if (!iframe?.contentWindow) {
            state.pending.delete(id);
            resolve({ type: 'error', error: 'Sandbox iframe not available' } as SandboxError);
            return;
          }
          iframe.contentWindow.postMessage(msgWithId, SANDBOX_ORIGIN);
        };

        if (state.ready) {
          doSend();
        } else {
          state.readyQueue.push(doSend);
        }
      });
    },
    [],
  );

  const compile = useCallback(
    async (source: string, slot: SimSlot = 'default'): Promise<CompileResult | SandboxError> => {
      const result = await send<{ type: 'compiled' } & CompileResult>({ type: 'compile', source, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'compiled' } & CompileResult;
      return { circuits: r.circuits, libraryCircuits: r.libraryCircuits, portValues: r.portValues, peripheralState: r.peripheralState };
    },
    [send],
  );

  const compileIR = useCallback(
    async (circuit: any, libraryCircuits: any[], slot: SimSlot, options?: { evalSources?: Record<string, EvalSource>; snapshot?: boolean }): Promise<CompileIRResult | SandboxError> => {
      const result = await send<{ type: 'compiled-ir' } & CompileIRResult>({
        type: 'compile-ir',
        circuit,
        libraryCircuits,
        slot,
        evalSources: options?.evalSources,
        snapshot: options?.snapshot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'compiled-ir' } & CompileIRResult;
      return { portValues: r.portValues, peripheralState: r.peripheralState, snapshotId: r.snapshotId };
    },
    [send],
  );

  const tick = useCallback(
    async (inputs?: Record<string, number | boolean>, slot: SimSlot = 'default', options?: { snapshot?: boolean }): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked' } & TickResult>({ type: 'tick', inputs, slot, snapshot: options?.snapshot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked' } & TickResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState, snapshotId: r.snapshotId };
    },
    [send],
  );

  const tickN = useCallback(
    async (n: number, inputs?: Record<string, number | boolean>, slot: SimSlot = 'default', options?: { snapshot?: boolean }): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked-n' } & TickResult>({ type: 'tick-n', n, inputs, slot, snapshot: options?.snapshot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked-n' } & TickResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState, snapshotId: r.snapshotId };
    },
    [send],
  );

  const scanPort = useCallback(
    async (addrNodeId: string, valuePortKey: string, count: number, slot: SimSlot = 'default'): Promise<{ values: number[] } | SandboxError> => {
      const result = await send<{ type: 'scanned-port'; values: number[] }>({ type: 'scan-port', addrNodeId, valuePortKey, count, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'scanned-port'; values: number[] };
      return { values: r.values };
    },
    [send],
  );

  const simulate = useCallback(
    async (params: {
      source?: string;
      ticks: number;
      inputs?: Record<string, number | boolean>;
      memoryData?: Record<string, Record<string, number>>;
    }): Promise<SimulateResult | SandboxError> => {
      const result = await send<{ type: 'simulated' } & SimulateResult>({ type: 'simulate', ...params });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'simulated' } & SimulateResult;
      return {
        circuitName: r.circuitName,
        signals: r.signals,
        vcd: r.vcd,
        ticks: r.ticks,
        steadyStateAt: r.steadyStateAt,
      };
    },
    [send],
  );

  const reset = useCallback(async (slot: SimSlot = 'default'): Promise<ResetResult | SandboxError> => {
    const result = await send<{ type: 'reset' } & ResetResult>({ type: 'reset', slot });
    if ('error' in result) return result as SandboxError;
    const r = result as { type: 'reset' } & ResetResult;
    return { portValues: r.portValues, peripheralState: r.peripheralState };
  }, [send]);

  const setNode = useCallback(
    async (nodeId: string, value: number | boolean | Map<number, number>, slot: SimSlot = 'default', options?: { snapshot?: boolean }): Promise<SetNodeResult | SandboxError> => {
      const result = await send<{ type: 'set-node' } & SetNodeResult>({ type: 'set-node', nodeId, value, slot, snapshot: options?.snapshot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'set-node' } & SetNodeResult;
      return { portValues: r.portValues, peripheralState: r.peripheralState, snapshotId: r.snapshotId };
    },
    [send],
  );

  const snapshot = useCallback(
    async (slot: SimSlot = 'default'): Promise<SnapshotResult | SandboxError> => {
      const result = await send<{ type: 'snapshot' } & SnapshotResult>({ type: 'snapshot', slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'snapshot' } & SnapshotResult;
      return { snapshotId: r.snapshotId };
    },
    [send],
  );

  const restore = useCallback(
    async (snapshotId: number, slot: SimSlot = 'default'): Promise<RestoreResult | SandboxError> => {
      const result = await send<{ type: 'restored' } & RestoreResult>({ type: 'restore', snapshotId, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'restored' } & RestoreResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState };
    },
    [send],
  );

  const pruneSnapshots = useCallback(
    async (keepAfterId: number, slot: SimSlot = 'default'): Promise<{ type: 'pruned' } | SandboxError> => {
      const result = await send<{ type: 'pruned' }>({ type: 'prune-snapshots', keepAfterId, slot });
      if ('error' in result) return result as SandboxError;
      return result as { type: 'pruned' };
    },
    [send],
  );

  const dispose = useCallback(
    async (slot: SimSlot): Promise<void> => {
      await send({ type: 'dispose', slot });
    },
    [send],
  );

  const isReady = useCallback(() => stateRef.current.ready, []);

  return { compile, compileIR, tick, tickN, scanPort, simulate, reset, setNode, snapshot, restore, pruneSnapshots, dispose, isReady };
}
