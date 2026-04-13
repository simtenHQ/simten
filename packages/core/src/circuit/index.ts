/**
 * Circuit definition API — public exports
 *
 * Usage:
 *   import { circuit, bit, bus } from '@simten/core/circuit'
 */

export { circuit } from './circuit.js';
export { bit, bus } from './bit-bus.js';
export { executeCircuitCode, executeJsCode, stripTypes, type ExecuteResult } from './execute.js';
export { buildFromIR } from './build-from-ir.js';
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
