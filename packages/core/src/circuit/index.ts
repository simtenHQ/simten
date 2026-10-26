/**
 * `@simten/core/circuit`: the circuit() builder.
 *
 *   import { circuit, bit, bus } from '@simten/core/circuit'
 *
 * The same names are exported from `@simten/core`.
 */

export type { MemState, RegState } from './bit-bus.js';
export { bit, bus, mem, reg } from './bit-bus.js';
export type {
  Circuit,
  CircuitConfig,
  CircuitMeta,
  ConnectArg,
  ConnectionDef,
  PortMap,
  PortValues,
  SinkPortRef,
  SourcePortRef,
  StateShape,
} from './builder-types.js';
export { circuit } from './circuit.js';
