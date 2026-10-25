/**
 * Messages between the page (`useSandbox`), the sandbox iframe
 * (`apps/sandbox/src/main.ts`) and its worker (`apps/sandbox/src/worker.ts`).
 * Both sides import these types, so a change to one side that the other
 * doesn't handle is a type error.
 */

import type { Circuit } from '@simten/core';
import type { RLEValue } from '@simten/core/api';

/** Slot ids are arbitrary strings; each slot is an independent simulation. */
export type SimSlot = string;

/** An eval or onTick function sent as source text and rebuilt with `new Function`. */
export interface EvalSource {
  evalSource: string;
  onTickSource?: string;
  inputNames: string[];
  outputNames: string[];
  stateKeys?: string[];
}

/**
 * State of nodes on a peripheral's bus, so the UI can render displays,
 * consoles, NIC FIFOs and so on. Only nodes tagged `meta.synthesizable: false`,
 * or wired directly to one, are included.
 */
export type PeripheralState = Record<string, unknown>;

type Inputs = Record<string, number | boolean>;

// ── Page → iframe ───────────────────────────────────────────────────────────

export type SandboxRequest =
  | { id: string; type: 'compile'; source: string; slot?: SimSlot }
  | {
      id: string;
      type: 'compile-ir';
      circuit: Circuit;
      libraryCircuits: Circuit[];
      slot: SimSlot;
      evalSources?: Record<string, EvalSource>;
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
  | {
      id: string;
      type: 'simulate';
      source?: string;
      ticks: number;
      inputs?: Inputs;
      memoryData?: Record<string, Record<string, number>>;
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

// ── Iframe → page ───────────────────────────────────────────────────────────

export interface CompileResult {
  circuits: Circuit[];
  libraryCircuits: Circuit[];
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

export interface SimulateResult {
  circuitName: string;
  signals: Record<string, RLEValue[]>;
  vcd: string;
  ticks: number;
  steadyStateAt?: number;
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

export interface SandboxError {
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
  | ({ type: 'simulated' } & SimulateResult)
  | ({ type: 'reset' } & ResetResult)
  | ({ type: 'node-set' } & SetNodeResult)
  | ({ type: 'snapshotted' } & SnapshotResult)
  | ({ type: 'restored' } & RestoreResult)
  | { type: 'pruned' }
  | { type: 'disposed' }
  | SandboxError;

/** Every response carries the id of the request it answers. */
export type SandboxResponse = SandboxResult & { id: string };

// ── Iframe ↔ worker ─────────────────────────────────────────────────────────

export type WorkerRequest =
  | { id: string; type: 'compile'; source: string }
  | {
      id: string;
      type: 'simulate';
      source: string;
      ticks: number;
      inputs?: Inputs;
      memoryData?: Record<string, Record<string, number>>;
    };

export type WorkerResponse = { id: string } & (
  | {
      type: 'compiled';
      circuits: Circuit[];
      libraryCircuits: Circuit[];
      evalSources: Record<string, EvalSource>;
    }
  | ({ type: 'simulated' } & SimulateResult)
  | SandboxError
);
