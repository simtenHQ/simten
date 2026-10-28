/**
 * useSandbox — iframe execution sandbox manager (HOST side of the bridge).
 *
 * The iframe-side counterpart lives at `apps/sandbox/src/main.ts`. Most
 * consumers should NOT call this directly — use `useCircuitSimulator` from
 * `@simten/embed`, which composes this transport with circuit-level concerns.
 * See `apps/web/content/docs/architecture.mdx` → "Runtime topology".
 *
 * Creates and manages a hidden iframe at SANDBOX_ORIGIN. All circuit
 * compilation and simulation runs inside the sandbox, never in the main frame.
 * Message types are in ./protocol.ts, shared with the sandbox.
 *
 * Security (details in apps/web/content/docs/security.mdx):
 *   - Separate origin: no access to the main frame's cookies, storage or DOM.
 *   - Network is limited by the sandbox's CSP (apps/sandbox/public/_headers),
 *     which allows only esm.sh, for npm imports.
 *   - Only structured-clone data crosses postMessage; the page never receives
 *     user code.
 *   - All user code and simulation run in the sandbox's worker under a 5s watchdog.
 *
 * Usage:
 *   const sandbox = useSandbox();
 *   const result = await sandbox.compile(source);
 *   const tick = await sandbox.tick({ a: true });
 */

import type { CircuitIR } from '@simten/core/internal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BehaviorSource,
  CompileIRResult,
  CompileResult,
  ResetResult,
  RestoreResult,
  SandboxError,
  SandboxRequest,
  SandboxResult,
  SetNodeResult,
  SimSlot,
  SnapshotResult,
  TickResult,
} from './protocol.js';

// ============================================================================
// Config
// ============================================================================

// Sandbox origin: defaults work for normal dev (localhost:3002) and production
// (sandbox.simtenusercontent.dev). VITE_SANDBOX_ORIGIN is an optional escape hatch for
// unusual setups (e.g. pointing local dev at a staging sandbox).
const env = (import.meta as { env?: { VITE_SANDBOX_ORIGIN?: string; PROD?: boolean } }).env;
const SANDBOX_ORIGIN: string =
  env?.VITE_SANDBOX_ORIGIN ||
  (env?.PROD ? 'https://sandbox.simtenusercontent.dev' : 'http://localhost:3002');

// How long to wait for the iframe's `ready` handshake before giving up on it.
// Nothing else catches a sandbox that never comes up: `iframe.onerror` does not
// fire for HTTP error statuses (a 403 still loads a document — the error page),
// so a blocked, blocked-by-extension, or unreachable sandbox used to leave every
// request queued on `readyQueue` forever, with no rejection and no UI change.
// Generous enough to cover a cold load on a slow connection.
const READY_TIMEOUT_MS = 10000;

/** Message given to callers, and shown by the UI, when the sandbox never loads. */
export const SANDBOX_UNAVAILABLE_ERROR =
  'Sandbox failed to load. It may be blocked by a browser extension, or unreachable.';

// ============================================================================
// Types
// ============================================================================

/** Whether the sandbox iframe has completed its handshake, or given up. */
export type SandboxStatus = 'loading' | 'ready' | 'unavailable';

// ============================================================================
// Sandbox manager (singleton per hook instance)
// ============================================================================

type PendingResolve = (result: SandboxResult) => void;

/** A request without its id; `send` assigns one. */
type RequestBody = SandboxRequest extends infer R
  ? R extends SandboxRequest
    ? Omit<R, 'id'>
    : never
  : never;

interface SandboxState {
  iframe: HTMLIFrameElement | null;
  ready: boolean;
  /** Set once the ready handshake has timed out. Requests fail fast instead of queueing. */
  unavailable: boolean;
  readyTimer: ReturnType<typeof setTimeout> | null;
  pending: Map<string, PendingResolve>;
  readyQueue: Array<() => void>;
  idCounter: number;
}

function createIframe(
  state: SandboxState,
  container: HTMLElement,
  handleMessage: (event: MessageEvent) => void,
  onCrash: () => void,
  onReadyTimeout: () => void,
): HTMLIFrameElement {
  // Remove old iframe if any
  if (state.iframe) {
    state.iframe.remove();
    state.iframe = null;
    state.ready = false;
  }

  const iframe = document.createElement('iframe');
  iframe.src = SANDBOX_ORIGIN;
  // allow-same-origin: keeps iframe's declared origin (sandbox.simtenusercontent.dev / localhost:3002)
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
  state.unavailable = false;

  if (state.readyTimer) clearTimeout(state.readyTimer);
  state.readyTimer = setTimeout(onReadyTimeout, READY_TIMEOUT_MS);

  window.addEventListener('message', handleMessage);

  return iframe;
}

// Module-scoped, not per-instance. Several sandboxes can exist on one page —
// every <circuit-embed> mounts its own SandboxProvider — and they all share the
// parent window's message bus. Per-instance counters each started at zero, so
// every sandbox's first request was `sb-1` and one response satisfied all of
// them. Combined with the event.source check in handleMessage this is belt and
// braces, but ids that are unique per page are the correct invariant.
let globalIdCounter = 0;

function nextId(_state: SandboxState): string {
  return `sb-${++globalIdCounter}`;
}

/**
 * Normalise port values arriving from the sandbox to numbers.
 *
 * Port values are numeric (`BitValue = 0 | 1`), but the sandbox is a separately
 * deployed artifact: until sandbox.simtenusercontent.dev is redeployed against a core with
 * the numeric BitValue, it still reports booleans for bits. Coercing once here —
 * at the single point every response passes through — means no consumer
 * downstream (canvas, inspector, embed) has to know that.
 *
 * Mutates in place: the object is a fresh structured clone from postMessage.
 */
function normalizePortValues(data: unknown): void {
  const pv = (data as { portValues?: Record<string, number | boolean> })?.portValues;
  if (!pv) return;
  for (const key of Object.keys(pv)) {
    const v = pv[key];
    if (typeof v === 'boolean') pv[key] = v ? 1 : 0;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface SandboxHandle {
  compile(source: string, slot?: SimSlot): Promise<CompileResult | SandboxError>;
  /**
   * Compile from Circuit IR (e.g. auto-harnessed circuit).
   * Optional evalSources map transfers eval functions from the caller's context.
   * If omitted, inherits eval functions from any previously-compiled slot.
   * Pass `{ snapshot: true }` to capture the initial state for time-travel.
   */
  compileIR(
    circuit: CircuitIR,
    libraryCircuits: CircuitIR[],
    slot: SimSlot,
    options?: { evalSources?: Record<string, BehaviorSource>; snapshot?: boolean },
  ): Promise<CompileIRResult | SandboxError>;
  /** Pass `{ snapshot: true }` to also capture a post-tick snapshot for time-travel. */
  tick(
    inputs?: Record<string, number | boolean>,
    slot?: SimSlot,
    options?: { snapshot?: boolean },
  ): Promise<TickResult | SandboxError>;
  /**
   * Advance the simulator by N ticks in a single round-trip. Returns final
   * port values + one peripheral-state snapshot. Use for demos that need
   * many ticks per frame (raster displays, batched compute).
   * Pass `{ snapshot: true }` to capture a post-tickN snapshot.
   */
  tickN(
    n: number,
    inputs?: Record<string, number | boolean>,
    slot?: SimSlot,
    options?: { snapshot?: boolean },
  ): Promise<TickResult | SandboxError>;
  /**
   * Combinationally scan a debug address input across 0..count-1, sampling
   * a value output port after each setting. Returns the array in one
   * round-trip. Clock is NOT advanced. Models JTAG-style halted-mode reads.
   */
  /**
   * Tick `count` times and return one port's value after each tick.
   *
   * `tickN` gives only the final state, which is all a canvas needs. Audio
   * needs every intermediate value, and one `tick` call per sample would be
   * tens of thousands of round trips a second.
   *
   * `inputs` are applied once and held for the run, so anything that has to
   * change mid-run is sequenced by the caller across several calls.
   */
  renderSamples(
    portKey: string,
    count: number,
    inputs?: Record<string, number | boolean>,
    slot?: SimSlot,
  ): Promise<{ samples: number[]; cycle: number } | SandboxError>;
  scanPort(
    addrNodeId: string,
    valuePortKey: string,
    count: number,
    slot?: SimSlot,
  ): Promise<{ values: number[] } | SandboxError>;
  reset(slot?: SimSlot): Promise<ResetResult | SandboxError>;
  setNode(
    nodeId: string,
    value: number | Map<number, number>,
    slot?: SimSlot,
    options?: { snapshot?: boolean },
  ): Promise<SetNodeResult | SandboxError>;
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
  /**
   * Reactive load state, for UI that needs to tell the user the sandbox is gone.
   * `unavailable` is terminal for this iframe: every call resolves to an error
   * until something recreates it.
   */
  status: SandboxStatus;
}

interface UseSandboxOptions {
  /**
   * Load the iframe on the first request (or `isReady()` call) instead of on
   * mount. `SandboxProvider` uses it so a page that only uses the new
   * `SandboxClient` doesn't also load an idle slot sandbox.
   */
  lazy?: boolean;
}

export function useSandbox(options: UseSandboxOptions = {}): SandboxHandle {
  const lazy = options.lazy === true;
  const stateRef = useRef<SandboxState>({
    iframe: null,
    ready: false,
    unavailable: false,
    readyTimer: null,
    pending: new Map(),
    readyQueue: [],
    idCounter: 0,
  });

  // Mirrors state.ready/state.unavailable into React so consumers can render a
  // message. The ref stays the source of truth for the message handlers, which
  // run outside React's lifecycle.
  const [status, setStatus] = useState<SandboxStatus>('loading');

  // Container div injected into document body (avoids React tree)
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMessageRef = useRef<(event: MessageEvent) => void>(() => {});

  // The iframe never sent `ready`. Fail everything waiting on it — queued sends
  // are already registered in `pending`, so resolving that map covers both — and
  // leave `unavailable` set so later calls fail immediately rather than piling
  // up behind a handshake that is not coming.
  const markUnavailable = useCallback(() => {
    const state = stateRef.current;
    state.readyTimer = null;
    if (state.ready) return;

    state.unavailable = true;
    for (const [, resolve] of state.pending) {
      resolve({ type: 'error', error: SANDBOX_UNAVAILABLE_ERROR });
    }
    state.pending.clear();
    state.readyQueue = [];
    setStatus('unavailable');
  }, []);

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
    setStatus('loading');

    window.removeEventListener('message', handleMessageRef.current);
    createIframe(
      state,
      container,
      handleMessageRef.current,
      recreateIframeRef.current,
      markUnavailable,
    );
  }, [markUnavailable]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== SANDBOX_ORIGIN) return;

    const state = stateRef.current;
    // Only answer to our own iframe. Every sandbox on the page listens to the
    // same window, so without this a response from someone else's iframe
    // resolves whichever of our pending requests happens to share its id —
    // which made three embeds on one page all render the first circuit.
    if (!state.iframe || event.source !== state.iframe.contentWindow) return;
    const data = event.data as { type: string; id?: string };

    if (data.type === 'ready') {
      state.ready = true;
      state.unavailable = false;
      if (state.readyTimer) {
        clearTimeout(state.readyTimer);
        state.readyTimer = null;
      }
      setStatus('ready');
      // Flush queued sends
      for (const fn of state.readyQueue) fn();
      state.readyQueue = [];
      return;
    }

    if (!data.id) return;

    const resolve = state.pending.get(data.id);
    if (!resolve) return;

    state.pending.delete(data.id);
    normalizePortValues(data);
    resolve(data as SandboxResult);
  }, []);

  // Keep refs in sync
  handleMessageRef.current = handleMessage;
  const recreateIframeRef = useRef(recreateIframe);
  recreateIframeRef.current = recreateIframe;

  // The container and iframe are created on demand: on mount, or with `lazy`
  // on the first request. A request can come from a child's mount effect,
  // which runs before this hook's own, so the container is made here too.
  const ensureIframe = useCallback(() => {
    const state = stateRef.current;
    if (state.iframe || state.unavailable || typeof document === 'undefined') return;
    let container = containerRef.current;
    if (!container) {
      container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
      document.body.appendChild(container);
      containerRef.current = container;
    }
    createIframe(state, container, handleMessage, recreateIframe, markUnavailable);
  }, [handleMessage, recreateIframe, markUnavailable]);

  useEffect(() => {
    if (!lazy) ensureIframe();
    const state = stateRef.current;
    return () => {
      window.removeEventListener('message', handleMessage);
      if (state.readyTimer) {
        clearTimeout(state.readyTimer);
        state.readyTimer = null;
      }
      state.iframe = null;
      state.ready = false;
      containerRef.current?.remove();
      containerRef.current = null;
    };
  }, [lazy, ensureIframe, handleMessage]);

  // No per-request timeout here — the sandbox's own 5s worker timeout always
  // sends back an error response if user code hangs. The one case that produces
  // no response at all is an iframe that never loads, and that is covered by the
  // ready-handshake timeout rather than by timing out each request.
  const send = useCallback(
    <T extends SandboxResult>(message: RequestBody): Promise<T | SandboxError> => {
      ensureIframe();
      return new Promise((resolve) => {
        const state = stateRef.current;

        if (state.unavailable) {
          resolve({ type: 'error', error: SANDBOX_UNAVAILABLE_ERROR } as SandboxError);
          return;
        }

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
    [ensureIframe],
  );

  const compile = useCallback(
    async (source: string, slot: SimSlot = 'default'): Promise<CompileResult | SandboxError> => {
      const result = await send<{ type: 'compiled' } & CompileResult>({
        type: 'compile',
        source,
        slot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'compiled' } & CompileResult;
      return {
        circuits: r.circuits,
        libraryCircuits: r.libraryCircuits,
        portValues: r.portValues,
        peripheralState: r.peripheralState,
      };
    },
    [send],
  );

  const compileIR = useCallback(
    async (
      circuit: CircuitIR,
      libraryCircuits: CircuitIR[],
      slot: SimSlot,
      options?: { evalSources?: Record<string, BehaviorSource>; snapshot?: boolean },
    ): Promise<CompileIRResult | SandboxError> => {
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
      return {
        portValues: r.portValues,
        peripheralState: r.peripheralState,
        snapshotId: r.snapshotId,
      };
    },
    [send],
  );

  const tick = useCallback(
    async (
      inputs?: Record<string, number | boolean>,
      slot: SimSlot = 'default',
      options?: { snapshot?: boolean },
    ): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked' } & TickResult>({
        type: 'tick',
        inputs,
        slot,
        snapshot: options?.snapshot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked' } & TickResult;
      return {
        portValues: r.portValues,
        cycle: r.cycle,
        peripheralState: r.peripheralState,
        snapshotId: r.snapshotId,
      };
    },
    [send],
  );

  const tickN = useCallback(
    async (
      n: number,
      inputs?: Record<string, number | boolean>,
      slot: SimSlot = 'default',
      options?: { snapshot?: boolean },
    ): Promise<TickResult | SandboxError> => {
      const result = await send<{ type: 'ticked-n' } & TickResult>({
        type: 'tick-n',
        n,
        inputs,
        slot,
        snapshot: options?.snapshot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'ticked-n' } & TickResult;
      return {
        portValues: r.portValues,
        cycle: r.cycle,
        peripheralState: r.peripheralState,
        snapshotId: r.snapshotId,
      };
    },
    [send],
  );

  const renderSamples = useCallback(
    async (
      portKey: string,
      count: number,
      inputs?: Record<string, number | boolean>,
      slot: SimSlot = 'default',
    ): Promise<{ samples: number[]; cycle: number } | SandboxError> => {
      const result = await send<{ type: 'rendered-samples'; samples: number[]; cycle: number }>({
        type: 'render-samples',
        portKey,
        count,
        inputs,
        slot,
      });
      if ('error' in result) return result as SandboxError;
      return { samples: result.samples, cycle: result.cycle };
    },
    [send],
  );

  const scanPort = useCallback(
    async (
      addrNodeId: string,
      valuePortKey: string,
      count: number,
      slot: SimSlot = 'default',
    ): Promise<{ values: number[] } | SandboxError> => {
      const result = await send<{ type: 'scanned-port'; values: number[] }>({
        type: 'scan-port',
        addrNodeId,
        valuePortKey,
        count,
        slot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'scanned-port'; values: number[] };
      return { values: r.values };
    },
    [send],
  );

  const reset = useCallback(
    async (slot: SimSlot = 'default'): Promise<ResetResult | SandboxError> => {
      const result = await send<{ type: 'reset' } & ResetResult>({ type: 'reset', slot });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'reset' } & ResetResult;
      return { portValues: r.portValues, peripheralState: r.peripheralState };
    },
    [send],
  );

  const setNode = useCallback(
    async (
      nodeId: string,
      value: number | Map<number, number>,
      slot: SimSlot = 'default',
      options?: { snapshot?: boolean },
    ): Promise<SetNodeResult | SandboxError> => {
      const result = await send<{ type: 'node-set' } & SetNodeResult>({
        type: 'set-node',
        nodeId,
        value,
        slot,
        snapshot: options?.snapshot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'node-set' } & SetNodeResult;
      return {
        portValues: r.portValues,
        peripheralState: r.peripheralState,
        snapshotId: r.snapshotId,
      };
    },
    [send],
  );

  const snapshot = useCallback(
    async (slot: SimSlot = 'default'): Promise<SnapshotResult | SandboxError> => {
      const result = await send<{ type: 'snapshotted' } & SnapshotResult>({
        type: 'snapshot',
        slot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'snapshotted' } & SnapshotResult;
      return { snapshotId: r.snapshotId };
    },
    [send],
  );

  const restore = useCallback(
    async (
      snapshotId: number,
      slot: SimSlot = 'default',
    ): Promise<RestoreResult | SandboxError> => {
      const result = await send<{ type: 'restored' } & RestoreResult>({
        type: 'restore',
        snapshotId,
        slot,
      });
      if ('error' in result) return result as SandboxError;
      const r = result as { type: 'restored' } & RestoreResult;
      return { portValues: r.portValues, cycle: r.cycle, peripheralState: r.peripheralState };
    },
    [send],
  );

  const pruneSnapshots = useCallback(
    async (
      keepAfterId: number,
      slot: SimSlot = 'default',
    ): Promise<{ type: 'pruned' } | SandboxError> => {
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

  // Asking whether it's ready counts as using it: callers that wait for
  // readiness before their first request would otherwise wait forever.
  const isReady = useCallback(() => {
    ensureIframe();
    return stateRef.current.ready;
  }, [ensureIframe]);

  // One object per status, so consumers that depend on the handle don't
  // re-run their effects on every render of the component that owns it.
  return useMemo(
    () => ({
      status,
      compile,
      compileIR,
      tick,
      tickN,
      renderSamples,
      scanPort,
      reset,
      setNode,
      snapshot,
      restore,
      pruneSnapshots,
      dispose,
      isReady,
    }),
    [
      status,
      compile,
      compileIR,
      tick,
      tickN,
      renderSamples,
      scanPort,
      reset,
      setNode,
      snapshot,
      restore,
      pruneSnapshots,
      dispose,
      isReady,
    ],
  );
}
