/**
 * The slot messages: the sandbox's first protocol, one simulator per slot
 * name, with history kept as snapshots the page names by id. Nothing in this
 * repo sends them any more.
 *
 * Kept: published @simten/embed 0.5.x / @simten/ui 0.15.x send these; removed
 * at the release with the sandbox.simten.dev route (decision 0008, #424). The
 * worker's slot handlers and the relay's slot replay go with them.
 */

import type { CircuitIR } from '@simten/core/internal';
import type { BehaviorSource, SessionRequest } from './protocol.js';

/** A session request names a `session` or a `compile`; a slot request does neither. */
export function isSessionRequest(
  request: SandboxRequest | SessionRequest,
): request is SessionRequest {
  return 'session' in request || 'compile' in request;
}

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

/** A slot request that failed. */
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
