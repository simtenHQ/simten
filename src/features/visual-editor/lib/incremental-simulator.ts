/**
 * Incremental Simulator (IR v0.1)
 *
 * Efficient simulation that only evaluates nodes affected by changes.
 * Provides visualization support for showing signal propagation.
 *
 * Key features:
 * - Dependency graph tracking
 * - Dirty node propagation
 * - Visualization of affected nodes
 * - Scalable to large circuits
 */

import type { Circuit, Node, PortPath, BitValue, BusValue } from '../types/ir-v0.1';
import type { PortValueMap, SequentialState } from './simulator-v0.1';
import { flattenCircuit, hasCompositeComponents, type FlattenedCircuit } from './circuit-flattener';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { getPrimitiveEvaluator } from './primitives';

/**
 * Compiled circuit ready for incremental simulation
 */
export interface CompiledCircuit {
  // Original circuit (kept for reference)
  original: Circuit;

  // Flattened circuit (only primitives)
  flattened: FlattenedCircuit;

  // Evaluation order (topological sort)
  evaluationOrder: string[];

  // Dependency graph: nodeId -> Set of nodes that depend on it
  dependencies: Map<string, Set<string>>;

  // Reverse dependencies: nodeId -> Set of nodes it depends on
  inputs: Map<string, Set<string>>;

  // Current simulation state
  portValues: PortValueMap;
  sequentialState?: SequentialState;

  // Nodes that need re-evaluation this tick
  dirtyNodes: Set<string>;

  // Nodes that were evaluated this tick (for visualization)
  evaluatedThisTick: Set<string>;
}

/**
 * Port path key for maps
 */
function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Compile a circuit for incremental simulation
 */
export function compileCircuit(circuit: Circuit): CompiledCircuit {
  // Step 1: Flatten composites to primitives (if needed)
  const flattened = hasCompositeComponents(circuit)
    ? flattenCircuit(circuit)
    : { ...circuit, nodeMapping: new Map(circuit.nodes.map(n => [n.id, [n.id]])) };

  // Step 2: Topological sort for evaluation order
  const evaluationOrder = topologicalSort(flattened);

  if (!evaluationOrder) {
    throw new Error('Circuit contains combinational loops');
  }

  // Step 3: Build dependency graphs
  const dependencies = new Map<string, Set<string>>();
  const inputs = new Map<string, Set<string>>();

  for (const conn of flattened.connections) {
    const sourceId = conn.source.nodeId;
    const targetId = conn.target.nodeId;

    // Skip circuit-level ports
    if (sourceId === '' || targetId === '') continue;

    // Forward dependency: source -> targets that depend on it
    if (!dependencies.has(sourceId)) {
      dependencies.set(sourceId, new Set());
    }
    dependencies.get(sourceId)!.add(targetId);

    // Reverse dependency: target -> sources it depends on
    if (!inputs.has(targetId)) {
      inputs.set(targetId, new Set());
    }
    inputs.get(targetId)!.add(sourceId);
  }

  return {
    original: circuit,
    flattened,
    evaluationOrder,
    dependencies,
    inputs,
    portValues: new Map(),
    dirtyNodes: new Set(),
    evaluatedThisTick: new Set(),
  };
}

/**
 * Topological sort (same as simulator-v0.1.ts but extracted)
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

  for (const nodeId of combinationalNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  const nodeSet = new Set(combinationalNodes);

  for (const conn of circuit.connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    if (source === '' || target === '') continue;
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

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

  if (result.length !== combinationalNodes.length) {
    return null;
  }

  return [...sequentialNodes, ...result];
}

/**
 * Initialize simulation (evaluate all nodes once)
 */
export function initializeSimulation(compiled: CompiledCircuit): void {
  // Mark all nodes as dirty for initial evaluation
  for (const nodeId of compiled.evaluationOrder) {
    compiled.dirtyNodes.add(nodeId);
  }

  // Evaluate all nodes
  evaluateDirtyNodes(compiled);
}

/**
 * Run incremental simulation step
 * Only evaluates nodes affected by changes
 */
export function simulateIncremental(
  compiled: CompiledCircuit,
  changedNodes: Set<string>
): void {
  // Clear previous tick's evaluation tracking
  compiled.evaluatedThisTick.clear();

  // Mark changed nodes as dirty
  for (const nodeId of changedNodes) {
    compiled.dirtyNodes.add(nodeId);
  }

  // Evaluate dirty nodes and propagate changes
  evaluateDirtyNodes(compiled);
}

/**
 * Evaluate all dirty nodes, propagating changes through dependencies
 */
function evaluateDirtyNodes(compiled: CompiledCircuit): void {
  const maxIterations = 1000; // Prevent infinite loops
  let iteration = 0;

  while (compiled.dirtyNodes.size > 0 && iteration < maxIterations) {
    iteration++;

    // Get next dirty node in topological order
    let nextNode: string | null = null;
    for (const nodeId of compiled.evaluationOrder) {
      if (compiled.dirtyNodes.has(nodeId)) {
        nextNode = nodeId;
        break;
      }
    }

    if (!nextNode) break;

    compiled.dirtyNodes.delete(nextNode);
    compiled.evaluatedThisTick.add(nextNode);

    // Find the node
    const node = compiled.flattened.nodes.find(n => n.id === nextNode);
    if (!node) continue;

    // Evaluate node
    const oldOutputs = new Map<string, BitValue | BusValue>();
    for (const output of node.outputs) {
      const key = portPathKey({ nodeId: node.id, portName: output.name });
      oldOutputs.set(output.name, compiled.portValues.get(key) ?? false);
    }

    const newOutputs = evaluateNode(node, compiled);

    // Check if any outputs changed
    let hasChanged = false;
    for (const [portName, newValue] of newOutputs.entries()) {
      const oldValue = oldOutputs.get(portName);
      if (oldValue !== newValue) {
        hasChanged = true;
        const key = portPathKey({ nodeId: node.id, portName });
        compiled.portValues.set(key, newValue);
      }
    }

    // If outputs changed, mark dependent nodes as dirty
    if (hasChanged) {
      const dependents = compiled.dependencies.get(node.id) || new Set();
      for (const dependent of dependents) {
        compiled.dirtyNodes.add(dependent);
      }
    }
  }

  if (iteration >= maxIterations) {
    console.warn('[INCREMENTAL] Max iterations reached - possible oscillation');
  }
}

/**
 * Evaluate a single node
 */
function evaluateNode(
  node: Node,
  compiled: CompiledCircuit
): Map<string, BitValue | BusValue> {
  // Get input values
  const inputs = new Map<string, BitValue | BusValue>();

  for (const inputPort of node.inputs) {
    inputs.set(inputPort.name, inputPort.portType.kind === 'bit' ? false : 0);
  }

  // Fill in actual values from connections
  for (const conn of compiled.flattened.connections) {
    if (conn.target.nodeId === node.id) {
      const sourceKey = portPathKey(conn.source);
      const value = compiled.portValues.get(sourceKey);
      if (value !== undefined) {
        inputs.set(conn.target.portName, value);
      }
    }
  }

  // Special handling for source components
  if (node.componentRef === 'Switch' || node.componentRef === 'Button') {
    const value = Boolean(node.arguments.value ?? false);
    return new Map([['out', value]]);
  }

  if (node.componentRef === 'Input') {
    const value = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
    return new Map([['out', value]]);
  }

  // Evaluate primitive
  const evaluator = getPrimitiveEvaluator(node.componentRef);

  if (!evaluator) {
    console.warn(`[INCREMENTAL] No evaluator for: ${node.componentRef}`);
    const outputs = new Map<string, BitValue | BusValue>();
    for (const outputPort of node.outputs) {
      outputs.set(outputPort.name, outputPort.portType.kind === 'bit' ? false : 0);
    }
    return outputs;
  }

  const currentState = compiled.sequentialState?.currentState.get(node.id);
  return evaluator.evaluate(inputs, currentState);
}

/**
 * Get all nodes that would be affected by changing a specific node
 * (for visualization)
 */
export function getAffectedNodes(
  compiled: CompiledCircuit,
  nodeId: string
): Set<string> {
  const affected = new Set<string>();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const dependents = compiled.dependencies.get(current);
    if (!dependents) continue;

    for (const dependent of dependents) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return affected;
}

/**
 * Get all nodes that feed into a specific node
 * (for visualization)
 */
export function getInputNodes(
  compiled: CompiledCircuit,
  nodeId: string
): Set<string> {
  const inputNodes = new Set<string>();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const sources = compiled.inputs.get(current);
    if (!sources) continue;

    for (const source of sources) {
      if (!inputNodes.has(source)) {
        inputNodes.add(source);
        queue.push(source);
      }
    }
  }

  return inputNodes;
}
