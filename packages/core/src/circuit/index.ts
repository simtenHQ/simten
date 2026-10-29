/**
 * The circuit() builder, exported from `@simten/core`:
 *
 *   import { circuit, bit, bus } from '@simten/core'
 *
 * It was also `@simten/core/circuit` until decision 0010 removed that entry.
 * Source saved with the old path still runs (the sandbox strips imports) and
 * still type-checks in the code editor, which keeps the path as an alias.
 */

export type { ArgumentValue, MemoryContents } from '../ir/circuit-ir.js';
export type { MemDecl, RegDecl } from './bit-bus.js';
export { bit, bus, mem, reg } from './bit-bus.js';
export type {
  Circuit,
  CircuitConfig,
  CircuitMeta,
  ConnectContext,
  ConnectionDef,
  Control,
  InputKey,
  NodeEntry,
  PortMap,
  PortValues,
  SinkPortRef,
  SourcePortRef,
  StateShape,
} from './builder-types.js';
export { circuit } from './circuit.js';
