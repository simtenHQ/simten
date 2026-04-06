/**
 * Circuit definition API — public exports
 *
 * Usage:
 *   import { circuit, bit, bus } from '@turing-incomplete/core/circuit'
 */

export { circuit, component } from './circuit.js';
export { bit, bus } from './bit-bus.js';
export { executeCircuitCode, executeComponentCode, stripTypes, type ExecuteResult } from './execute.js';
export type {
  BuiltCircuit,
  BuiltComponent,
  CircuitMeta,
  ComponentMeta,
  CircuitConfig,
  ComponentConfig,
  CircuitShape,
  ComponentShape,
  PortRef,
  ConnectionDef,
  PortMap,
  StateShape,
  PortValues,
  ConnectArg,
} from './types.js';
