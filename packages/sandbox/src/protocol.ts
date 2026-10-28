/**
 * Messages between the page, the sandbox iframe (`apps/sandbox/src/main.ts`,
 * the relay) and its worker (`apps/sandbox/src/worker.ts`), which runs all user
 * code and holds all simulation state. Every side imports these types, so a
 * change to one side that another doesn't handle is a type error.
 *
 * Two sets of messages share the channel until the old one is deleted:
 *
 * - Session messages (`SessionRequest`, `SessionResponse`): compiles and
 *   sessions named by ids the page makes up. `SandboxClient` and
 *   `SimulationClient` speak these; the worker's `SessionHost` answers them.
 * - Slot messages (`SandboxRequest`, `SandboxResponse`): the original protocol,
 *   still used by `@simten/ui`'s `useSandbox`. A request is a session request
 *   when it names a `session` or a `compile` (see `isSessionRequest`).
 *
 * Request types are verbs, response types are past tense, kebab-case.
 */

import type { CircuitIR, MemoryContents, PeripheralValue } from '@simten/core/internal';
import type { ExportResult, VerilogExportOptions } from '@simten/core/verilog';

/** An eval or onTick function sent as source text (compile-ir) and rebuilt with `new Function`. */
export interface BehaviorSource {
  evalSource: string;
  onTickSource?: string;
  inputNames: string[];
  outputNames: string[];
  stateKeys?: string[];
}

// ============================================================================
// Session messages
// ============================================================================

/** Made up by the page; unique per page. Names one compile in one sandbox. */
export type CompileId = string;
/** Made up by the page; unique per page. Names one running simulation in one sandbox. */
export type SessionId = string;

/** What a session looks like after a request, or in a pushed auto-run frame. */
export interface SessionUpdate {
  /** Clock cycles since the start or the last reset. */
  cycle: number;
  /** Every port value, keyed `nodePath.port` (top-level ports under `__top__`). */
  ports: Map<string, number>;
  /** State of nodes on a peripheral bus (screens, consoles, UARTs); absent when there are none. */
  peripherals?: Map<string, PeripheralValue>;
  /** Where the history cursor is. `{ length: 0, index: -1 }` with history off. */
  history: { length: number; index: number };
  isRunning: boolean;
}

/** Page → iframe → worker. */
export type SessionRequest =
  | { id: string; type: 'compile'; compile: CompileId; source: string }
  | {
      id: string;
      type: 'compile-ir';
      compile: CompileId;
      circuit: CircuitIR;
      libraryCircuits: CircuitIR[];
      behaviors: Record<string, BehaviorSource>;
    }
  | { id: string; type: 'release'; compile: CompileId }
  | {
      id: string;
      type: 'open';
      session: SessionId;
      compile: CompileId;
      /** The name given to `circuit(...)`. */
      circuit: string;
      /** Wrap the circuit in Switch/Input and Led/HexDisplay nodes. */
      harness?: boolean;
      initialInputs?: Record<string, number>;
      /** Cycles of history. */
      history: number;
      /** Memory contents by node path, loaded before cycle 0 and kept by reset. */
      memory?: Record<string, MemoryContents>;
    }
  | {
      id: string;
      type: 'export';
      compile: CompileId;
      circuit: string;
      options?: VerilogExportOptions;
    }
  | { id: string; type: 'set'; session: SessionId; values: Record<string, number> }
  | { id: string; type: 'set-input'; session: SessionId; path: string; value: number }
  | { id: string; type: 'tick'; session: SessionId; count: number }
  | { id: string; type: 'run'; session: SessionId; speed: number; frameRate: number }
  | { id: string; type: 'pause'; session: SessionId }
  | { id: string; type: 'step-back'; session: SessionId }
  | { id: string; type: 'step-forward'; session: SessionId }
  | { id: string; type: 'seek'; session: SessionId; index: number }
  | { id: string; type: 'reset'; session: SessionId }
  | {
      id: string;
      type: 'sample';
      session: SessionId;
      port: string;
      count: number;
      inputs?: Record<string, number>;
    }
  | { id: string; type: 'scan'; session: SessionId; path: string; port: string; count: number }
  | { id: string; type: 'close'; session: SessionId };

/** Why a request failed. `timed-out` and `restarted` come from the relay's watchdog. */
export type FailureCode = 'failed' | 'timed-out' | 'restarted';

/** Worker → iframe → page. */
export type SessionResponse =
  | {
      id: string;
      type: 'compiled';
      compile: CompileId;
      circuits: CircuitIR[];
      exported: CircuitIR[];
      libraryCircuits: CircuitIR[];
    }
  | { id: string; type: 'exported'; result: ExportResult }
  | { id: string; type: 'released' }
  | {
      id: string;
      type: 'opened';
      session: SessionId;
      /** The simulated circuit, harnessed if asked for. */
      circuit: CircuitIR;
      isSequential: boolean;
      state: SessionUpdate;
    }
  | {
      /** Absent on frames the worker pushes while auto-running. */
      id?: string;
      type: 'updated';
      session: SessionId;
      state: SessionUpdate;
      /** For `step-back`, `step-forward` and `seek`: whether the history cursor moved. */
      moved?: boolean;
    }
  | { id: string; type: 'sampled'; samples: number[]; state: SessionUpdate }
  | { id: string; type: 'scanned'; values: number[] }
  | { id: string; type: 'closed' }
  | { id: string; type: 'failed'; code: FailureCode; error: string };

/** Pushed by the relay after a watchdog restart has replayed every compile and session. */
export interface RestartedMessage {
  type: 'restarted';
  /** Sessions reopened at cycle 0. Each was sent a fresh `updated` frame first. */
  sessions: SessionId[];
  /** Sessions that couldn't be reopened. They no longer exist in the sandbox. */
  dropped: SessionId[];
  message: string;
}

/** The handshake the iframe sends once it can take requests. */
export interface ReadyMessage {
  type: 'ready';
}

/** Everything the page can receive from the sandbox iframe. */
export type SandboxMessage = SessionResponse | RestartedMessage | ReadyMessage | SandboxResponse;

/**
 * Worker → relay only: a sliced request is still making progress. Sent at most
 * once a second, so the watchdog measures whether the worker answers, not how
 * long a request takes. The relay doesn't forward it.
 */
export interface ProgressedMessage {
  type: 'progressed';
  id: string;
}

/** Everything the worker's session host sends. */
export type HostMessage = SessionResponse | ProgressedMessage;

/** A session request names a `session` or a `compile`; a slot request does neither. */
export function isSessionRequest(
  request: SandboxRequest | SessionRequest,
): request is SessionRequest {
  return 'session' in request || 'compile' in request;
}

// ============================================================================
// Slot messages (the original protocol, used by @simten/ui's useSandbox)
// ============================================================================

/** Slot ids are arbitrary strings; each slot is an independent simulation. */
export type SimSlot = string;

/**
 * State of nodes on a peripheral's bus, so the UI can render displays,
 * consoles, NIC FIFOs and so on. Only nodes tagged `meta.synthesizable: false`,
 * or wired directly to one, are included.
 */
export type PeripheralState = Record<string, unknown>;

type Inputs = Record<string, number | boolean>;

/** Page → iframe, slot protocol. */
export type SandboxRequest =
  | { id: string; type: 'compile'; source: string; slot?: SimSlot }
  | {
      id: string;
      type: 'compile-ir';
      circuit: CircuitIR;
      libraryCircuits: CircuitIR[];
      slot: SimSlot;
      evalSources?: Record<string, BehaviorSource>;
      snapshot?: boolean;
    }
  | { id: string; type: 'tick'; inputs?: Inputs; slot?: SimSlot; snapshot?: boolean }
  | { id: string; type: 'tick-n'; n: number; inputs?: Inputs; slot?: SimSlot; snapshot?: boolean }
  | {
      id: string;
      type: 'render-samples';
      portKey: string;
      count: number;
      inputs?: Inputs;
      slot?: SimSlot;
    }
  | {
      id: string;
      type: 'scan-port';
      addrNodeId: string;
      valuePortKey: string;
      count: number;
      slot?: SimSlot;
    }
  | { id: string; type: 'reset'; slot?: SimSlot }
  | {
      id: string;
      type: 'set-node';
      nodeId: string;
      value: number | boolean | Map<number, number>;
      slot?: SimSlot;
      snapshot?: boolean;
    }
  | { id: string; type: 'snapshot'; slot?: SimSlot }
  | { id: string; type: 'restore'; snapshotId: number; slot?: SimSlot }
  | { id: string; type: 'prune-snapshots'; keepAfterId: number; slot?: SimSlot }
  | { id: string; type: 'dispose'; slot: SimSlot };

export interface CompileResult {
  circuits: CircuitIR[];
  libraryCircuits: CircuitIR[];
  portValues: Record<string, number>;
  peripheralState?: PeripheralState;
}

export interface CompileIRResult {
  portValues: Record<string, number>;
  peripheralState?: PeripheralState;
  /** Snapshot of the initial state, when `{ snapshot: true }` was requested. */
  snapshotId?: number;
}

export interface TickResult {
  portValues: Record<string, number>;
  cycle: number;
  peripheralState?: PeripheralState;
  /** Snapshot id, when the tick was requested with `{ snapshot: true }`. */
  snapshotId?: number;
}

export interface ResetResult {
  portValues: Record<string, number>;
  peripheralState?: PeripheralState;
}

export interface SetNodeResult {
  portValues: Record<string, number>;
  peripheralState?: PeripheralState;
  /** Snapshot id, when `{ snapshot: true }` was passed. */
  snapshotId?: number;
}

export interface SnapshotResult {
  /** Undefined for combinational-only circuits (nothing to snapshot). */
  snapshotId?: number;
}

export interface RestoreResult {
  portValues: Record<string, number>;
  cycle: number;
  peripheralState?: PeripheralState;
}

/** A slot request that failed. `@simten/ui` exports it as `SandboxError`. */
export interface SlotErrorResult {
  type: 'error';
  error: string;
}

export type SandboxResult =
  | ({ type: 'compiled' } & CompileResult)
  | ({ type: 'compiled-ir' } & CompileIRResult)
  | ({ type: 'ticked' } & TickResult)
  | ({ type: 'ticked-n' } & TickResult)
  | { type: 'scanned-port'; values: number[] }
  | { type: 'rendered-samples'; samples: number[]; cycle: number }
  | ({ type: 'reset' } & ResetResult)
  | ({ type: 'node-set' } & SetNodeResult)
  | ({ type: 'snapshotted' } & SnapshotResult)
  | ({ type: 'restored' } & RestoreResult)
  | { type: 'pruned' }
  | { type: 'disposed' }
  | SlotErrorResult;

/** Every slot response carries the id of the request it answers. */
export type SandboxResponse = SandboxResult & { id: string };

// ============================================================================
// Iframe ↔ worker
// ============================================================================

/**
 * The iframe's main thread only relays: the worker handles every page request
 * and its responses go back to the page unchanged, except `progressed`.
 */
export type WorkerRequest = SandboxRequest | SessionRequest;
export type WorkerResponse = SandboxResponse | HostMessage;
