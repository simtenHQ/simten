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
  createSimulatorFromCircuit,
  elaborate,
} from './simulator/index.js';

// ============================================================================
// Builder (TypeScript circuit API)
// ============================================================================

export { executeCircuitCode } from './circuit/execute.js';
export type { ExecuteResult } from './circuit/execute.js';
export { circuit } from './circuit/circuit.js';
export { bit, bus, reg, mem } from './circuit/bit-bus.js';
export type { BuiltCircuit, CircuitConfig } from './circuit/types.js';
export { autoHarness } from './circuit/auto-harness.js';
export { isSequentialCircuit } from './circuit/is-sequential.js';
export { getCircuitEval, registerCircuitEval, getAllCircuitEvals } from './circuit/eval-registry.js';
export type { EvalEntry } from './circuit/eval-registry.js';

// ============================================================================
// Analysis Types
// ============================================================================

export {
  buildEnvelope,
  compressTrace,
  detectSteadyState,
  getCircuitAPISummary,
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
