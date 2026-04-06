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
  CircuitLibrary,
  MutableCircuitLibrary,
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
  CircuitKind,
  ArgumentValue,
  TestCase,
  /** @deprecated aliases */
  ComponentLibrary,
  MutableComponentLibrary,
  ComponentKind,
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
  createCircuitLibrary,
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
// Builder (TypeScript circuit API)
// ============================================================================

export { executeCircuitCode, executeComponentCode } from './circuit/execute.js';
export type { ExecuteResult } from './circuit/execute.js';
export { circuit, component } from './circuit/circuit.js';
export { bit, bus } from './circuit/bit-bus.js';
export type { BuiltCircuit, CircuitConfig, BuiltComponent, ComponentConfig } from './circuit/types.js';

// ============================================================================
// Analysis Types (extracted from former DSL module)
// ============================================================================

export {
  buildEnvelope,
  compressTrace,
  detectSteadyState,
  getBuilderAPISummary,
} from './types/analysis.js';

export type {
  ValidationResult,
  ValidationSummary,
  ValidationPhase,
  DiagnosticCode,
  Diagnostic,
  AnalysisContext,
  CircuitMetrics,
  SimulationTrace,
  SignalMetrics,
  ComponentInterface,
  HardwareLLMEnvelope,
  EnvelopeValidation,
  EnvelopeDiagnostic,
  BehavioralDiagnostic,
  CircuitDelta,
  BuildEnvelopeOptions,
} from './types/analysis.js';
