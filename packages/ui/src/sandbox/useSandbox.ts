/**
 * useSandbox — iframe execution sandbox manager
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

// In dev the sandbox runs on localhost:3002. In production, sandbox.simten.dev.
// Vite replaces import.meta.env.VITE_SANDBOX_ORIGIN at build time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SANDBOX_ORIGIN: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SANDBOX_ORIGIN)
    || 'http://localhost:3002';

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
}

export interface SandboxError {
  type: 'error';
  error: string;
}

export type SandboxResult =
  | ({ type: 'compiled' } & CompileResult)
  | ({ type: 'compiled-ir' } & { portValues: Record<string, number | boolean>; peripheralState?: PeripheralState })
  | ({ type: 'ticked' } & TickResult)
  | ({ type: 'ticked-n' } & TickResult)
  | ({ type: 'scanned-port' } & { values: number[] })
  | ({ type: 'simulated' } & SimulateResult)
  | ({ type: 'reset' } & ResetResult)
  | ({ type: 'set-node' } & SetNodeResult)
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
   */
  compileIR(circuit: any, libraryCircuits: any[], slot: SimSlot, options?: { evalSources?: Record<string, EvalSource> }): Promise<CompileIRResult | SandboxError>;
  tick(inputs?: Record<string, number | boolean>, slot?: SimSlot): Promise<TickResult | SandboxError>;
  /**
   * Advance the simulator by N ticks in a single round-trip. Returns final
   * port values + one peripheral-state snapshot. Use for demos that need
   * many ticks per frame (raster displays, batched compute).
   */
  tickN(n: number, inputs?: Record<string, number | boolean>, slot?: SimSlot): Promise<TickResult | SandboxError>;
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
  setNode(nodeId: string, value: number | boolean | Map<number, number>, slot?: SimSlot): Promise<SetNodeResult | SandboxError>;
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
    async (circuit: any, libraryCircuits: any[], slot: SimSlot, options?: { evalSources?: Record<string, EvalSource> }): Promise<CompileIRResult | SandboxError> => {
      const result = await send<{ type: 'compiled-ir' } & CompileIRResult>({
        type: 'compile-ir',
        circuit,
        libraryCircuits,
        slot,
        evalSources: options?.evalSources,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'compiled-ir' } & CompileIRResult;
      return { portValues: r.portValues, peripheralState: r.peripheralState };
    },
    [send],
  );

  const tick = useCallback(
    async (inputs?: Record<string, number | boolean>, slot: SimSlot = 'default'): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked' } & TickResult>({ type: 'tick', inputs, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked' } & TickResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState };
    },
    [send],
  );

  const tickN = useCallback(
    async (n: number, inputs?: Record<string, number | boolean>, slot: SimSlot = 'default'): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked-n' } & TickResult>({ type: 'tick-n', n, inputs, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked-n' } & TickResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState };
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
    async (nodeId: string, value: number | boolean | Map<number, number>, slot: SimSlot = 'default'): Promise<SetNodeResult | SandboxError> => {
      const result = await send<{ type: 'set-node' } & SetNodeResult>({ type: 'set-node', nodeId, value, slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'set-node' } & SetNodeResult;
      return { portValues: r.portValues, peripheralState: r.peripheralState };
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

  return { compile, compileIR, tick, tickN, scanPort, simulate, reset, setNode, dispose, isReady };
}
