/**
 * Type Exports
 *
 * Central export point for all type definitions.
 */

// Circuit IR types (selective re-export to avoid conflicts with ui-model Connection/Component)
export type {
  BitType,
  BitValue,
  BusType,
  BusValue,
  Circuit,
  CircuitMetadata,
  ClockDescriptor,
  ClockInstance,
  ClockState,
  Implementation,
  Node,
  Parameter,
  PortDescriptor,
  PortPath,
  PortType,
  StateBlock,
  StateValue,
  ValidationError,
} from './circuit';
export {
  bitType,
  busType,
  createPortPath,
  getDefaultValue,
  isPortTypeCompatible,
  memoryType,
  portPathKey,
} from './circuit';
export * from './testing';
export * from './ui';
export * from './ui-model';
export * from './visual';
