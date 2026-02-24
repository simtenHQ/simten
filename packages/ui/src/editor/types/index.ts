/**
 * Type Exports
 *
 * Central export point for all type definitions.
 */

// Circuit IR types (selective re-export to avoid conflicts with ui-model Connection/Component)
export type {
  BitType, BusType, PortType, PortDescriptor,
  BitValue, BusValue,
  ClockDescriptor, ClockState, ClockInstance,
  StateBlock, StateValue,
  PortPath, Node, Parameter, Implementation,
  CircuitMetadata, Circuit,
  ComponentKind, ValidationError,
} from './circuit';
export {
  createPortPath, portPathKey,
  isPortTypeCompatible, getDefaultValue,
  bitType, busType, memoryType,
} from './circuit';
export * from './ui-model';
export * from './visual';
export * from './ui';
export * from './testing';
