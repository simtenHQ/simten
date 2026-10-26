/**
 * The simulator engine layer: elaboration, the numeric engine, sessions.
 *
 * Pure computation with no browser dependencies. The sandbox worker, the
 * canvas and the bench reach it through `@simten/core/internal`; users run
 * circuits with `simulate()` from `@simten/core`.
 *
 * ```typescript
 * const flat = elaborate(circuit, library);
 * const engine = createEngine(flat, { componentLibrary: library });
 * engine.setNode('switch1', 1);
 * const result = engine.tick();
 * ```
 *
 * See `apps/web/content/docs/architecture.mdx`, "Runtime topology".
 */

// Side-effect import: every primitive in std/* registers its eval lambda via
// circuit() at module init. After 2c586d9 deleted the hand-written numeric
// evaluators in simulator/evaluators/* that used to pre-populate EVALUATORS,
// std is the sole registration mechanism — importing the simulator now
// requires std to be loaded, or compile-circuit.ts throws "Primitive 'X' has
// no registered evaluator" on the first non-trivial circuit. The bare import
// here makes that dependency explicit and bundler-proof. (The sideEffects
// glob in packages/core/package.json still prevents intra-std DCE from
// dropping individual primitive declarations.)
import '../std/index.js';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  ArgumentValue,
  // Core types
  BitType,
  BitValue,
  BusType,
  BusValue,
  // Circuit types
  CircuitIR,
  // Circuit library
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
} from '../ir/circuit-ir.js';

export {
  bitType,
  busType,
  createPortPath,
  getDefaultValue,
  isPortTypeCompatible,
  memoryType,
  portPathKey,
  TOP_LEVEL_NODE,
} from '../ir/circuit-ir.js';

export type {
  CombinationalResult,
  // Flat circuit types
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
  // Simulator engine
  SimulatorEngine,
  SimulatorMetrics,
  SimulatorSnapshot,
  TickMetrics,
  TickResult,
} from './types.js';

// ============================================================================
// Simulation Session
// ============================================================================

export {
  captureEnvironmentalState,
  type EnvironmentalStateValue,
  restoreEnvironmentalState,
} from './environmental-state.js';
export type {
  SessionSnapshot,
  SimulationSessionOptions,
  SimulationSessionState,
} from './simulation-session.js';
export { SimulationSession } from './simulation-session.js';

// ============================================================================
// Primitive Interface Exports
// ============================================================================

export type {
  ClockEdges,
  EvaluationContext,
  InputValue,
  ParameterValue,
  PrimitiveEvaluator,
  SequentialState,
} from './primitive-interface.js';

export {
  createCombinationalEvaluator,
  createSequentialEvaluator,
} from './primitive-interface.js';

// ============================================================================
// Elaboration Exports
// ============================================================================

export {
  elaborate,
  isFlatCircuit,
  topologicalSortFlat,
} from './elaboration.js';

// ============================================================================
// Flat Simulator Exports
// ============================================================================

export { initializeFlatSequentialState } from './sequential-init.js';

// ============================================================================
// Numeric Simulator Exports (Performance Optimized)
// ============================================================================

export {
  compileForSimulation,
  createNumericSequentialState,
  toFlatSequentialState,
} from './compile-circuit.js';
// Recompiles a component's evaluator from its current registry entry. Running
// simulators dispatch through a shared table, so this changes them too.
export { ensureEvaluatorRegistered } from './eval-bridge.js';
export { NumericEventQueue } from './numeric-event-queue.js';
export type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
export { PRIMITIVE_INDEX_TO_NAME, PRIMITIVE_TYPE_INDICES } from './numeric-types.js';
export type { NumericPortValues } from './numeric-values.js';
export { copyPortValues, createNumericPortValues, resetChangeFlags } from './numeric-values.js';
export {
  commitSequentialState,
  fromFlatPortValueMap,
  propagate,
  propagateToTopLevelOutputs,
  seedInitialQueue,
  seedStateOutputNodes,
  setDebugStateUpdate,
  toFlatPortValueMap,
  updateSequentialStates,
} from './propagate.js';

export type { PropagationStep } from './trace.js';
export { tracePropagation } from './trace.js';

// ============================================================================
// Engine
// ============================================================================

export { createCircuitLibrary, createEngine } from './engine.js';
