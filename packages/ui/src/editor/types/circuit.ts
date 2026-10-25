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

import type { PortPath } from '@simten/core';

// ── Re-exported from core: the IR proper ────────────────────────────────────

export type {
  ArgumentValue,
  BitType,
  BitValue,
  BusType,
  BusValue,
  Circuit,
  CircuitMetadata,
  ClockDescriptor,
  ClockInstance,
  ClockState,
  Connection,
  Implementation,
  Node,
  PortDescriptor,
  PortPath,
  PortType,
  StateBlock,
  StateValue,
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

type ParameterType = 'int' | 'string' | 'bool';

export interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
  options?: (number | string | boolean)[];
}

type ValidationErrorType =
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
