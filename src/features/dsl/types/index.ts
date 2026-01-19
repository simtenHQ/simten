/**
 * DSL Type Definitions Module Exports
 */

// AST types
export * from './ast';

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
} from '../../visual-editor/types/ir-v0.1';

// Re-export ComponentLibrary from compiler
export type { ComponentLibrary } from '../compiler/ir-generator';
