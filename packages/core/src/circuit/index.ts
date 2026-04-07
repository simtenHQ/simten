/**
 * Circuit definition API — public exports
 *
 * Usage:
 *   import { circuit, bit, bus } from '@turing-incomplete/core/circuit'
 */

export { circuit } from './circuit.js';
export { bit, bus } from './bit-bus.js';
export { executeCircuitCode, stripTypes, type ExecuteResult } from './execute.js';
export type {
  BuiltCircuit,
  CircuitMeta,
  CircuitConfig,
  CircuitShape,
  PortRef,
  ConnectionDef,
  PortMap,
  StateShape,
  PortValues,
  ConnectArg,
} from './types.js';
