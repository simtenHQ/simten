/**
 * Core Simulator Public API
 *
 * This is the main entry point for the pure simulator engine.
 * All exports from this module are environment-agnostic (no browser dependencies).
 *
 * Usage:
 * ```typescript
 * import { createSimulator, elaborate } from '@/core/simulator';
 *
 * const library = createComponentLibrary(primitives, composites);
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

  // Component library
  ComponentLibrary,

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
} from './types';

export { TOP_LEVEL_NODE, bitType, busType, memoryType } from './types';

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
} from './primitive-interface';

export {
  createCombinationalEvaluator,
  createSequentialEvaluator,
} from './primitive-interface';

// ============================================================================
// Primitive Exports
// ============================================================================

export {
  PRIMITIVE_DEFINITIONS,
  PRIMITIVE_EVALUATORS,
  PRIMITIVES,
  getPrimitives,
  getPrimitiveEvaluator,
  isPrimitive,
  getPrimitiveCircuit,
  generatePrimitives,
  generateEvaluators,
} from './primitives';

export type { CorePrimitiveDefinition } from './primitives';

// ============================================================================
// Elaboration Exports
// ============================================================================

export {
  elaborate,
  isFlatCircuit,
  topologicalSortFlat,
} from './elaboration';

// ============================================================================
// Flat Simulator Exports
// ============================================================================

export {
  initializeFlatSequentialState,
  runFlatCombinationalSimulation,
  runFlatSimulationTick,
} from './flat-simulator';

// ============================================================================
// Event Queue Export
// ============================================================================

export { EventQueue } from './event-queue';

// ============================================================================
// Numeric Simulator Exports (Phase 3 Performance Optimization)
// ============================================================================

export type { NumericCircuit, NumericSequentialState } from './numeric-types';
export { PRIMITIVE_TYPE_INDICES, PRIMITIVE_INDEX_TO_NAME } from './numeric-types';
export { NumericEventQueue } from './numeric-event-queue';
export type { NumericPortValues } from './numeric-values';
export { createNumericPortValues, resetChangeFlags, copyPortValues } from './numeric-values';
export { compileForSimulation, createNumericSequentialState, toFlatSequentialState } from './compile-circuit';
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
} from './fast-simulator';

// ============================================================================
// Simulator Engine Implementation
// ============================================================================

import type {
  FlatCircuit,
  FlatPortValueMap,
  FlatSequentialState,
  ComponentLibrary,
  SimulatorEngine,
  InitOptions,
  TickResult,
  CombinationalResult,
  SimulatorSnapshot,
  SimulatorMetrics,
  BitValue,
  BusValue,
  Circuit,
} from './types';
import { TOP_LEVEL_NODE } from './types';

import {
  initializeFlatSequentialState,
  runFlatCombinationalSimulation,
  runFlatSimulationTick,
} from './flat-simulator';

import { elaborate } from './elaboration';

// Fast simulator imports
import type { NumericCircuit, NumericSequentialState } from './numeric-types';
import type { NumericPortValues } from './numeric-values';
import { createNumericPortValues } from './numeric-values';
import { NumericEventQueue } from './numeric-event-queue';
import { compileForSimulation, createNumericSequentialState, toFlatSequentialState } from './compile-circuit';
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
} from './fast-simulator';

/**
 * Default simulator engine implementation.
 *
 * This is a pure implementation with no browser dependencies.
 * It can be used in Node.js, Web Workers, or browsers.
 */
class SimulatorEngineImpl implements SimulatorEngine {
  private flatCircuit: FlatCircuit | null = null;
  private options: InitOptions | null = null;
  private seqState: FlatSequentialState | null = null;
  private portValues: FlatPortValueMap = new Map();

  // Metrics
  private totalTicks = 0;
  private totalEvaluations = 0;

  initialize(circuit: FlatCircuit, options: InitOptions): void {
    this.flatCircuit = circuit;
    this.options = options;

    // Initialize sequential state
    this.seqState = initializeFlatSequentialState(
      circuit,
      options.componentLibrary,
      options.initialMemory
    );

    // Run initial combinational simulation
    const result = runFlatCombinationalSimulation(
      circuit,
      options.componentLibrary,
      this.seqState
    );

    this.portValues = result.portValues;
    this.totalTicks = 0;
    this.totalEvaluations = 0;
  }

  setInput(nodeId: string, portName: string, value: BitValue | BusValue): void {
    if (!this.flatCircuit) return;

    // Find the node and update its arguments
    const node = this.flatCircuit.nodes.find(
      n => n.id === nodeId || n.id.endsWith('.' + nodeId)
    );

    if (node) {
      node.arguments = { ...node.arguments, value };

      // Re-run combinational simulation if no sequential state
      if (!this.seqState && this.options) {
        const result = runFlatCombinationalSimulation(
          this.flatCircuit,
          this.options.componentLibrary,
          undefined,
          this.portValues,
          [node.id]
        );
        this.portValues = result.portValues;
      }
    }
  }

  setInputs(values: Map<string, BitValue | BusValue>): void {
    for (const [key, value] of values) {
      const [nodeId, portName] = key.split('.');
      this.setInput(nodeId, portName, value);
    }
  }

  tick(): TickResult {
    if (!this.flatCircuit || !this.options || !this.seqState) {
      throw new Error('Simulator not initialized');
    }

    const result = runFlatSimulationTick(
      this.flatCircuit,
      this.seqState,
      this.options.componentLibrary,
      this.portValues
    );

    this.portValues = result.portValues;
    this.seqState = result.sequentialState!;
    this.totalTicks++;
    this.totalEvaluations += result.metrics.totalEvals;

    return {
      portValues: result.portValues,
      sequentialState: this.seqState,
      metrics: result.metrics
    };
  }

  runCombinational(): CombinationalResult {
    if (!this.flatCircuit || !this.options) {
      throw new Error('Simulator not initialized');
    }

    const result = runFlatCombinationalSimulation(
      this.flatCircuit,
      this.options.componentLibrary,
      this.seqState ?? undefined
    );

    this.portValues = result.portValues;

    return {
      portValues: result.portValues,
      metrics: { totalEvals: 0 }, // Not tracked for combinational
      error: result.error
    };
  }

  getOutput(nodeId: string, portName: string): BitValue | BusValue | undefined {
    return this.portValues.get(`${nodeId}.${portName}`);
  }

  getPortValues(): ReadonlyMap<string, BitValue | BusValue> {
    return this.portValues;
  }

  getState(): FlatSequentialState | null {
    return this.seqState;
  }

  snapshot(): SimulatorSnapshot {
    if (!this.seqState) {
      throw new Error('No sequential state to snapshot');
    }

    return {
      portValues: new Map(this.portValues),
      sequentialState: {
        currentState: new Map(this.seqState.currentState),
        nextState: new Map(this.seqState.nextState),
        clocks: new Map(this.seqState.clocks),
        cycleCount: this.seqState.cycleCount
      },
      cycleCount: this.seqState.cycleCount
    };
  }

  restore(snapshot: SimulatorSnapshot): void {
    this.portValues = new Map(snapshot.portValues);
    this.seqState = {
      currentState: new Map(snapshot.sequentialState.currentState),
      nextState: new Map(snapshot.sequentialState.nextState),
      clocks: new Map(snapshot.sequentialState.clocks),
      cycleCount: snapshot.cycleCount
    };
  }

  reset(): void {
    if (!this.flatCircuit || !this.options) return;

    this.seqState = initializeFlatSequentialState(
      this.flatCircuit,
      this.options.componentLibrary,
      this.options.initialMemory
    );

    const result = runFlatCombinationalSimulation(
      this.flatCircuit,
      this.options.componentLibrary,
      this.seqState
    );

    this.portValues = result.portValues;
    this.totalTicks = 0;
    this.totalEvaluations = 0;
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

    // Initialize flat sequential state first (for proper state initialization)
    const flatSeqState = initializeFlatSequentialState(
      circuit,
      options.componentLibrary,
      options.initialMemory
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

  setInput(nodeId: string, portName: string, value: BitValue | BusValue): void {
    if (!this.flatCircuit || !this.numericCircuit) return;

    // Find the node and update its arguments
    const node = this.flatCircuit.nodes.find(
      n => n.id === nodeId || n.id.endsWith('.' + nodeId)
    );

    if (node) {
      node.arguments = { ...node.arguments, value };
      this.cacheValid = false;
    }
  }

  setInputs(values: Map<string, BitValue | BusValue>): void {
    for (const [key, value] of values) {
      const [nodeId, portName] = key.split('.');
      this.setInput(nodeId, portName, value);
    }
  }

  tick(): TickResult {
    if (!this.numericCircuit || !this.numericSeqState || !this.numericValues || !this.eventQueue) {
      throw new Error('Simulator not initialized');
    }

    // Phase 1: Seed with source and state-output nodes
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

    // Phase 4: Commit state
    commitSequentialState(this.numericSeqState);

    // Phase 5: Propagate new state values
    this.eventQueue.clear();
    seedStateOutputNodes(this.numericCircuit, this.eventQueue);

    const phase2Evals = fastPropagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs
    );

    const totalEvals = phase1Evals + phase2Evals;
    this.totalTicks++;
    this.totalEvaluations += totalEvals;
    this.cacheValid = false;

    // Convert to flat representation for API compatibility
    const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

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

    this.cacheValid = false;
    const portValues = toFlatPortValueMap(this.numericCircuit, this.numericValues, this.topLevelInputs);
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

    return {
      portValues,
      metrics: { totalEvals: 0 }
    };
  }

  getOutput(nodeId: string, portName: string): BitValue | BusValue | undefined {
    if (!this.numericCircuit || !this.numericValues) return undefined;

    const portKey = `${nodeId}.${portName}`;
    const portIdx = this.numericCircuit.portKeyToIndex.get(portKey);
    if (portIdx === undefined) return undefined;

    const isBit = this.numericCircuit.portIsBus[portIdx] === 0;
    const numVal = this.numericValues.values[portIdx];
    return isBit ? (numVal !== 0) : numVal;
  }

  getPortValues(): ReadonlyMap<string, BitValue | BusValue> {
    if (!this.numericCircuit || !this.numericValues) return new Map();

    if (!this.cacheValid) {
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
 * @param circuit - The flattened circuit to simulate
 * @param options - Initialization options
 * @param useFastSimulator - Use the fast numeric simulator (default: true)
 * @returns A new simulator engine instance
 */
export function createSimulator(
  circuit: FlatCircuit,
  options: InitOptions,
  useFastSimulator: boolean = true
): SimulatorEngine {
  const engine = useFastSimulator ? new FastSimulatorEngineImpl() : new SimulatorEngineImpl();
  engine.initialize(circuit, options);
  return engine;
}

/**
 * Create a simple component library from a list of circuits.
 *
 * This is a convenience function for creating a ComponentLibrary
 * from an array of Circuit definitions (e.g., primitives + composites).
 *
 * @param circuits - Array of circuit definitions
 * @returns A ComponentLibrary implementation
 */
export function createComponentLibrary(circuits: Circuit[]): ComponentLibrary {
  const circuitMap = new Map<string, Circuit>();

  for (const circuit of circuits) {
    circuitMap.set(circuit.name, circuit);
  }

  return {
    resolveComponent: (name: string) => circuitMap.get(name),
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
  library: ComponentLibrary,
  memoryData?: Map<string, Map<number, number>>
): SimulatorEngine {
  const flatCircuit = elaborate(circuit, library);
  return createSimulator(flatCircuit, {
    componentLibrary: library,
    initialMemory: memoryData
  });
}
