/**
 * Core Flat Circuit Simulator
 *
 * Pure simulator engine that operates on flattened circuits.
 * This module has no browser/Zustand dependencies.
 *
 * Key differences from the UI version:
 * - All dependencies (ComponentLibrary, memory data) are injected
 * - No calls to getState() on Zustand stores
 * - Pure functions that can run in Node.js, workers, or browsers
 */

import type {
  BitValue,
  BusValue,
  FlatCircuit,
  FlatNode,
  FlatPortValueMap,
  FlatSequentialState,
  FlatSimulationResult,
  ComponentLibrary,
  PrimitiveState,
} from './types';
import { TOP_LEVEL_NODE } from './types';
import type { ClockEdges } from './primitive-interface';
import { getPrimitiveEvaluator, PRIMITIVE_DEFINITIONS } from './primitives';
import { EventQueue } from './event-queue';

/**
 * Create port key from node ID and port name
 */
function portKey(nodeId: string, portName: string): string {
  return `${nodeId}.${portName}`;
}

/**
 * Initialize sequential state for all stateful primitives in flat circuit.
 *
 * @param flatCircuit - The flattened circuit
 * @param library - Component library for resolving component definitions
 * @param memoryData - Optional pre-loaded memory data (nodeId -> address -> value)
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit,
  library: ComponentLibrary,
  memoryData?: Map<string, Map<number, number>>
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

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

        // 2. Check for runtime-loaded data from injected memoryData
        // Runtime data takes precedence (allows patching DSL-embedded ROMs)
        if (memoryData) {
          const loadedData = getMemoryDataForNode(node.id, memoryData);
          if (loadedData) {
            // Runtime data overwrites DSL data for same addresses
            for (const [addr, value] of loadedData.entries()) {
              memory.set(addr, value);
            }
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
 * Helper to get memory data for a node from the injected memory data map.
 * Pattern matching: "rom" matches nodes like "system.mem_bus.rom"
 */
function getMemoryDataForNode(
  nodeId: string,
  memoryData: Map<string, Map<number, number>>
): Map<number, number> | undefined {
  for (const [pattern, data] of memoryData) {
    if (nodeId.toLowerCase().includes(pattern.toLowerCase())) {
      return data;
    }
  }
  return undefined;
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
  const primitiveDef = PRIMITIVE_DEFINITIONS[node.primitiveType];
  const isStateOnly = primitiveDef?.outputDependency === 'state-only';
  const hasState = primitiveDef?.state && primitiveDef.state.length > 0;

  if (!isStateOnly && !hasState) {
    for (const inputPort of node.inputs) {
      if (!inputs.has(inputPort.name)) {
        const defaultValue = inputPort.portType.kind === 'bit' ? false : 0;
        inputs.set(inputPort.name, defaultValue);
      }
    }
  }

  return inputs;
}

/**
 * Check if a node is a "state-output" node (outputs depend only on state, not inputs).
 */
function isStateOutputNode(node: FlatNode, library: ComponentLibrary): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;
  return component.metadata?.outputDependency === 'state-only';
}

/**
 * Check if a node is a "source" node (no input ports, only outputs).
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
 * Returns the number of node evaluations performed.
 */
function propagate(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  portValues: FlatPortValueMap,
  seqState: FlatSequentialState | undefined,
  _library: ComponentLibrary
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
 */
function valuesEqual(
  a: BitValue | BusValue | undefined,
  b: BitValue | BusValue | undefined
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return false;
}

/**
 * Seed the event queue with initial nodes for full evaluation.
 */
function seedInitialQueue(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  library: ComponentLibrary
): void {
  for (const node of flatCircuit.nodes) {
    if (isSourceNode(node) || isStateOutputNode(node, library)) {
      eventQueue.enqueue(node.id);
      continue;
    }

    // Also seed nodes that have top-level inputs
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
 */
function seedStateOutputNodes(
  flatCircuit: FlatCircuit,
  eventQueue: EventQueue,
  library: ComponentLibrary
): void {
  for (const node of flatCircuit.nodes) {
    if (isStateOutputNode(node, library)) {
      eventQueue.enqueue(node.id);
    }
  }
}

/**
 * Propagate values to top-level outputs.
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
      extendedInputs.set(`__${key}`, value as BitValue | BusValue);
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
 *
 * @param flatCircuit - The flattened circuit to simulate
 * @param library - Component library for resolving component definitions
 * @param seqState - Optional sequential state for stateful components
 * @param initialPortValues - Optional initial port values
 * @param changedNodeIds - Optional list of nodes that changed (for incremental updates)
 */
export function runFlatCombinationalSimulation(
  flatCircuit: FlatCircuit,
  library: ComponentLibrary,
  seqState?: FlatSequentialState,
  initialPortValues?: FlatPortValueMap,
  changedNodeIds?: string[]
): FlatSimulationResult {
  const portValues: FlatPortValueMap = new Map();
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
    eventQueue.enqueueAll(changedNodeIds);
  } else {
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
 */
function updateFlatSequentialStates(
  flatCircuit: FlatCircuit,
  portValues: FlatPortValueMap,
  seqState: FlatSequentialState,
  library: ComponentLibrary
): void {
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
 * Run full flat simulation tick (combinational + sequential phases).
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
 * @param library - Component library for resolving component definitions
 * @param previousPortValues - Previous tick's port values (enables O(K) change detection)
 * @param inputValues - Optional map of input values to inject
 */
export function runFlatSimulationTick(
  flatCircuit: FlatCircuit,
  seqState: FlatSequentialState,
  library: ComponentLibrary,
  previousPortValues?: FlatPortValueMap,
  inputValues?: FlatPortValueMap
): FlatSimulationResult & { metrics: { phase1Evals: number; phase2Evals: number; totalEvals: number } } {
  const eventQueue = new EventQueue();

  // Use previous port values if provided
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

  let phase1Evals = 0;
  try {
    phase1Evals = propagate(flatCircuit, eventQueue, portValues, seqState, library);
  } catch (e) {
    return {
      portValues,
      sequentialState: seqState,
      error: e instanceof Error ? e.message : 'Unknown propagation error',
      metrics: { phase1Evals: 0, phase2Evals: 0, totalEvals: 0 }
    };
  }

  // Phase 2: Clock HIGH
  updateFlatClockStates(flatCircuit, seqState);

  // Phase 3: Capture sequential inputs and compute next state
  updateFlatSequentialStates(flatCircuit, portValues, seqState, library);

  // Phase 4: Commit state
  commitFlatSequentialState(seqState);

  // Phase 5: Propagate new state values (only from state-output nodes)
  seedStateOutputNodes(flatCircuit, eventQueue, library);

  let phase2Evals = 0;
  try {
    phase2Evals = propagate(flatCircuit, eventQueue, portValues, seqState, library);
  } catch (e) {
    return {
      portValues,
      sequentialState: seqState,
      error: e instanceof Error ? e.message : 'Unknown propagation error',
      metrics: { phase1Evals, phase2Evals: 0, totalEvals: phase1Evals }
    };
  }

  // Phase 6: Top-level outputs
  propagateToTopLevelOutputs(flatCircuit, portValues);

  return {
    portValues,
    sequentialState: seqState,
    metrics: {
      phase1Evals,
      phase2Evals,
      totalEvals: phase1Evals + phase2Evals
    }
  };
}
