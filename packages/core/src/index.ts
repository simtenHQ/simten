/**
 * @turing-incomplete/core
 *
 * Pure-JS hardware circuit simulator and DSL parser/compiler.
 * Zero browser dependencies — works in Node.js, Bun, Deno, and bundlers.
 */

// ============================================================================
// Core Types (canonical source of truth)
// ============================================================================

export type {
  BitType,
  BusType,
  PortType,
  BitValue,
  BusValue,
  ComponentLibrary,
  MutableComponentLibrary,
  Circuit,
  PortDescriptor,
  ClockDescriptor,
  ClockState,
  ClockInstance,
  StateBlock,
  StateValue,
  PortPath,
  Connection,
  Node,
  Parameter,
  Implementation,
  CircuitMetadata,
  MemoryType,
  MemoryValue,
  PortInstance,
  ComponentKind,
  ArgumentValue,
  TestCase,
} from './types/circuit.js';

export {
  TOP_LEVEL_NODE,
  bitType,
  busType,
  memoryType,
  createPortPath,
  portPathKey,
  isPortTypeCompatible,
  getDefaultValue,
} from './types/circuit.js';

export type {
  FlatCircuit,
  FlatNode,
  FlatConnection,
  HierarchyNode,
  InputSource,
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
  PrimitiveState,
  SimulatorEngine,
  InitOptions,
  TickResult,
  TickMetrics,
  CombinationalResult,
  SimulatorSnapshot,
  SimulatorMetrics,
} from './types/simulator.js';

// ============================================================================
// Simulator (re-exported key functions)
// ============================================================================

export {
  createSimulator,
  createComponentLibrary,
  createSimulatorFromCircuit,
  elaborate,
  getPrimitives,
  getPrimitiveEvaluator,
  isPrimitive,
  getPrimitiveCircuit,
  generatePrimitives,
  PRIMITIVE_DEFINITIONS,
} from './simulator/index.js';

// ============================================================================
// DSL (re-exported key functions)
// ============================================================================

export {
  parseDSL,
  parseDSLOrThrow,
  compileDSL,
  compileToIR,
  validateCircuit,
  isValid,
  canSimulate,
  buildEnvelope,
  simulateCircuit,
  analyzeCircuit,
  generateHarness,
  evaluateAssertions,
} from './dsl/index.js';

// Preprocessor (Node.js only)
export {
  preprocessDSL,
  createMapFileResolver,
  createNodeFileResolver,
} from './dsl/preprocessor-entry.js';
