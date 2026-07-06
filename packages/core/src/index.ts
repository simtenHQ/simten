/**
 * @simten/core
 *
 * Pure-JS hardware circuit simulator and TypeScript circuit builder.
 * Zero browser dependencies — works in Node.js, Bun, Deno, and bundlers.
 */

// ============================================================================
// Core Types (canonical source of truth)
// ============================================================================

export type {
  ArgumentValue,
  BitType,
  BitValue,
  BusType,
  BusValue,
  Circuit,
  CircuitLibrary,
  CircuitMetadata,
  CircuitTiming,
  ClockDescriptor,
  ClockInstance,
  ClockState,
  Connection,
  Implementation,
  MemoryType,
  MemoryValue,
  MutableCircuitLibrary,
  Node,
  PortDescriptor,
  PortInstance,
  PortPath,
  PortType,
  StateBlock,
  StateValue,
  TestCase,
} from './types/circuit.js';

export {
  bitType,
  busType,
  createPortPath,
  getDefaultValue,
  isPortTypeCompatible,
  memoryType,
  portPathKey,
  TOP_LEVEL_NODE,
} from './types/circuit.js';

export type {
  CombinationalResult,
  FlatCircuit,
  FlatConnection,
  FlatNode,
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
  HierarchyNode,
  InitOptions,
  InputSource,
  PrimitiveState,
  SimulatorEngine,
  SimulatorMetrics,
  SimulatorSnapshot,
  TickMetrics,
  TickResult,
} from './types/simulator.js';

// ============================================================================
// Simulator (re-exported key functions)
// ============================================================================

export {
  createCircuitLibrary,
  createSimulator,
  createSimulatorFromCircuit,
  elaborate,
} from './simulator/index.js';

// ============================================================================
// Builder (TypeScript circuit API)
// ============================================================================

export { autoHarness } from './circuit/auto-harness.js';
export { bit, bus, mem, reg } from './circuit/bit-bus.js';
export { circuit } from './circuit/circuit.js';
export type { EvalEntry } from './circuit/eval-registry.js';
export {
  getAllCircuitEvals,
  getCircuitEval,
  registerCircuitEval,
} from './circuit/eval-registry.js';
export type { ExecuteResult } from './circuit/execute.js';
export { executeCircuitCode } from './circuit/execute.js';
export { isSequentialCircuit } from './circuit/is-sequential.js';
export type { BuiltCircuit, CircuitConfig } from './circuit/types.js';

// ============================================================================
// Analysis Types
// ============================================================================

// ============================================================================
// Standard Library (flat re-export)
// ============================================================================
//
// All stdlib components and helpers are also exposed at the root so that
// downstream code can `import { And, Or, ... } from '@simten/core'` and so
// that the bundled .d.ts shipped to Monaco is self-contained from a single
// root entrypoint. Subpath `@simten/core/std` continues to work for granular
// consumers.
export * from './std/index.js';

export type {
  SignalMetrics,
  SimulationTrace,
} from './types/analysis.js';
export {
  compressTrace,
  detectSteadyState,
  getCircuitAPISummary,
} from './types/analysis.js';
