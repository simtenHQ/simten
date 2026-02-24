/**
 * Visual Editor Package Exports
 */

// Components
export * from './components';

// Stores
export * from './stores';

// Types
export * from './types';

// Utils (projection, auto-layout, reference-circuit-cache)
export * from './utils';

// Hooks
export * from './hooks/usePrimitivesInit';

// Simulation controller
export * from './simulation/use-simulation-controller';

// Lib: elaboration
export {
  elaborate,
  TOP_LEVEL_NODE,
  isFlatCircuit,
} from './lib/elaboration';
export type { FlatCircuit } from './lib/elaboration';

// Lib: flat-simulator
export type {
  FlatPortValueMap,
  FlatSequentialState,
} from './lib/flat-simulator';

// Lib: primitive-registry
export {
  getPrimitives,
  PRIMITIVES,
  generatePrimitives,
} from './lib/primitive-registry';

// Lib: testing
export { runTestbenchWithTrace } from './lib/testing/testbench-runner';

// Lib: adapt-store
export { adaptStoreToCompilerLibrary } from './lib/adapt-store';
