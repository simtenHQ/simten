/**
 * Core Simulator Public API
 *
 * This is the main entry point for the pure simulator engine.
 * All exports from this module are environment-agnostic (no browser dependencies).
 *
 * Usage:
 * ```typescript
 * import { createSimulator, elaborate } from '@turing-incomplete/core/simulator';
 *
 * const library = createCircuitLibrary(primitives, composites);
 * const flatCircuit = elaborate(circuit, library);
 * const sim = createSimulator(flatCircuit, { componentLibrary: library });
 *
 * sim.setInput('switch1', 'out', true);
 * const result = sim.tick();
 * console.log(result.portValues);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  BitType,
  BusType,
  PortType,
  BitValue,
  BusValue,

  // Circuit library
  CircuitLibrary,
  MutableCircuitLibrary,

  // Circuit types
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
} from '../types/circuit.js';

export {
  TOP_LEVEL_NODE,
  bitType,
  busType,
  memoryType,
  createPortPath,
  portPathKey,
  isPortTypeCompatible,
  getDefaultValue,
} from '../types/circuit.js';

export type {
  // Flat circuit types
  FlatCircuit,
  FlatNode,
  FlatConnection,
  HierarchyNode,
  InputSource,
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
  PrimitiveState,

  // Simulator engine
  SimulatorEngine,
  InitOptions,
  TickResult,
  TickMetrics,
  CombinationalResult,
  SimulatorSnapshot,
  SimulatorMetrics,
} from '../types/simulator.js';

// ============================================================================
// Simulation Session
// ============================================================================

export { SimulationSession } from './simulation-session.js';

export {
  captureEnvironmentalState,
  restoreEnvironmentalState,
  type EnvironmentalStateValue,
} from './environmental-state.js';

export type {
  SessionSnapshot,
  SimulationSessionState,
  SimulationSessionOptions,
} from './simulation-session.js';

// ============================================================================
// Primitive Interface Exports
// ============================================================================

export type {
  PrimitiveEvaluator,
  InputValue,
  ClockEdges,
  ParameterValue,
  EvaluationContext,
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

export {
  initializeFlatSequentialState,
} from './sequential-init.js';

// ============================================================================
// Numeric Simulator Exports (Performance Optimized)
// ============================================================================

export type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
export { PRIMITIVE_TYPE_INDICES, PRIMITIVE_INDEX_TO_NAME } from './numeric-types.js';
export { NumericEventQueue } from './numeric-event-queue.js';
export type { NumericPortValues } from './numeric-values.js';
export { createNumericPortValues, resetChangeFlags, copyPortValues } from './numeric-values.js';
export { compileForSimulation, createNumericSequentialState, toFlatSequentialState } from './compile-circuit.js';
export {
  fastPropagate,
  seedInitialQueue,
  seedStateOutputNodes,
  updateClockStates,
  updateSequentialStates,
  commitSequentialState,
  toFlatPortValueMap,
  fromFlatPortValueMap,
  propagateToTopLevelOutputs,
} from './fast-simulator.js';

export type { PropagationStep } from './trace.js';
export { tracePropagation } from './trace.js';

// ============================================================================
// Simulator Engine Implementation
// ============================================================================

import type {
  FlatCircuit,
  FlatPortValueMap,
  FlatSequentialState,
  PrimitiveState,
  SimulatorEngine,
  InitOptions,
  TickResult,
  CombinationalResult,
  SimulatorSnapshot,
  SimulatorMetrics,
} from '../types/simulator.js';
import type {
  CircuitLibrary,
  BitValue,
  BusValue,
  Circuit,
} from '../types/circuit.js';
import { TOP_LEVEL_NODE } from '../types/circuit.js';

import {
  initializeFlatSequentialState,
} from './sequential-init.js';

import { elaborate } from './elaboration.js';

// Fast simulator imports
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import { createNumericPortValues } from './numeric-values.js';
import { NumericEventQueue } from './numeric-event-queue.js';
import { compileForSimulation, createNumericSequentialState, toFlatSequentialState } from './compile-circuit.js';
import {
  fastPropagate,
  seedInitialQueue,
  seedStateOutputNodes,
  updateClockStates,
  updateSequentialStates,
  commitSequentialState,
  toFlatPortValueMap,
  fromFlatPortValueMap,
  propagateToTopLevelOutputs,
} from './fast-simulator.js';

/**
 * Fast simulator engine implementation using numeric circuits.
 *
 * Uses typed arrays and numeric indices for 2-5x performance improvement.
 * Maintains API compatibility with SimulatorEngine interface.
 */
class FastSimulatorEngineImpl implements SimulatorEngine {
  private flatCircuit: FlatCircuit | null = null;
  private options: InitOptions | null = null;

  // Compiled numeric circuit (computed once during initialization)
  private numericCircuit: NumericCircuit | null = null;

  // Numeric state (fast internal representation)
  private numericSeqState: NumericSequentialState | null = null;
  private numericValues: NumericPortValues | null = null;
  private eventQueue: NumericEventQueue | null = null;

  // Top-level input values (for API compatibility)
  private topLevelInputs: FlatPortValueMap = new Map();

  // Cached flat state (lazily computed on getState())
  private cachedFlatSeqState: FlatSequentialState | null = null;
  private cachedPortValues: FlatPortValueMap | null = null;
  private cacheValid = false;


  // Metrics
  private totalTicks = 0;
  private totalEvaluations = 0;

  initialize(circuit: FlatCircuit, options: InitOptions): void {
    this.flatCircuit = circuit;
    this.options = options;

    // Compile circuit to numeric representation
    this.numericCircuit = compileForSimulation(circuit, options.componentLibrary);

    // Initialize flat sequential state (memory data loaded later via setNode)
    const flatSeqState = initializeFlatSequentialState(
      circuit,
      options.componentLibrary,
    );

    // Convert to numeric sequential state
    this.numericSeqState = createNumericSequentialState(this.numericCircuit, flatSeqState);

    // Create numeric port values
    this.numericValues = createNumericPortValues(this.numericCircuit.portCount);

    // Create event queue
    this.eventQueue = new NumericEventQueue(this.numericCircuit.nodeCount);

    // Initialize top-level inputs
    this.topLevelInputs = new Map();
    for (const input of circuit.topLevelInputs) {
      const key = `${TOP_LEVEL_NODE}.${input.name}`;
      const defaultValue = input.portType.kind === 'bit' ? false : 0;
      this.topLevelInputs.set(key, defaultValue);
    }

    // Run initial propagation
    this.eventQueue.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue);
    fastPropagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    this.totalTicks = 0;
    this.totalEvaluations = 0;
    this.cacheValid = false;

  }

  setNode(name: string, value: PrimitiveState): void {
    if (!this.flatCircuit || !this.numericCircuit) return;

    // First, check if this is a top-level input
    const topLevelKey = `${TOP_LEVEL_NODE}.${name}`;
    if (this.topLevelInputs.has(topLevelKey)) {
      this.topLevelInputs.set(topLevelKey, value as BitValue | BusValue);
      this.cacheValid = false;
      return;
    }

    // Find the node
    const node = this.flatCircuit.nodes.find(
      n => n.id === name || n.id.endsWith('.' + name)
    );
    if (!node) return;

    // If it has sequential state (ROM, RAM, Register, DFlipFlop) → write state
    const idx = this.numericCircuit.nodeIdToIndex.get(node.id);
    if (idx !== undefined && this.numericSeqState && this.numericSeqState.currentState[idx] !== undefined) {
      this.numericSeqState.currentState[idx] = value;
      this.cacheValid = false;

      this.cachedFlatSeqState = null; // force recomputation

      // Persist memory data so reset() preserves it (like flashing ROM)
      if (value instanceof Map && this.options) {
        if (!this.options.initialMemory) {
          this.options.initialMemory = new Map();
        }
        this.options.initialMemory.set(node.id, value as Map<number, number>);
      }
      return;
    }

    // Otherwise → write arguments (Switch, Input, Button)
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      node.arguments = { ...node.arguments, value };
      this.cacheValid = false;

    }
  }

  setInput(name: string, value: BitValue | BusValue): void {
    this.setNode(name, value);
  }

  setInputs(values: Map<string, BitValue | BusValue>): void {
    for (const [name, value] of values) {
      this.setInput(name, value);
    }
  }

  tick(): TickResult {
    if (!this.numericCircuit || !this.numericSeqState || !this.numericValues || !this.eventQueue) {
      throw new Error('Simulator not initialized');
    }

    // Phase 1: Combinational evaluation from current (pre-edge) register state
    this.eventQueue.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue);

    const phase1Evals = fastPropagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    // Phase 2: Clock HIGH
    updateClockStates(this.numericCircuit, this.numericSeqState);

    // Phase 3: Capture sequential inputs and compute next state
    updateSequentialStates(
      this.numericCircuit,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    // Phase 4: Commit state (registers update)
    commitSequentialState(this.numericSeqState);

    // Phase 5: Full propagation with committed (post-edge) state
    this.eventQueue.clear();
    seedStateOutputNodes(this.numericCircuit, this.eventQueue);

    const phase2Evals = fastPropagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    // ── Observable snapshot: post-commit (Phase 5) ──
    //
    // Each tick() = one completed clock cycle.
    // Returned values reflect the settled state AFTER the clock edge,
    // equivalent to Verilog: @(posedge clk); #1;
    //
    // This matches the intuitive "tick → see new value" mental model:
    //   counter starts at 0 → tick() → counter is now 1
    //
    // For pre-edge inspection (pipeline timing analysis), a future
    // tick({ phase: 1 }) option could expose the Phase 1 snapshot.
    const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

    // Cache as the canonical observable state. getPortValues() and
    // getOutput() read from this cache until the next tick() or setInput().
    this.cachedPortValues = portValues;
    this.cachedFlatSeqState = null; // Force recomputation on next getState()
    this.cacheValid = true;

    const totalEvals = phase1Evals + phase2Evals;
    this.totalTicks++;
    this.totalEvaluations += totalEvals;

    const seqState = toFlatSequentialState(this.numericCircuit, this.numericSeqState);

    return {
      portValues,
      sequentialState: seqState,
      metrics: {
        phase1Evals,
        phase2Evals,
        totalEvals
      }
    };
  }

  runCombinational(): CombinationalResult {
    if (!this.numericCircuit || !this.numericValues || !this.eventQueue) {
      throw new Error('Simulator not initialized');
    }

    // Nothing changed since last propagation — return cached result.
    if (this.cacheValid && this.cachedPortValues) {
      return { portValues: this.cachedPortValues, metrics: { totalEvals: 0 } };
    }

    this.eventQueue.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue);

    try {
      fastPropagate(
        this.numericCircuit,
        this.eventQueue,
        this.numericValues,
        this.numericSeqState ?? undefined,
        this.topLevelInputs
      );
    } catch (e) {
      const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
      return {
        portValues,
        metrics: { totalEvals: 0 },
        error: e instanceof Error ? e.message : 'Unknown error'
      };
    }

    const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

    // Cache the result so getPortValues() stays consistent
    this.cachedPortValues = portValues;
    this.cacheValid = true;

    return {
      portValues,
      metrics: { totalEvals: 0 }
    };
  }

  getOutput(nodeId: string, portName: string): BitValue | BusValue | undefined {
    if (!this.numericCircuit || !this.numericValues) return undefined;

    // Read from the cached post-commit snapshot for consistency
    // with tick() and getPortValues().
    const portValues = this.getPortValues();
    const portKey = `${nodeId}.${portName}`;
    return portValues.get(portKey);
  }

  getPortValues(): ReadonlyMap<string, BitValue | BusValue> {
    if (!this.numericCircuit || !this.numericValues) return new Map();

    if (!this.cacheValid) {
      // No tick has run yet — compute from current (initial) state.
      // After tick() runs, this branch is only hit if setInput()
      // invalidated the cache.
      this.cachedPortValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
      propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, this.cachedPortValues);
      this.cacheValid = true;
    }

    return this.cachedPortValues!;
  }

  getState(): FlatSequentialState | null {
    if (!this.numericCircuit || !this.numericSeqState) return null;

    if (!this.cacheValid || !this.cachedFlatSeqState) {
      this.cachedFlatSeqState = toFlatSequentialState(this.numericCircuit, this.numericSeqState);
    }

    return this.cachedFlatSeqState;
  }

  snapshot(): SimulatorSnapshot {
    if (!this.numericSeqState || !this.numericCircuit || !this.numericValues) {
      throw new Error('No sequential state to snapshot');
    }

    const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);
    const seqState = toFlatSequentialState(this.numericCircuit, this.numericSeqState);

    return {
      portValues,
      sequentialState: seqState,
      cycleCount: this.numericSeqState.cycleCount
    };
  }

  restore(snapshot: SimulatorSnapshot): void {
    if (!this.numericCircuit || !this.numericValues) return;

    // Restore sequential state
    this.numericSeqState = createNumericSequentialState(this.numericCircuit, snapshot.sequentialState);

    // Restore port values
    fromFlatPortValueMap(this.numericCircuit, this.numericValues, snapshot.portValues);

    this.cacheValid = false;

  }

  reset(): void {
    if (!this.flatCircuit || !this.options || !this.numericCircuit) return;

    // Re-initialize flat sequential state
    const flatSeqState = initializeFlatSequentialState(
      this.flatCircuit,
      this.options.componentLibrary,
      this.options.initialMemory
    );

    // Convert to numeric
    this.numericSeqState = createNumericSequentialState(this.numericCircuit, flatSeqState);

    // Reset port values
    this.numericValues = createNumericPortValues(this.numericCircuit.portCount);

    // Re-run initial propagation
    this.eventQueue!.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue!);
    fastPropagate(
      this.numericCircuit,
      this.eventQueue!,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    this.totalTicks = 0;
    this.totalEvaluations = 0;
    this.cacheValid = false;

  }

  getMetrics(): SimulatorMetrics {
    return {
      totalTicks: this.totalTicks,
      totalEvaluations: this.totalEvaluations,
      avgEvalsPerTick: this.totalTicks > 0 ? this.totalEvaluations / this.totalTicks : 0,
      nodeCount: this.flatCircuit?.nodes.length ?? 0
    };
  }
}

/**
 * Create a new simulator engine instance.
 *
 * Uses the fast numeric simulator with typed arrays for optimal performance.
 *
 * @param circuit - The flattened circuit to simulate
 * @param options - Initialization options
 * @returns A new simulator engine instance
 */
export function createSimulator(
  circuit: FlatCircuit,
  options: InitOptions
): SimulatorEngine {
  const engine = new FastSimulatorEngineImpl();
  engine.initialize(circuit, options);
  return engine;
}

/**
 * Create a simple circuit library from a list of circuits.
 *
 * This is a convenience function for creating a CircuitLibrary
 * from an array of Circuit definitions (e.g., primitives + composites).
 *
 * @param circuits - Array of circuit definitions
 * @returns A CircuitLibrary implementation
 */
export function createCircuitLibrary(circuits: Circuit[]): CircuitLibrary {
  const circuitMap = new Map<string, Circuit>();

  for (const circuit of circuits) {
    circuitMap.set(circuit.name, circuit);
  }

  return {
    resolveCircuit: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => {
      return Array.from(circuitMap.entries())
        .filter(([_, c]) => c.implementation.kind === 'primitive')
        .map(([name]) => name);
    }
  };
}

/**
 * Elaborate and create a simulator in one step.
 *
 * This is a convenience function that combines elaborate() and createSimulator().
 *
 * @param circuit - The hierarchical circuit to elaborate and simulate
 * @param library - Component library for resolving components
 * @param memoryData - Optional initial memory data
 * @returns A new simulator engine instance
 */
export function createSimulatorFromCircuit(
  circuit: Circuit,
  library: CircuitLibrary,
): SimulatorEngine {
  const flatCircuit = elaborate(circuit, library);
  return createSimulator(flatCircuit, {
    componentLibrary: library,
  });
}
