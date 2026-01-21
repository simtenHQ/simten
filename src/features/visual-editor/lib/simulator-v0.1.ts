/**
 * Circuit Simulator (IR v0.1)
 *
 * Executes circuit logic using the IR v0.1 format with name-based ports.
 * This replaces the legacy index-based simulator.
 *
 * Key differences from legacy simulator:
 * - Works with Circuit/Node instead of Component
 * - Uses name-based ports (PortPath) instead of index-based ports
 * - Cleaner port lookup (no index mapping needed)
 * - Direct integration with ComponentLibrary for resolving component specs
 */

import type {
  Circuit,
  Node,
  Connection,
  PortPath,
  BitValue,
  BusValue,
  ClockState,
} from '../types/ir-v0.1';
import type { ClockEdges, PrimitiveState } from './primitive-interface';
import { getPrimitiveEvaluator } from './primitives';
import { useComponentLibraryStore } from '../stores/component-library-store';

/**
 * Port value storage using PortPath keys
 * Key format: "nodeId.portName" (e.g., "and1.out", "switch1.out")
 * Circuit-level ports use empty nodeId: ".inputA", ".outputZ"
 */
export type PortValueMap = Map<string, BitValue | BusValue>;

/**
 * Sequential state for all stateful nodes
 */
export interface SequentialState {
  // Node state: nodeId -> current state value
  currentState: Map<string, PrimitiveState>;
  nextState: Map<string, PrimitiveState>;

  // Clock signals: nodeId.clockName -> clock state
  clocks: Map<string, ClockState>;

  // Simulation cycle counter
  cycleCount: number;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  portValues: PortValueMap;
  sequentialState?: SequentialState;
  error?: string;
}

/**
 * Create port key from PortPath
 */
function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Initialize sequential state for all stateful nodes
 */
export function initializeSequentialState(circuit: Circuit): SequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, ClockState>();

  const library = useComponentLibraryStore.getState();

  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    // Initialize state for nodes with state blocks
    if (componentDef.state.length > 0) {
      // Use first state block's initial value (most components have only one state block)
      const stateBlock = componentDef.state[0];
      const initialValue = stateBlock.initialValue;

      // Convert StateValue to PrimitiveState
      let primitiveState: PrimitiveState;
      if (typeof initialValue === 'object' && 'data' in initialValue) {
        // MemoryValue -> Map<number, number>
        primitiveState = initialValue.data;
      } else {
        // BitValue or BusValue
        primitiveState = initialValue as BitValue | BusValue;
      }

      currentState.set(node.id, primitiveState);
      nextState.set(node.id, primitiveState);
    }

    // Initialize clocks for nodes with clock inputs
    for (const clock of node.clocks) {
      const clockKey = `${node.id}.${clock.name}`;
      clocks.set(clockKey, {
        value: false,
        edge: 'none',
      });
    }
  }

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0,
  };
}

/**
 * Topological sort to determine evaluation order
 * Returns node IDs in dependency order, or null if cycle detected
 *
 * Sequential nodes are evaluated FIRST because their outputs come from
 * stored state, not computed from inputs.
 */
function topologicalSort(circuit: Circuit): string[] | null {
  const library = useComponentLibraryStore.getState();

  const sequentialNodes: string[] = [];
  const combinationalNodes: string[] = [];

  // Separate sequential and combinational nodes
  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    if (componentDef.state.length > 0) {
      sequentialNodes.push(node.id);
    } else {
      combinationalNodes.push(node.id);
    }
  }

  // Build dependency graph for combinational nodes only
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const nodeId of combinationalNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  // Build edges: for each connection, source -> target
  // Skip connections involving sequential nodes
  const nodeSet = new Set(combinationalNodes);

  for (const conn of circuit.connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    // Skip circuit-level ports (empty nodeId)
    if (source === '' || target === '') continue;

    // Only consider combinational nodes
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes that have no dependencies
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (result.length !== combinationalNodes.length) {
    return null; // Cycle detected
  }

  // Return sequential nodes FIRST, then combinational nodes
  return [...sequentialNodes, ...result];
}

/**
 * Get input values for a node from port values
 */
function getNodeInputs(
  node: Node,
  connections: Connection[],
  portValues: PortValueMap
): Map<string, BitValue | BusValue> {
  const inputs = new Map<string, BitValue | BusValue>();

  // Initialize all inputs to default values
  for (const inputPort of node.inputs) {
    inputs.set(inputPort.name, inputPort.portType.kind === 'bit' ? false : 0);
  }

  // Fill in actual values from connections
  for (const conn of connections) {
    if (conn.target.nodeId === node.id) {
      const sourceKey = portPathKey(conn.source);
      const value = portValues.get(sourceKey);
      if (value !== undefined) {
        inputs.set(conn.target.portName, value);
      }
    }
  }

  return inputs;
}

/**
 * Evaluate a single node
 */
function evaluateNode(
  node: Node,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: SequentialState
): Map<string, BitValue | BusValue> {
  // Special handling for source components (Switch, Input, Button)
  // These read their values from node.arguments, not from inputs
  if (node.componentRef === 'Switch' || node.componentRef === 'Button') {
    const value = Boolean(node.arguments.value ?? false);
    return new Map([['out', value]]);
  }

  if (node.componentRef === 'Input') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  const evaluator = getPrimitiveEvaluator(node.componentRef);

  if (!evaluator) {
    // No primitive evaluator - check if it's a composite component
    const library = useComponentLibraryStore.getState();
    const componentDef = library.resolveComponent(node.componentRef);

    if (componentDef && componentDef.implementation.kind === 'composite') {
      // Evaluate composite component by simulating its internal circuit
      return evaluateComposite(componentDef, inputs, seqState);
    }

    console.warn(`No evaluator found for component: ${node.componentRef}`);
    // Return default values for all outputs
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of node.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Get current state for sequential components
  const currentState = seqState?.currentState.get(node.id);

  // Evaluate
  return evaluator.evaluate(inputs, currentState);
}

/**
 * Evaluate a composite component by simulating its internal circuit
 */
function evaluateComposite(
  componentDef: Circuit,
  inputs: Map<string, BitValue | BusValue>,
  seqState?: SequentialState
): Map<string, BitValue | BusValue> {
  // Create initial port values with circuit-level inputs
  const initialPortValues: PortValueMap = new Map();

  // Map node inputs to circuit-level input ports
  for (const [inputName, inputValue] of inputs.entries()) {
    const inputKey = portPathKey({ nodeId: '', portName: inputName });
    initialPortValues.set(inputKey, inputValue);
  }

  // Simulate the internal circuit with initial input values
  const result = runCombinationalSimulation(componentDef, seqState, initialPortValues);

  if (result.error) {
    console.error(`Error simulating composite ${componentDef.name}:`, result.error);
    // Return default values
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of componentDef.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  // Extract outputs from the simulation result
  const outputs = new Map<string, BitValue | BusValue>();
  for (const outputPort of componentDef.outputs) {
    const outputKey = portPathKey({ nodeId: '', portName: outputPort.name });
    const outputValue = result.portValues.get(outputKey);
    outputs.set(
      outputPort.name,
      outputValue ?? (outputPort.portType.kind === 'bit' ? false : 0)
    );
  }

  return outputs;
}

/**
 * Update clock states and detect edges
 */
/**
 * Update clock states using GLOBAL CLOCK approach.
 * Each call to runSimulationTick represents one clock cycle,
 * so all clocks get a rising edge on each tick.
 *
 * This matches the behavior of Turing Complete and Logisim - users don't
 * wire clocks manually. The Step/Run/Pause buttons control the global clock.
 */
function updateClockStates(
  circuit: Circuit,
  seqState: SequentialState
): void {
  // Global clock: ALWAYS produce a rising edge on each tick
  // This means each call to runSimulationTick = one clock pulse
  for (const node of circuit.nodes) {
    for (const clockPort of node.clocks) {
      const clockKey = `${node.id}.${clockPort.name}`;
      const clockState = seqState.clocks.get(clockKey);
      if (!clockState) continue;

      // Always set rising edge on every tick
      // (The value doesn't matter for a global clock, only the edge matters)
      clockState.edge = 'rising';
      clockState.value = true; // Keep it high (doesn't affect behavior)
    }
  }
}

/**
 * Update sequential node states based on inputs and clock edges
 */
function updateSequentialStates(
  circuit: Circuit,
  portValues: PortValueMap,
  seqState: SequentialState
): void {
  const library = useComponentLibraryStore.getState();

  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef || componentDef.state.length === 0) continue;

    const evaluator = getPrimitiveEvaluator(node.componentRef);
    if (!evaluator || !evaluator.updateState) continue;

    // Get node inputs
    const inputs = getNodeInputs(node, circuit.connections, portValues);

    // Build clock edges map
    const clockEdges: ClockEdges = {};
    for (const clockPort of node.clocks) {
      const clockKey = `${node.id}.${clockPort.name}`;
      const clockState = seqState.clocks.get(clockKey);
      if (clockState) {
        clockEdges[clockPort.name] = clockState.edge;
      }
    }

    // Update state
    const currentState = seqState.currentState.get(node.id);
    const nextState = evaluator.updateState(inputs, currentState, clockEdges);
    seqState.nextState.set(node.id, nextState);
  }
}

/**
 * Commit next state to current state
 */
function commitSequentialState(seqState: SequentialState): void {
  // Copy next state to current state
  for (const [nodeId, value] of seqState.nextState.entries()) {
    if (value instanceof Map) {
      // Deep copy for Map (memory)
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
 * Run combinational simulation (single evaluation pass)
 */
export function runCombinationalSimulation(
  circuit: Circuit,
  seqState?: SequentialState,
  initialPortValues?: PortValueMap
): SimulationResult {
  const portValues: PortValueMap = new Map();

  // Copy initial port values (used for composite component inputs)
  if (initialPortValues) {
    for (const [key, value] of initialPortValues.entries()) {
      portValues.set(key, value);
    }
  }

  // Get evaluation order
  const evalOrder = topologicalSort(circuit);

  if (!evalOrder) {
    return {
      portValues,
      sequentialState: seqState,
      error: 'Cycle detected in circuit',
    };
  }

  // Build node lookup map
  const nodeMap = new Map(circuit.nodes.map((n) => [n.id, n]));

  // Evaluate each node in dependency order
  for (const nodeId of evalOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Get input values
    const inputs = getNodeInputs(node, circuit.connections, portValues);

    // Store input values in portValues (needed for LED and other output components)
    for (const [portName, value] of inputs.entries()) {
      const portKey = portPathKey({ nodeId, portName });
      portValues.set(portKey, value);
    }

    // Evaluate node
    const outputs = evaluateNode(node, inputs, seqState);

    // Store output values
    for (const [portName, value] of outputs.entries()) {
      const portKey = portPathKey({ nodeId, portName });
      portValues.set(portKey, value);
    }
  }

  // Propagate values to circuit-level outputs
  // (needed for composite component evaluation)
  for (const conn of circuit.connections) {
    // Check if target is a circuit-level output (empty nodeId)
    if (conn.target.nodeId === '') {
      const sourceKey = portPathKey(conn.source);
      const targetKey = portPathKey(conn.target);
      const sourceValue = portValues.get(sourceKey);
      if (sourceValue !== undefined) {
        portValues.set(targetKey, sourceValue);
      }
    }
  }

  return {
    portValues,
    sequentialState: seqState,
  };
}

/**
 * Run full simulation tick (combinational + sequential phases)
 */
export function runSimulationTick(circuit: Circuit, seqState: SequentialState): SimulationResult {
  // Phase 1: Combinational evaluation (reads current state)
  const combResult = runCombinationalSimulation(circuit, seqState);

  if (combResult.error) {
    return combResult;
  }

  // Phase 2: Update clock states (global clock - all clocks pulse on each tick)
  updateClockStates(circuit, seqState);

  // Phase 3: Sequential state update (computes next state)
  updateSequentialStates(circuit, combResult.portValues, seqState);

  // Phase 4: Commit state
  commitSequentialState(seqState);

  // Phase 5: Re-evaluate with new state
  const finalResult = runCombinationalSimulation(circuit, seqState);

  return finalResult;
}

/**
 * Get port value by path
 */
export function getPortValue(portValues: PortValueMap, path: PortPath): BitValue | BusValue {
  const key = portPathKey(path);
  return portValues.get(key) ?? false;
}
