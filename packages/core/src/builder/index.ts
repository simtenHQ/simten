/**
 * Builder API — public exports
 *
 * Usage:
 *   import { component, bit, bus } from '@turing-incomplete/core/builder'
 */

export { component } from './component.js';
export { bit, bus } from './bit-bus.js';
export { executeComponentCode, stripTypes, type ExecuteResult } from './execute.js';
export type {
  BuiltComponent,
  ComponentMeta,
  ComponentConfig,
  PortRef,
  ConnectionDef,
  ComponentShape,
  PortMap,
  StateShape,
  PortValues,
  ConnectArg,
} from './types.js';
