/**
 * DSL Type Definitions Module Exports
 */

// AST types
export * from './ast.js';

// Re-export IR types (they live in visual-editor for now)
export type {
  Circuit,
  PortDescriptor,
  ClockDescriptor,
  StateBlock,
  Node,
  Connection,
  PortPath,
  PortType,
  StateType,
  Implementation,
  Parameter,
  BitValue,
  BusValue,
  StateValue,
} from '../../types/circuit.js';

// Re-export ComponentLibrary from compiler
export type { ComponentLibrary } from '../compiler/ir-generator.js';
