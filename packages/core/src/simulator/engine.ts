/**
 * The default simulator engine and the factories that build one.
 *
 * `DefaultSimulatorEngine` implements `SimulatorEngine` with typed arrays and
 * numeric indices in the hot loop.
 */

import type {
  ArgumentValue,
  BitValue,
  BusValue,
  CircuitIR,
  CircuitLibrary,
} from '../ir/circuit-ir.js';
import { getDefaultValue, TOP_LEVEL_NODE } from '../ir/circuit-ir.js';
import {
  compileForSimulation,
  createNumericSequentialState,
  toFlatSequentialState,
} from './compile-circuit.js';
import { NumericEventQueue } from './numeric-event-queue.js';
// Numeric simulator imports
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import { createNumericPortValues } from './numeric-values.js';
import {
  commitSequentialState,
  fromFlatPortValueMap,
  propagate,
  propagateToTopLevelOutputs,
  seedInitialQueue,
  seedStateOutputNodes,
  toFlatPortValueMap,
  updateSequentialStates,
} from './propagate.js';
import { initializeFlatSequentialState } from './sequential-init.js';
import type {
  CombinationalResult,
  FlatCircuit,
  FlatNode,
  FlatSequentialState,
  InitOptions,
  PrimitiveState,
  SimulatorEngine,
  SimulatorMetrics,
  SimulatorSnapshot,
  TickResult,
} from './types.js';

/**
 * Simulator engine implementation.
 *
 * Uses typed arrays and numeric indices in the hot loop for speed.
 * Implements the SimulatorEngine interface from types/simulator.ts.
 */
class DefaultSimulatorEngine implements SimulatorEngine {
  private flatCircuit: FlatCircuit | null = null;
  private options: InitOptions | null = null;

  // Compiled numeric circuit (computed once during initialization)
  private numericCircuit: NumericCircuit | null = null;

  // Numeric state (fast internal representation)
  private numericSeqState: NumericSequentialState | null = null;
  private numericValues: NumericPortValues | null = null;
  private eventQueue: NumericEventQueue | null = null;

  // Top-level input values (for API compatibility)
  private topLevelInputs: Map<string, BitValue | BusValue> = new Map();

  // Nodes whose `value` argument setNode has written (Switch, Input), with the
  // value each had before the first write. snapshot()/restore() carry these so
  // a rewind puts the switches back too.
  private originalNodeValues: Map<string, ArgumentValue | undefined> = new Map();
  private nodesById: Map<string, FlatNode> = new Map();

  // Cached flat state (lazily computed on getState())
  private cachedFlatSeqState: FlatSequentialState | null = null;
  private cachedPortValues: Map<string, BitValue | BusValue> | null = null;
  private cacheValid = false;

  // Metrics
  private totalTicks = 0;
  private totalEvaluations = 0;

  initialize(circuit: FlatCircuit, options: InitOptions): void {
    this.flatCircuit = circuit;
    this.options = options;

    // Compile circuit to numeric representation
    this.numericCircuit = compileForSimulation(
      circuit,
      options.componentLibrary,
      options.behaviours,
    );

    // Initialize flat sequential state (memory data loaded later via setNode)
    const flatSeqState = initializeFlatSequentialState(circuit, options.componentLibrary);

    // Convert to numeric sequential state
    this.numericSeqState = createNumericSequentialState(this.numericCircuit, flatSeqState);

    // Create numeric port values
    this.numericValues = createNumericPortValues(this.numericCircuit.portCount);

    // Create event queue
    this.eventQueue = new NumericEventQueue(this.numericCircuit.nodeCount);

    // Initialize top-level inputs
    this.topLevelInputs = new Map();
    this.originalNodeValues = new Map();
    this.nodesById = new Map(circuit.nodes.map((n) => [n.id, n]));
    for (const input of circuit.topLevelInputs) {
      const key = `${TOP_LEVEL_NODE}.${input.name}`;
      this.topLevelInputs.set(key, getDefaultValue(input.portType));
    }

    // Run initial propagation
    this.eventQueue.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue);
    propagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs,
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

    // Find the node — prefer exact ID match over suffix match
    // (suffix match can collide, e.g. switch "a" vs internal node "dut.a")
    const node =
      this.flatCircuit.nodes.find((n) => n.id === name) ??
      this.flatCircuit.nodes.find((n) => n.id.endsWith('.' + name));
    if (!node) return;

    // If it has sequential state (ROM, RAM, Register, DFlipFlop) → write state
    const idx = this.numericCircuit.nodeIdToIndex.get(node.id);
    if (
      idx !== undefined &&
      this.numericSeqState &&
      this.numericSeqState.currentState[idx] !== undefined
    ) {
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

    // Otherwise → write arguments (Switch, Input). `PrimitiveState` excludes
    // boolean, so callers pass 0/1; there is no coercion here on purpose.
    if (typeof value === 'number' || typeof value === 'string') {
      if (!this.originalNodeValues.has(node.id)) {
        this.originalNodeValues.set(node.id, node.arguments.value);
      }
      node.arguments = { ...node.arguments, value };
      this.cacheValid = false;
    }
  }

  tick(): TickResult {
    if (!this.numericCircuit || !this.numericSeqState || !this.numericValues || !this.eventQueue) {
      throw new Error('Simulator not initialized');
    }

    // Phase 1: Combinational evaluation from current (pre-edge) register state
    this.eventQueue.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue);

    const phase1Evals = propagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs,
    );

    // Phase 2: Capture sequential inputs and compute next state
    updateSequentialStates(
      this.numericCircuit,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs,
    );

    // Phase 3: Commit state (registers update)
    commitSequentialState(this.numericSeqState);

    // Phase 4: Full propagation with committed (post-edge) state
    this.eventQueue.clear();
    seedStateOutputNodes(this.numericCircuit, this.eventQueue);

    const phase2Evals = propagate(
      this.numericCircuit,
      this.eventQueue,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs,
    );

    // ── Observable snapshot: post-commit (Phase 4) ──
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
    const portValues = toFlatPortValueMap(
      this.numericCircuit,
      this.numericValues,
      this.topLevelInputs,
    );
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

    // Cache as the canonical observable state. getPortValues() and
    // getOutput() read from this cache until the next tick() or setNode().
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
        totalEvals,
      },
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
      propagate(
        this.numericCircuit,
        this.eventQueue,
        this.numericValues,
        this.numericSeqState ?? undefined,
        this.topLevelInputs,
      );
    } catch (e) {
      const portValues = toFlatPortValueMap(
        this.numericCircuit,
        this.numericValues,
        this.topLevelInputs,
      );
      return {
        portValues,
        metrics: { totalEvals: 0 },
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    const portValues = toFlatPortValueMap(
      this.numericCircuit,
      this.numericValues,
      this.topLevelInputs,
    );
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);

    // Cache the result so getPortValues() stays consistent
    this.cachedPortValues = portValues;
    this.cacheValid = true;

    return {
      portValues,
      metrics: { totalEvals: 0 },
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
      // After tick() runs, this branch is only hit if setNode()
      // invalidated the cache.
      this.cachedPortValues = toFlatPortValueMap(
        this.numericCircuit,
        this.numericValues,
        this.topLevelInputs,
      );
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

    const portValues = toFlatPortValueMap(
      this.numericCircuit,
      this.numericValues,
      this.topLevelInputs,
    );
    propagateToTopLevelOutputs(this.numericCircuit, this.numericValues, portValues);
    const seqState = toFlatSequentialState(this.numericCircuit, this.numericSeqState);

    const nodeValues = new Map<string, ArgumentValue | undefined>();
    for (const id of this.originalNodeValues.keys()) {
      nodeValues.set(id, this.nodesById.get(id)?.arguments.value);
    }

    return {
      portValues,
      sequentialState: seqState,
      cycleCount: this.numericSeqState.cycleCount,
      inputs: new Map(this.topLevelInputs),
      nodeValues,
    };
  }

  restore(snapshot: SimulatorSnapshot): void {
    if (!this.numericCircuit || !this.numericValues) return;

    // Restore what drives the circuit from outside: top-level inputs and the
    // values setNode wrote into Switch/Input arguments.
    if (snapshot.inputs) {
      for (const [key, value] of snapshot.inputs) {
        if (this.topLevelInputs.has(key)) this.topLevelInputs.set(key, value);
      }
    }
    if (snapshot.nodeValues) this.restoreNodeValues(snapshot.nodeValues);

    // Restore sequential state
    this.numericSeqState = createNumericSequentialState(
      this.numericCircuit,
      snapshot.sequentialState,
    );

    // Restore port values
    fromFlatPortValueMap(this.numericCircuit, this.numericValues, snapshot.portValues);

    this.cacheValid = false;
    // Force getState() to rebuild from the restored sequential state. cacheValid
    // is shared with getPortValues(); if a getPortValues() call lands between
    // this restore and the next getState() (as it does in the session's seekTo),
    // it re-validates cacheValid without rebuilding cachedFlatSeqState, so
    // getState() would otherwise hand back the pre-restore (latest) snapshot —
    // which is why memory/console state failed to rewind under time-travel while
    // registers (read via port values) rewound fine. The tick and reset paths
    // already null this; restore must too.
    this.cachedFlatSeqState = null;
  }

  /** A node written after the snapshot goes back to its value from before any write. */
  private restoreNodeValues(saved: ReadonlyMap<string, ArgumentValue | undefined>): void {
    for (const [id, original] of this.originalNodeValues) {
      const node = this.nodesById.get(id);
      if (!node) continue;
      const value = saved.has(id) ? saved.get(id) : original;
      const { value: _old, ...rest } = node.arguments;
      node.arguments = value === undefined ? rest : { ...rest, value };
    }
  }

  reset(): void {
    if (!this.flatCircuit || !this.options || !this.numericCircuit) return;

    // Re-initialize flat sequential state
    const flatSeqState = initializeFlatSequentialState(
      this.flatCircuit,
      this.options.componentLibrary,
      this.options.initialMemory,
    );

    // Convert to numeric
    this.numericSeqState = createNumericSequentialState(this.numericCircuit, flatSeqState);

    // Reset port values
    this.numericValues = createNumericPortValues(this.numericCircuit.portCount);

    // Re-run initial propagation
    this.eventQueue!.clear();
    seedInitialQueue(this.numericCircuit, this.eventQueue!);
    propagate(
      this.numericCircuit,
      this.eventQueue!,
      this.numericValues,
      this.numericSeqState,
      this.topLevelInputs,
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
      nodeCount: this.flatCircuit?.nodes.length ?? 0,
    };
  }
}

/**
 * Create a new simulator engine instance.
 *
 * Uses a numeric simulator with typed arrays for optimal performance.
 *
 * **Behaviour:** the engine runs `options.behaviours` and nothing else. Every
 * primitive type in the flattened circuit needs an entry there; `designOf`
 * collects the library and the table from a built circuit tree. A primitive
 * with no entry throws on its first dispatch, naming it.
 *
 * @param circuit - The flattened circuit to simulate
 * @param options - Initialization options
 * @returns A new simulator engine instance
 */
export function createEngine(circuit: FlatCircuit, options: InitOptions): SimulatorEngine {
  const engine = new DefaultSimulatorEngine();
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
export function createCircuitLibrary(circuits: CircuitIR[]): CircuitLibrary {
  const circuitMap = new Map<string, CircuitIR>();

  for (const circuit of circuits) {
    circuitMap.set(circuit.name, circuit);
  }

  return {
    resolveCircuit: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => {
      return Array.from(circuitMap.entries())
        .filter(([_, c]) => c.implementation.kind === 'primitive')
        .map(([name]) => name);
    },
  };
}
