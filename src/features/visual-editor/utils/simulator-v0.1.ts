/**
 * Simulator Engine v0.1
 *
 * Evaluates circuits using the IR v0.1 specification.
 * Supports both primitive and composite components with hierarchical evaluation.
 */

import type {
  Circuit,
  Node,
  PortPath,
  BitValue,
  BusValue,
  StateValue,
  SimulationState,
} from '../types/ir-v0.1';
import { portPathKey, getDefaultValue } from '../types/ir-v0.1';
import { getPrimitiveEvaluator } from '../lib/primitives';
import type { ComponentLibraryStore } from '../stores/component-library-store';

/**
 * Simulation context for a single circuit evaluation
 */
interface EvaluationContext {
  circuit: Circuit;
  library: ComponentLibraryStore;
  portValues: Map<string, BitValue | BusValue>;
  nodeOutputs: Map<string, Map<string, BitValue | BusValue>>;
}

/**
 * Create initial simulation state for a circuit
 */
export function createSimulationState(circuit: Circuit): SimulationState {
  const portValues = new Map<string, BitValue | BusValue>();
  const stateValues = new Map<string, StateValue>();
  const clockStates = new Map();

  // Initialize all input ports to default values
  for (const input of circuit.inputs) {
    const key = portPathKey({ nodeId: '', portName: input.name });
    portValues.set(key, getDefaultValue(input.portType));
  }

  // Initialize all output ports to default values
  for (const output of circuit.outputs) {
    const key = portPathKey({ nodeId: '', portName: output.name });
    portValues.set(key, getDefaultValue(output.portType));
  }

  // Initialize state blocks
  for (const state of circuit.state) {
    stateValues.set(state.id, state.initialValue);
  }

  return {
    portValues,
    stateValues,
    clockStates,
    cycle: 0,
    evaluationOrder: [],
  };
}

/**
 * Set input values for circuit-level inputs
 */
export function setInputs(
  state: SimulationState,
  circuit: Circuit,
  inputs: Record<string, BitValue | BusValue>
): SimulationState {
  const newState = { ...state, portValues: new Map(state.portValues) };

  for (const [name, value] of Object.entries(inputs)) {
    const key = portPathKey({ nodeId: '', portName: name });
    newState.portValues.set(key, value);
  }

  return newState;
}

/**
 * Get output values from circuit-level outputs
 */
export function getOutputs(
  state: SimulationState,
  circuit: Circuit
): Record<string, BitValue | BusValue> {
  const outputs: Record<string, BitValue | BusValue> = {};

  for (const output of circuit.outputs) {
    const key = portPathKey({ nodeId: '', portName: output.name });
    const value = state.portValues.get(key);
    if (value !== undefined) {
      outputs[output.name] = value;
    }
  }

  return outputs;
}

/**
 * Build topological sort order for node evaluation
 */
function buildEvaluationOrder(circuit: Circuit): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  // Build adjacency list (node -> nodes that depend on it)
  const dependencies = new Map<string, Set<string>>();
  for (const node of circuit.nodes) {
    dependencies.set(node.id, new Set());
  }

  // For each connection, the target node depends on the source node
  for (const conn of circuit.connections) {
    if (conn.source.nodeId && conn.target.nodeId) {
      const deps = dependencies.get(conn.target.nodeId);
      if (deps) {
        deps.add(conn.source.nodeId);
      }
    }
  }

  // DFS to build topological order
  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;

    if (visiting.has(nodeId)) {
      throw new Error(`Combinational loop detected involving node ${nodeId}`);
    }

    visiting.add(nodeId);

    const deps = dependencies.get(nodeId);
    if (deps) {
      for (const depId of deps) {
        visit(depId);
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  // Visit all nodes
  for (const node of circuit.nodes) {
    visit(node.id);
  }

  return order;
}

/**
 * Evaluate a single simulation step
 */
export function evaluateCircuit(
  circuit: Circuit,
  state: SimulationState,
  library: ComponentLibraryStore
): SimulationState {
  // Build evaluation order if not cached
  let evaluationOrder = state.evaluationOrder;
  if (evaluationOrder.length === 0) {
    evaluationOrder = buildEvaluationOrder(circuit);
  }

  const newPortValues = new Map(state.portValues);
  const nodeOutputs = new Map<string, Map<string, BitValue | BusValue>>();

  // First, propagate input connections to set up node inputs
  propagateInputConnections(circuit, newPortValues);

  const context: EvaluationContext = {
    circuit,
    library,
    portValues: newPortValues,
    nodeOutputs,
  };

  // Evaluate each node in topological order
  for (const nodeId of evaluationOrder) {
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const outputs = evaluateNode(node, context);
    nodeOutputs.set(nodeId, outputs);

    // Update port values for this node's outputs
    for (const [portName, value] of outputs) {
      const key = portPathKey({ nodeId: node.id, portName });
      newPortValues.set(key, value);
    }

    // Propagate this node's outputs immediately
    propagateOutputConnections(circuit, newPortValues);
  }

  return {
    ...state,
    portValues: newPortValues,
    evaluationOrder,
  };
}

/**
 * Propagate values through connections
 * This needs to happen BEFORE evaluation to ensure inputs are properly connected
 */
function propagateInputConnections(
  circuit: Circuit,
  portValues: Map<string, BitValue | BusValue>
): void {
  // Propagate values from sources to targets
  // This connects circuit inputs to node inputs, and node outputs to node inputs
  for (const conn of circuit.connections) {
    const sourceKey = portPathKey(conn.source);
    const targetKey = portPathKey(conn.target);

    const sourceValue = portValues.get(sourceKey);
    if (sourceValue !== undefined) {
      portValues.set(targetKey, sourceValue);
    }
  }
}

/**
 * Propagate output values through connections
 * This happens AFTER evaluation to propagate node outputs to circuit outputs
 */
function propagateOutputConnections(
  circuit: Circuit,
  portValues: Map<string, BitValue | BusValue>
): void {
  // Propagate node outputs to circuit outputs and other node inputs
  for (const conn of circuit.connections) {
    const sourceKey = portPathKey(conn.source);
    const targetKey = portPathKey(conn.target);

    const sourceValue = portValues.get(sourceKey);
    if (sourceValue !== undefined) {
      portValues.set(targetKey, sourceValue);
    }
  }
}

/**
 * Evaluate a single node
 */
function evaluateNode(
  node: Node,
  context: EvaluationContext
): Map<string, BitValue | BusValue> {
  // Resolve the component definition
  const componentDef = context.library.resolveComponent(node.componentRef);

  if (!componentDef) {
    throw new Error(`Cannot resolve component: ${node.componentRef}`);
  }

  // Collect input values
  const inputValues = new Map<string, BitValue | BusValue>();
  for (const input of node.inputs) {
    const key = portPathKey({ nodeId: node.id, portName: input.name });
    const value = context.portValues.get(key) ?? getDefaultValue(input.portType);
    inputValues.set(input.name, value);
  }

  // Evaluate based on implementation type
  switch (componentDef.implementation.kind) {
    case 'primitive':
      return evaluatePrimitive(node, componentDef, inputValues);

    case 'composite':
      return evaluateComposite(node, componentDef, inputValues, context.library);

    case 'intrinsic':
      // Intrinsics are handled specially (e.g., display components)
      return new Map();

    default:
      throw new Error(`Unknown implementation kind for ${node.componentRef}`);
  }
}

/**
 * Evaluate a primitive component
 */
function evaluatePrimitive(
  node: Node,
  componentDef: Circuit,
  inputValues: Map<string, BitValue | BusValue>
): Map<string, BitValue | BusValue> {
  const evaluator = getPrimitiveEvaluator(componentDef.name);

  if (!evaluator) {
    throw new Error(`No evaluator found for primitive: ${componentDef.name}`);
  }

  return evaluator(inputValues);
}

/**
 * Evaluate a composite component (recursive)
 */
function evaluateComposite(
  node: Node,
  componentDef: Circuit,
  inputValues: Map<string, BitValue | BusValue>,
  library: ComponentLibraryStore
): Map<string, BitValue | BusValue> {
  // Create a simulation state for the composite circuit
  const compositeState = createSimulationState(componentDef);

  // Map input values to the composite circuit's inputs
  const mappedInputs: Record<string, BitValue | BusValue> = {};
  for (const [name, value] of inputValues) {
    mappedInputs[name] = value;
  }

  // Set inputs
  const stateWithInputs = setInputs(compositeState, componentDef, mappedInputs);

  // Evaluate the composite circuit recursively
  const evaluatedState = evaluateCircuit(componentDef, stateWithInputs, library);

  // Extract outputs
  const outputs = getOutputs(evaluatedState, componentDef);

  // Convert to Map
  const outputMap = new Map<string, BitValue | BusValue>();
  for (const [name, value] of Object.entries(outputs)) {
    outputMap.set(name, value);
  }

  return outputMap;
}

/**
 * Run simulation for multiple steps
 */
export function simulateSteps(
  circuit: Circuit,
  initialState: SimulationState,
  library: ComponentLibraryStore,
  steps: number
): SimulationState[] {
  const states: SimulationState[] = [initialState];
  let currentState = initialState;

  for (let i = 0; i < steps; i++) {
    currentState = evaluateCircuit(circuit, currentState, library);
    currentState = { ...currentState, cycle: currentState.cycle + 1 };
    states.push(currentState);
  }

  return states;
}

/**
 * Run simulation with inputs and return outputs
 */
export function simulate(
  circuit: Circuit,
  inputs: Record<string, BitValue | BusValue>,
  library: ComponentLibraryStore
): Record<string, BitValue | BusValue> {
  // Create initial state
  let state = createSimulationState(circuit);

  // Set inputs
  state = setInputs(state, circuit, inputs);

  // Evaluate
  state = evaluateCircuit(circuit, state, library);

  // Return outputs
  return getOutputs(state, circuit);
}

/**
 * Validate circuit for simulation
 */
export function validateCircuitForSimulation(
  circuit: Circuit,
  library: ComponentLibraryStore
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check that all component references can be resolved
  for (const node of circuit.nodes) {
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) {
      errors.push(`Cannot resolve component: ${node.componentRef} in node ${node.id}`);
    }
  }

  // Check for combinational loops
  try {
    buildEvaluationOrder(circuit);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  // Check connection type compatibility
  for (const conn of circuit.connections) {
    const sourcePort = findPortInCircuit(circuit, conn.source);
    const targetPort = findPortInCircuit(circuit, conn.target);

    if (sourcePort && targetPort) {
      if (sourcePort.portType.kind !== targetPort.portType.kind) {
        errors.push(
          `Type mismatch in connection ${conn.id}: ` +
          `${sourcePort.portType.kind} -> ${targetPort.portType.kind}`
        );
      }

      if (
        sourcePort.portType.kind === 'bus' &&
        targetPort.portType.kind === 'bus' &&
        sourcePort.portType.width !== targetPort.portType.width
      ) {
        errors.push(
          `Width mismatch in connection ${conn.id}: ` +
          `${sourcePort.portType.width} -> ${targetPort.portType.width}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find a port descriptor in a circuit by path
 */
function findPortInCircuit(
  circuit: Circuit,
  path: PortPath
): { portType: { kind: 'bit' } | { kind: 'bus'; width: number } } | null {
  if (path.nodeId === '') {
    // Circuit-level port
    const input = circuit.inputs.find(p => p.name === path.portName);
    if (input) return input;

    const output = circuit.outputs.find(p => p.name === path.portName);
    if (output) return output;
  } else {
    // Node port
    const node = circuit.nodes.find(n => n.id === path.nodeId);
    if (!node) return null;

    const input = node.inputs.find(p => p.name === path.portName);
    if (input) return input;

    const output = node.outputs.find(p => p.name === path.portName);
    if (output) return output;
  }

  return null;
}
