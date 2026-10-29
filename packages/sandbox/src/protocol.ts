/**
 * Messages between the page, the sandbox iframe (`apps/sandbox/src/main.ts`,
 * the relay) and its worker (`apps/sandbox/src/worker.ts`), which runs all user
 * code and holds all simulation state. Every side imports these types, so a
 * change to one side that another doesn't handle is a type error.
 *
 * Compiles and sessions are named by ids the page makes up. `SandboxClient`
 * and `SimulationClient` send these requests; the worker's `SessionHost`
 * answers them. The sandbox also still answers the older slot messages, which
 * are in `protocol-legacy.ts`.
 *
 * Request types are verbs, response types are past tense, kebab-case.
 *
 * The format is internal (decision 0010): pages use the clients, hosts use
 * `@simten/sandbox/host`. It is still exported as `@simten/sandbox/protocol`
 * because the sandbox app's legacy slot handlers need its types; that export
 * goes at the release, with them (#424).
 */

import type { CircuitIR, MemoryContents, PeripheralValue } from '@simten/core/internal';
import type { ExportResult, VerilogExportOptions } from '@simten/core/verilog';
import type { SandboxRequest, SandboxResponse } from './protocol-legacy.js';

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
  | {
      id: string;
      type: 'set';
      session: SessionId;
      /**
       * Values by input port name or by the path of a Switch or Input node, as
       * core's `Simulation.set` takes them. All are written before the circuit
       * settles; if any key doesn't resolve, none are.
       */
      values: Record<string, number>;
    }
  | {
      id: string;
      type: 'set-input';
      session: SessionId;
      /**
       * Values by Switch or Input node path. Kept: pages deployed before
       * decision 0010 send this instead of `set`; removed at the release, with
       * the slot messages (#424).
       */
      values: Record<string, number>;
    }
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
  | {
      id: string;
      type: 'scan';
      session: SessionId;
      /** The input to drive: a port name or a Switch or Input path, as `set` takes. */
      path: string;
      /** The port-map key to read after each value. */
      port: string;
      count: number;
    }
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
export type SandboxMessage = SessionResponse | RestartedMessage | ReadyMessage;

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

// ============================================================================
// Iframe ↔ worker
// ============================================================================

/**
 * The iframe's main thread only relays: the worker handles every page request
 * and its responses go back to the page unchanged, except `progressed`. Both
 * include the slot messages (`protocol-legacy.ts`).
 */
export type WorkerRequest = SessionRequest | SandboxRequest;
export type WorkerResponse = HostMessage | SandboxResponse;

export * from './protocol-legacy.js';
