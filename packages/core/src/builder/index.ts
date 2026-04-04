/**
 * Builder API — public exports
 *
 * Usage:
 *   import { component, bit, bus } from '@turing-incomplete/core/builder'
 */

export { component, ComponentBuilder } from './component.js';
export { bit, bus } from './bit-bus.js';
export { executeCircuitCode, stripTypes, type ExecuteResult } from './execute.js';
export type {
  BuiltComponent,
  ComponentMeta,
  PortRef,
  ConnectionDef,
  ComponentShape,
  PortMap,
  NodesMap,
  ConnectFn,
  EvalFn,
  OnTickFn,
  StateShape,
  PortValues,
} from './types.js';
