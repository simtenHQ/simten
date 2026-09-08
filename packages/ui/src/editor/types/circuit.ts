/**
 * Editor IR types.
 *
 * This file used to be a 350-line verbatim copy of `@simten/core`'s
 * `types/circuit.ts`. The copy was a real hazard rather than a stylistic one:
 * the two definitions were structurally identical but *nominally distinct*, so
 * a `Circuit` from here was not assignable to a `Circuit` from core, and every
 * change to the IR had to be made twice or the editor stores stopped compiling.
 *
 * Everything the IR defines now comes from core. What remains below is only the
 * handful of types that exist for the editor UI and have no core equivalent.
 */

import type { BitValue, BusValue, Circuit, ClockState, PortPath, StateValue } from '@simten/core';

// ── Re-exported from core: the IR proper ────────────────────────────────────

export type {
  ArgumentValue,
  BitType,
  BitValue,
  BusType,
  BusValue,
  Circuit,
  CircuitMetadata,
  // Core's name for what the editor has always called `ComponentKind`. Same
  // union — aliased rather than redefined so the two cannot drift apart.
  CircuitTiming as ComponentKind,
  ClockDescriptor,
  ClockInstance,
  ClockState,
  CompositeImpl,
  Connection,
  Implementation,
  IntrinsicImpl,
  MemoryType,
  MemoryValue,
  Node,
  PortDescriptor,
  PortInstance,
  PortPath,
  PortType,
  PrimitiveImpl,
  StateBlock,
  StateType,
  StateValue,
  TestCase,
} from '@simten/core';

export {
  bitType,
  busType,
  createPortPath,
  getDefaultValue,
  isPortTypeCompatible,
  memoryType,
  portPathKey,
} from '@simten/core';

// ── Editor-only: no core equivalent ─────────────────────────────────────────

export type ParameterType = 'int' | 'string' | 'bool';

export interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
  options?: (number | string | boolean)[];
}

export interface CircuitFile {
  version: string;
  circuit: Circuit;
}

export type ValidationErrorType =
  | 'type_mismatch'
  | 'multiple_drivers'
  | 'combinational_loop'
  | 'undefined_component'
  | 'undefined_port'
  | 'invalid_clock_ref'
  | 'parameter_mismatch'
  | 'missing_required_connection';

export interface ValidationError {
  type: ValidationErrorType;
  location: {
    circuitId: string;
    nodeId?: string;
    connectionId?: string;
    portPath?: PortPath;
  };
  message: string;
  suggestions?: string[];
}

export interface SimulationState {
  /** Current port values. */
  portValues: Map<string, BitValue | BusValue>;

  /** Current state values. */
  stateValues: Map<string, StateValue>;

  /** Clock states. */
  clockStates: Map<string, ClockState>;

  /** Simulation cycle counter. */
  cycle: number;

  /** Evaluation order (topologically sorted node IDs). */
  evaluationOrder: string[];
}
