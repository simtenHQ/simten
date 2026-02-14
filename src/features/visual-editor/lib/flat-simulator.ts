/**
 * Flat Circuit Simulator
 *
 * Simulates flattened circuits (primitives only).
 * This is MUCH simpler than the hierarchical simulator because:
 * - No recursive composite evaluation
 * - No scope remapping
 * - No prefix stripping/adding
 * - State keys match node IDs exactly
 */

import type { BitValue, BusValue } from '../types/ir-v0.1';
import type { PrimitiveState, ClockEdges } from './primitive-interface';
import type { FlatCircuit, FlatNode } from './elaboration';
import { getPrimitiveEvaluator, PRIMITIVE_DEFINITIONS } from './primitives';
import { TOP_LEVEL_NODE } from './elaboration';
import { useComponentLibraryStore, type ComponentLibraryStore } from '../stores/component-library-store';
import { useMemoryDataStore } from '../stores/memory-data-store';
import { EventQueue } from './event-queue';

/**
 * Port value storage using full paths
 * Key format: "nodeId.portName" (e.g., "cpu.alu.adder1.out")
 * Top-level ports use TOP_LEVEL_NODE: "__top__.inputA"
 */
export type FlatPortValueMap = Map<string, BitValue | BusValue>;

/**
 * Sequential state for flat circuits
 * State keys are full paths (e.g., "cpu.alu.reg1")
 */
export interface FlatSequentialState {
  // Node state: full path -> current state value
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;

  // Clock signals: "fullPath.clockName" -> edge
  clocks: Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>;

  // Simulation cycle counter
  cycleCount: number;
}

/**
 * Simulation result
 */
export interface FlatSimulationResult {
  portValues: FlatPortValueMap;
  sequentialState?: FlatSequentialState;
  error?: string;
}

/**
 * Create port key from node ID and port name
 */
function portKey(nodeId: string, portName: string): string {
  return `${nodeId}.${portName}`;
}

/**
 * Initialize sequential state for all stateful primitives in flat circuit
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

  const library = useComponentLibraryStore.getState();

  for (const node of flatCircuit.nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const stateBlock = component.state[0];

      // Check for instance-specific initial value in node.arguments
      let initialValue = stateBlock.initialValue;

      if ('initial' in node.arguments && node.arguments.initial !== undefined) {
        // Register/DFlipFlop initial value
        initialValue = node.arguments.initial as number | boolean;
      } else if ('init' in node.arguments && node.arguments.init !== undefined) {
        // RAM initial values (array or object)
        const initData = node.arguments.init;
        const memory = new Map<number, number>();

        if (Array.isArray(initData)) {
          initData.forEach((value, index) => {
            if (typeof value === 'number') {
              memory.set(index, value);
            }
          });
        } else if (typeof initData === 'object') {
          for (const [key, value] of Object.entries(initData)) {
            const addr = parseInt(key, 10);
            if (!isNaN(addr) && typeof value === 'number') {
              memory.set(addr, value);
            }
          }
        }

        initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
      } else if (node.primitiveType === 'ROM') {
        // ROM initialization - check for DSL-embedded data first, then runtime-loaded data
        const memory = new Map<number, number>();

        // 1. Check for DSL-embedded data (node.arguments.data)
        if ('data' in node.arguments && node.arguments.data) {
          const dslData = node.arguments.data as Record<string, number>;
          for (const [key, value] of Object.entries(dslData)) {
            const addr = parseInt(key, 10);
            if (!isNaN(addr) && typeof value === 'number') {
              memory.set(addr, value);
            }
          }
        }

        // 2. Check for runtime-loaded data from memory store
        // Runtime data takes precedence (allows patching DSL-embedded ROMs)
        const loadedData = useMemoryDataStore.getState().getDataForNode(node.id);
        if (loadedData) {
          // Runtime data is at internal addresses (0, 1, 2, ...)
          // Merge into memory (overwrites DSL data for same addresses)
          for (const [addr, value] of loadedData.entries()) {
            memory.set(addr, value);
          }
        }

        initialValue = { data: memory, addressWidth: 16, dataWidth: 8 };
      }

      // Convert StateValue to PrimitiveState
      let primitiveState: PrimitiveState;
      if (typeof initialValue === 'object' && 'data' in initialValue) {
        primitiveState = initialValue.data;
      } else if (typeof initialValue === 'string') {
        // Console state is a string
        primitiveState = initialValue;
      } else {
        primitiveState = initialValue as BitValue | BusValue;
      }

      currentState.set(node.id, primitiveState);
      nextState.set(node.id, primitiveState);
    }

    // Initialize clocks
    for (const clock of node.clocks) {
      clocks.set(portKey(node.id, clock.name), {
        value: false,
        edge: 'none'
      });
    }

  }

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0
  };
}

/**
 * Get input values for a flat node using precomputed inputSources.
 * O(inputs) instead of O(connections) - much faster for large circuits.
 */
function getNodeInputsFast(
  node: FlatNode,
  portValues: FlatPortValueMap
): Map<string, BitValue | BusValue> {
  const inputs = new Map<string, BitValue | BusValue>();

  // O(inputSources) - typically 1-4 per node
  for (const src of node.inputSources) {
    const key = portKey(src.sourceNodeId, src.sourcePortName);
    const value = portValues.get(key);
    if (value !== undefined) {
      inputs.set(src.portName, value);
    }
  }

  // Provide default values for unconnected inputs
  // Sequential nodes (registers, etc.) only use their inputs during sequential update,
  // not during combinational evaluation, so they don't need defaults here.
  const primitiveDef = PRIMITIVE_DEFINITIONS[node.primitiveType];
  const isStateOnly = primitiveDef?.outputDependency === 'state-only';
  const hasState = primitiveDef?.state && primitiveDef.state.length > 0;

  if (!isStateOnly && !hasState) {
    for (const inputPort of node.inputs) {
      if (!inputs.has(inputPort.name)) {
        // Provide sensible default: false for Bit, 0 for Bus
        // Many primitives (like Adder's carry_in) expect optional inputs with defaults
        const defaultValue = inputPort.portType.kind === 'bit' ? false : 0;
        inputs.set(inputPort.name, defaultValue);
      }
    }
  }

  return inputs;
}

/**
 * Check if a node is a "state-output" node (outputs depend only on state, not inputs).
 * Examples: DFlipFlop, Register - their Q output reflects current state.
 */
function isStateOutputNode(node: FlatNode, library: ComponentLibraryStore): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;
  return component.metadata?.outputDependency === 'state-only';
}

/**
 * Check if a node is a "source" node (no input ports, only outputs).
 * Examples: Constant, Switch, Button, Input.
 */
function isSourceNode(node: FlatNode): boolean {
  return node.inputs.length === 0;
}

/**
 * Maximum iterations before assuming a feedback loop is unstable.
 */
const MAX_PROPAGATION_ITERATIONS = 10000;

/**
 * Propagate value changes through the circuit using event-driven approach.
 * Only evaluates nodes that are in the queue (nodes whose inputs may have changed).
 *
 * Returns the number of node evaluations performed (for performance monitoring).
 */
function propagate(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  portValues: FlatPortValueMap,
  seqState: FlatSequentialState | undefined,
  _library: ComponentLibraryStore
): number {
  let evaluationCount = 0;

  while (!eventQueue.isEmpty()) {
    if (++evaluationCount > MAX_PROPAGATION_ITERATIONS) {
      throw new Error(
        `Propagation did not stabilize after ${MAX_PROPAGATION_ITERATIONS} iterations. ` +
        `Possible unstable feedback loop in circuit.`
      );
    }

    const nodeId = eventQueue.dequeue()!;
    const node = flatCircuit.nodeMap.get(nodeId);
    if (!node) continue;

    // O(inputs) lookup using precomputed inputSources
    const inputs = getNodeInputsFast(node, portValues);

    // Store input values in portValues (for debugging/visualization)
    for (const [portName, value] of inputs.entries()) {
      portValues.set(portKey(nodeId, portName), value);
    }

    // Evaluate node
    const newOutputs = evaluateFlatNode(node, inputs, seqState);

    // Check for changes and propagate to dependents
    let anyChanged = false;
    for (const [portName, newValue] of newOutputs.entries()) {
      const key = portKey(nodeId, portName);
      const oldValue = portValues.get(key);

      // Compare values - handle both primitive and complex values
      if (!valuesEqual(oldValue, newValue)) {
        portValues.set(key, newValue);
        anyChanged = true;
      }
    }

    // If any output changed, enqueue all dependent nodes
    if (anyChanged) {
      eventQueue.enqueueAll(node.dependents);
    }
  }

  return evaluationCount;
}

/**
 * Compare two values for equality.
 * Handles BitValue (boolean), BusValue (number), and undefined.
 */
function valuesEqual(
  a: BitValue | BusValue | undefined,
  b: BitValue | BusValue | undefined
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  // Both are defined and not strictly equal
  return false;
}

/**
 * Seed the event queue with initial nodes for full evaluation.
 * Includes source nodes (no inputs), state-output nodes, and nodes
 * that have inputs from top-level (circuit inputs).
 */
function seedInitialQueue(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  library: ComponentLibraryStore
): void {
  for (const node of flatCircuit.nodes) {
    if (isSourceNode(node) || isStateOutputNode(node, library)) {
      eventQueue.enqueue(node.id);
      continue;
    }

    // Also seed nodes that have top-level inputs
    // (these are circuit inputs, not Switch nodes)
    for (const src of node.inputSources) {
      if (src.sourceNodeId === TOP_LEVEL_NODE) {
        eventQueue.enqueue(node.id);
        break;
      }
    }
  }
}

/**
 * Seed the event queue with state-output nodes only.
 * Used after state commit to propagate new register values.
 */
function seedStateOutputNodes(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  library: ComponentLibraryStore
): void {
  for (const node of flatCircuit.nodes) {
    if (isStateOutputNode(node, library)) {
      eventQueue.enqueue(node.id);
    }
  }
}

/**
 * Propagate values to top-level outputs.
 * Finds connections targeting TOP_LEVEL_NODE and copies values.
 */
function propagateToTopLevelOutputs(
  flatCircuit: FlatCircuit,
  portValues: FlatPortValueMap
): void {
  for (const conn of flatCircuit.connections) {
    if (conn.target.nodeId === TOP_LEVEL_NODE || conn.target.nodeId === '') {
      const sourceKey = portKey(conn.source.nodeId, conn.source.portName);
      const targetKey = portKey(conn.target.nodeId || TOP_LEVEL_NODE, conn.target.portName);
      const sourceValue = portValues.get(sourceKey);
      if (sourceValue !== undefined) {
        portValues.set(targetKey, sourceValue);
      }
    }
  }
}

/**
 * Evaluate a single flat node (always a primitive)
 */
function evaluateFlatNode(
  node: FlatNode,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: FlatSequentialState
): Map<string, BitValue | BusValue> {
  // Special handling for source components
  if (node.primitiveType === 'Switch' || node.primitiveType === 'Button') {
    const value = Boolean(node.arguments.value ?? false);
    return new Map([['out', value]]);
  }

  if (node.primitiveType === 'Input') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  if (node.primitiveType === 'Constant') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  // General mechanism: pass all node arguments to evaluate function with __ prefix
  if (node.arguments && Object.keys(node.arguments).length > 0) {
    const extendedInputs = new Map(inputs);
    for (const [key, value] of Object.entries(node.arguments)) {
      extendedInputs.set(`__${key}`, value as any);
    }
    inputs = extendedInputs;
  }

  const evaluator = getPrimitiveEvaluator(node.primitiveType);

  if (!evaluator) {
    console.warn(`No evaluator found for primitive: ${node.primitiveType}`);
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of node.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Get current state (using full path as key - no scope remapping!)
  const currentState = seqState?.currentState.get(node.id);

  // Evaluate primitive
  const outputs = evaluator.evaluate(inputs, currentState);

  return outputs;
}

/**
 * Run flat combinational simulation using event-driven propagation.
 * O(K) where K = nodes that actually change, instead of O(N) for all nodes.
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Optional sequential state for stateful components
 * @param initialPortValues - Optional initial port values (e.g., from previous simulation)
 * @param changedNodeIds - Optional list of nodes that changed (for incremental updates)
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  seqState?: FlatSequentialState,
  initialPortValues?: FlatPortValueMap,
  changedNodeIds?: string[]
): FlatSimulationResult {
  const portValues: FlatPortValueMap = new Map();
  const library = useComponentLibraryStore.getState();
  const eventQueue = new EventQueue();

  // Copy initial port values (for top-level inputs)
  if (initialPortValues) {
    for (const [key, value] of initialPortValues.entries()) {
      portValues.set(key, value);
    }
  }

  // Initialize top-level inputs with default values if not provided
  for (const input of flatCircuit.topLevelInputs) {
    const inputKey = portKey(TOP_LEVEL_NODE, input.name);
    if (!portValues.has(inputKey)) {
      const defaultValue = input.portType.kind === 'bit' ? false : 0;
      portValues.set(inputKey, defaultValue);
    }
  }

  // Seed the event queue
  if (changedNodeIds && changedNodeIds.length > 0) {
    // Incremental update: only propagate from changed nodes
    eventQueue.enqueueAll(changedNodeIds);
  } else {
    // Full evaluation: seed with source nodes and state-output nodes
    seedInitialQueue(flatCircuit, eventQueue, library);
  }

  // Event-driven propagation
  try {
    propagate(flatCircuit, eventQueue, portValues, seqState, library);
  } catch (e) {
    return {
      portValues,
      sequentialState: seqState,
      error: e instanceof Error ? e.message : 'Unknown propagation error'
    };
  }

  // Propagate to top-level outputs
  propagateToTopLevelOutputs(flatCircuit, portValues);

  return {
    portValues,
    sequentialState: seqState
  };
}

/**
 * Update clock states for flat circuit
 * MUCH simpler - just iterate flat list, no recursion!
 */
function updateFlatClockStates(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState
): void {
  for (const node of flatCircuit.nodes) {
    for (const clockPort of node.clocks) {
      const clockKey = portKey(node.id, clockPort.name);
      const clockState = seqState.clocks.get(clockKey);
      if (!clockState) continue;

      // Always set rising edge on every tick (global clock)
      clockState.edge = 'rising';
      clockState.value = true;
    }
  }
}

/**
 * Update sequential states for flat circuit
 * Uses O(inputs) lookup via precomputed inputSources.
 */
function updateFlatSequentialStates(
  flatCircuit: FlatCircuit,
  portValues: FlatPortValueMap,
  seqState: FlatSequentialState
): void {
  const library = useComponentLibraryStore.getState();

  for (const node of flatCircuit.nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const evaluator = getPrimitiveEvaluator(node.primitiveType);
      if (!evaluator || !evaluator.updateState) continue;

      // Get node inputs using fast O(inputs) lookup
      const inputs = getNodeInputsFast(node, portValues);

      // Build clock edges map
      const clockEdges: ClockEdges = {};
      for (const clockPort of node.clocks) {
        const clockKey = portKey(node.id, clockPort.name);
        const clockState = seqState.clocks.get(clockKey);
        if (clockState) {
          clockEdges[clockPort.name] = clockState.edge;
        }
      }

      // Update state (using full path - no scope remapping!)
      const currentState = seqState.currentState.get(node.id);
      const nextState = evaluator.updateState(inputs, currentState, clockEdges);
      seqState.nextState.set(node.id, nextState);
    }
  }
}

/**
 * Commit next state to current state
 */
function commitFlatSequentialState(seqState: FlatSequentialState): void {
  // Copy next state to current state
  for (const [nodeId, value] of seqState.nextState.entries()) {
    if (value instanceof Map) {
      seqState.currentState.set(nodeId, new Map(value));
    } else {
      seqState.currentState.set(nodeId, value);
    }
  }

  // Copy current state to next state for next cycle
  for (const [nodeId, value] of seqState.currentState.entries()) {
    if (value instanceof Map) {
      seqState.nextState.set(nodeId, new Map(value));
    } else {
      seqState.nextState.set(nodeId, value);
    }
  }

  seqState.cycleCount++;
}

/**
 * Run full flat simulation tick (combinational + sequential phases)
 * Uses event-driven propagation for O(K) performance.
 *
 * Tick structure:
 * 1. Seed queue with source nodes and state-output nodes
 * 2. Propagate until stable (reads current register values)
 * 3. Clock HIGH - capture sequential inputs
 * 4. Commit state (nextState -> currentState)
 * 5. Seed queue with state-output nodes only
 * 6. Propagate again (registers output new values)
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param seqState - Sequential state (registers, etc.)
 * @param previousPortValues - Previous tick's port values (enables O(K) change detection)
 * @param inputValues - Optional map of input values to inject (key: "__top__.inputName")
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState,
  previousPortValues?: FlatPortValueMap,
  inputValues?: FlatPortValueMap
): FlatSimulationResult {
  const library = useComponentLibraryStore.getState();
  const eventQueue = new EventQueue();

  // Use previous port values if provided (enables inter-tick change detection)
  // Otherwise start fresh (first tick or reset)
  const portValues: FlatPortValueMap = previousPortValues
    ? new Map(previousPortValues)
    : new Map(inputValues ?? []);

  // Initialize top-level inputs with default values if not provided
  for (const input of flatCircuit.topLevelInputs) {
    const inputKey = portKey(TOP_LEVEL_NODE, input.name);
    if (!portValues.has(inputKey)) {
      const defaultValue = input.portType.kind === 'bit' ? false : 0;
      portValues.set(inputKey, defaultValue);
    }
  }

  // Phase 1: Seed with state-output nodes and source nodes
  seedInitialQueue(flatCircuit, eventQueue, library);

  try {
    propagate(flatCircuit, eventQueue, portValues, seqState, library);
  } catch (e) {
    return {
      portValues,
      sequentialState: seqState,
      error: e instanceof Error ? e.message : 'Unknown propagation error'
    };
  }

  // Phase 2: Clock HIGH
  updateFlatClockStates(flatCircuit, seqState);

  // Phase 3: Capture sequential inputs and compute next state
  updateFlatSequentialStates(flatCircuit, portValues, seqState);

  // Phase 4: Commit state
  commitFlatSequentialState(seqState);

  // Phase 5: Propagate new state values (only from state-output nodes)
  seedStateOutputNodes(flatCircuit, eventQueue, library);

  try {
    propagate(flatCircuit, eventQueue, portValues, seqState, library);
  } catch (e) {
    return {
      portValues,
      sequentialState: seqState,
      error: e instanceof Error ? e.message : 'Unknown propagation error'
    };
  }

  // Phase 6: Top-level outputs
  propagateToTopLevelOutputs(flatCircuit, portValues);

  return {
    portValues,
    sequentialState: seqState
  };
}
