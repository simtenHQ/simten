/**
 * Circuit definition API — public exports
 *
 * Usage:
 *   import { circuit, bit, bus } from '@simten/core/circuit'
 */

export { autoHarness } from './auto-harness.js';
export type { MemState, RegState, StateFieldType } from './bit-bus.js';
export { bit, bus, mem, reg } from './bit-bus.js';
export { buildFromIR } from './build-from-ir.js';
export { circuit } from './circuit.js';
export { CircuitToSourceError, circuitToSource } from './circuit-to-source.js';
export type { EvalEntry } from './eval-registry.js';
export { getAllCircuitEvals, getCircuitEval, registerCircuitEval } from './eval-registry.js';
export { type ExecuteResult, executeCircuitCode, executeJsCode, stripTypes } from './execute.js';
export { isSequentialCircuit } from './is-sequential.js';
export type {
  BuiltCircuit,
  CircuitConfig,
  CircuitMeta,
  CircuitShape,
  ConnectArg,
  ConnectionDef,
  PortMap,
  PortRef,
  PortValues,
  SinkPortRef,
  SourcePortRef,
  StateShape,
} from './types.js';
