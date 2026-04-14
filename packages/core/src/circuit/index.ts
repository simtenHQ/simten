/**
 * Circuit definition API — public exports
 *
 * Usage:
 *   import { circuit, bit, bus } from '@simten/core/circuit'
 */

export { circuit } from './circuit.js';
export { bit, bus, reg, mem } from './bit-bus.js';
export type { RegState, MemState, StateFieldType } from './bit-bus.js';
export { executeCircuitCode, executeJsCode, stripTypes, type ExecuteResult } from './execute.js';
export { buildFromIR } from './build-from-ir.js';
export { autoHarness } from './auto-harness.js';
export { isSequentialCircuit } from './is-sequential.js';
export { registerCircuitEval, getCircuitEval, getAllCircuitEvals } from './eval-registry.js';
export type { EvalEntry } from './eval-registry.js';
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
