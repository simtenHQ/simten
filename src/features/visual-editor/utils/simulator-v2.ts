/**
 * Simulator Engine v2
 *
 * Enhanced simulator that supports composite components.
 * Evaluates circuits hierarchically with proper component resolution.
 */

import type {
  Circuit,
  Node,
  Connection,
  BitValue,
  BusValue,
  PortPath,
  SimulationState,
} from '../types/ir-v0.1';
import { portPathKey } from '../types/ir-v0.1';
import type { ComponentLibrary } from '../stores/component-library-store';
import { getPrimitiveEvaluator } from '../lib/primitives';
import { resolveComponent } from './component-resolver';

/**
 * Simulator instance
 */
export class CircuitSimulator {
  private library: ComponentLibrary;
  private state: SimulationState;

  constructor(library: ComponentLibrary) {
    this.library = library;
    this.state = {
      portValues: new Map(),
      stateValues: new Map(),
      clockStates: new Map(),
      cycle: 0,
      evaluationOrder: [],
    };
  }

  /**
   * Initialize the circuit for simulation
   */
  initialize(circuit: Circuit): void {
    // Reset state
    this.state = {
      portValues: new Map(),
      stateValues: new Map(),
      clockStates: new Map(),
      cycle: 0,
      evaluationOrder: [],
    };

    // Initialize state blocks with initial values
    for (const stateBlock of circuit.state) {
      this.state.stateValues.set(stateBlock.id, stateBlock.initialValue);
    }

    // Compute evaluation order (topological sort)
    this.state.evaluationOrder = this.topologicalSort(circuit);
  }

  /**
   * Execute one simulation step
   */
  step(circuit: Circuit): void {
    // Evaluate nodes in topological order
    for (const nodeId of this.state.evaluationOrder) {
      const node = circuit.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      this.evaluateNode(circuit, node);
    }

    // Increment cycle counter
    this.state.cycle++;
  }

  /**
   * Set an input port value
   */
  setInput(portPath: PortPath, value: BitValue | BusValue): void {
    const key = portPathKey(portPath);
    this.state.portValues.set(key, value);
  }

  /**
   * Get an output port value
   */
  getOutput(portPath: PortPath): BitValue | BusValue | undefined {
    const key = portPathKey(portPath);
    return this.state.portValues.get(key);
  }

  /**
   * Get all port values (for debugging)
   */
  getAllPortValues(): Map<string, BitValue | BusValue> {
    return new Map(this.state.portValues);
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Evaluate a single node
   */
  private evaluateNode(circuit: Circuit, node: Node): void {
    // Resolve component definition
    const resolved = resolveComponent(node.componentRef, this.library);

    if (resolved.isPrimitive) {
      // Evaluate primitive component
      this.evaluatePrimitive(circuit, node);
    } else {
      // Evaluate composite component
      this.evaluateComposite(circuit, node, resolved.circuit);
    }
  }

  /**
   * Evaluate a primitive component
   */
  private evaluatePrimitive(circuit: Circuit, node: Node): void {
    const evaluator = getPrimitiveEvaluator(node.componentRef);
    if (!evaluator) {
      console.warn(`No evaluator found for primitive ${node.componentRef}`);
      return;
    }

    // Collect input values
    const inputValues = new Map<string, BitValue | BusValue>();
    for (const inputPort of node.inputs) {
      const value = this.getPortValue(circuit, { nodeId: node.id, portName: inputPort.name });
      inputValues.set(inputPort.name, value ?? getDefaultValue(inputPort.portType.kind));
    }

    // Evaluate
    const outputValues = evaluator(inputValues);

    // Write output values
    for (const outputPort of node.outputs) {
      const value = outputValues.get(outputPort.name);
      if (value !== undefined) {
        this.setPortValue({ nodeId: node.id, portName: outputPort.name }, value);
      }
    }
  }

  /**
   * Evaluate a composite component
   */
  private evaluateComposite(parentCircuit: Circuit, node: Node, componentCircuit: Circuit): void {
    // Create a sub-simulator for the composite component
    const subSim = new CircuitSimulator(this.library);
    subSim.initialize(componentCircuit);

    // Map parent circuit's connections to the composite's inputs
    for (const inputPort of node.inputs) {
      const value = this.getPortValue(parentCircuit, { nodeId: node.id, portName: inputPort.name });
      if (value !== undefined) {
        // Set the composite circuit's input port
        subSim.setInput({ nodeId: '', portName: inputPort.name }, value);
      }
    }

    // Evaluate the composite circuit
    subSim.step(componentCircuit);

    // Read outputs from the composite circuit
    for (const outputPort of node.outputs) {
      const value = subSim.getOutput({ nodeId: '', portName: outputPort.name });
      if (value !== undefined) {
        this.setPortValue({ nodeId: node.id, portName: outputPort.name }, value);
      }
    }
  }

  /**
   * Get the value of a port (considering connections)
   */
  private getPortValue(circuit: Circuit, portPath: PortPath): BitValue | BusValue | undefined {
    // First check if there's a direct connection to this port
    const connection = this.findConnectionToTarget(circuit, portPath);

    if (connection) {
      // Get the source port value
      const sourceKey = portPathKey(connection.source);
      return this.state.portValues.get(sourceKey);
    }

    // Check if the port has a stored value
    const key = portPathKey(portPath);
    return this.state.portValues.get(key);
  }

  /**
   * Set the value of a port
   */
  private setPortValue(portPath: PortPath, value: BitValue | BusValue): void {
    const key = portPathKey(portPath);
    this.state.portValues.set(key, value);
  }

  /**
   * Find connection that targets a specific port
   */
  private findConnectionToTarget(circuit: Circuit, target: PortPath): Connection | undefined {
    return circuit.connections.find(
      (conn) => conn.target.nodeId === target.nodeId && conn.target.portName === target.portName
    );
  }

  /**
   * Topological sort of nodes for evaluation order
   */
  private topologicalSort(circuit: Circuit): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    for (const node of circuit.nodes) {
      adjacency.set(node.id, new Set());
    }

    for (const connection of circuit.connections) {
      // If target is a node (not circuit-level port)
      if (connection.target.nodeId !== '') {
        const targetNodeId = connection.target.nodeId;

        // If source is a node (not circuit-level port)
        if (connection.source.nodeId !== '') {
          const sourceNodeId = connection.source.nodeId;

          // Add edge: source -> target
          const deps = adjacency.get(targetNodeId);
          if (deps) {
            deps.add(sourceNodeId);
          }
        }
      }
    }

    // DFS to build topological order
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Visit dependencies first
      const deps = adjacency.get(nodeId);
      if (deps) {
        for (const depId of deps) {
          visit(depId);
        }
      }

      result.push(nodeId);
    };

    // Visit all nodes
    for (const node of circuit.nodes) {
      visit(node.id);
    }

    return result;
  }
}

/**
 * Helper to get default value for a port type
 */
function getDefaultValue(kind: 'bit' | 'bus'): BitValue | BusValue {
  return kind === 'bit' ? false : 0;
}

/**
 * Create a simulator instance
 */
export function createSimulator(library: ComponentLibrary): CircuitSimulator {
  return new CircuitSimulator(library);
}

/**
 * Convenience function: simulate a circuit with given inputs
 */
export function simulateCircuit(
  circuit: Circuit,
  library: ComponentLibrary,
  inputs: Record<string, BitValue | BusValue>
): Record<string, BitValue | BusValue> {
  const sim = createSimulator(library);
  sim.initialize(circuit);

  // Set inputs
  for (const [name, value] of Object.entries(inputs)) {
    sim.setInput({ nodeId: '', portName: name }, value);
  }

  // Run simulation
  sim.step(circuit);

  // Collect outputs
  const outputs: Record<string, BitValue | BusValue> = {};
  for (const outputDesc of circuit.outputs) {
    const value = sim.getOutput({ nodeId: '', portName: outputDesc.name });
    if (value !== undefined) {
      outputs[outputDesc.name] = value;
    }
  }

  return outputs;
}
