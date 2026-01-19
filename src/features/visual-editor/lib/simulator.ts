/**
 * Circuit Simulator
 *
 * Executes circuit logic by propagating values through components.
 * Uses topological sort to determine evaluation order and avoid cycles.
 */

import type { Component, Connection, ComponentType } from '../types';
import { getComponentSpec } from '../types';

/**
 * Port value map: componentId.portType.portIndex -> value
 * Example: "comp1.output.0" -> true
 */
export type PortValueMap = Map<string, boolean>;

/**
 * Component output values: componentId -> output values array
 */
export type ComponentOutputs = Map<string, boolean[]>;

/**
 * Get port key for value lookup
 */
function getPortKey(
  componentId: string,
  portType: 'input' | 'output',
  portIndex: number
): string {
  return `${componentId}.${portType}.${portIndex}`;
}

/**
 * Topological sort to determine evaluation order
 * Returns component IDs in dependency order, or null if cycle detected
 */
function topologicalSort(
  components: Record<string, Component>,
  connections: Record<string, Connection>
): string[] | null {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const compId of Object.keys(components)) {
    graph.set(compId, new Set());
    inDegree.set(compId, 0);
  }

  // Build dependency graph: source -> targets
  for (const conn of Object.values(connections)) {
    const source = conn.sourceComponentId;
    const target = conn.targetComponentId;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes that have no dependencies (inputs)
  for (const [compId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(compId);
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
  if (result.length !== Object.keys(components).length) {
    return null; // Cycle detected
  }

  return result;
}

/**
 * Evaluate a single component's logic
 * Returns output values based on input values
 */
function evaluateComponent(
  component: Component,
  inputValues: boolean[],
  componentType: ComponentType
): boolean[] {
  const specs = getComponentSpec(componentType);

  // SWITCH: output is component's current value (user-controlled)
  if (component.type === 'SWITCH') {
    // Type guard: SWITCH components have a value property
    if ('value' in component) {
      return [component.value];
    }
    return [false];
  }

  // LED: pass through input value (no transformation)
  if (component.type === 'LED') {
    return []; // LED has no outputs, just displays input
  }

  // LOGIC GATES: use evaluate function from spec
  if (specs?.evaluate) {
    return specs.evaluate(inputValues);
  }

  return [];
}

/**
 * Get input values for a component from the port value map
 */
function getComponentInputs(
  componentId: string,
  componentType: ComponentType,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): boolean[] {
  const specs = getComponentSpec(componentType);
  const inputs: boolean[] = new Array(specs?.inputCount ?? 0).fill(false);

  // Find all connections targeting this component's inputs
  for (const conn of Object.values(connections)) {
    if (conn.targetComponentId === componentId) {
      const sourcePortKey = getPortKey(
        conn.sourceComponentId,
        'output',
        conn.sourcePortIndex
      );
      const value = portValues.get(sourcePortKey) ?? false;
      inputs[conn.targetPortIndex] = value;
    }
  }

  return inputs;
}

/**
 * Run simulation step
 * Propagates values through the circuit in topological order
 *
 * Returns:
 * - portValues: Map of all port values after propagation
 * - componentOutputs: Map of component outputs
 * - error: Error message if cycle detected
 */
export function runSimulation(
  components: Record<string, Component>,
  connections: Record<string, Connection>
): {
  portValues: PortValueMap;
  componentOutputs: ComponentOutputs;
  error?: string;
} {
  const portValues: PortValueMap = new Map();
  const componentOutputs: ComponentOutputs = new Map();

  // Get evaluation order
  const evalOrder = topologicalSort(components, connections);

  if (!evalOrder) {
    return {
      portValues,
      componentOutputs,
      error: 'Cycle detected in circuit',
    };
  }

  // Evaluate each component in dependency order
  for (const compId of evalOrder) {
    const component = components[compId];
    if (!component) continue;

    // Get input values from connected sources
    const inputs = getComponentInputs(compId, component.type, connections, portValues);

    // Evaluate component logic
    const outputs = evaluateComponent(component, inputs, component.type);

    // Store output values in port map
    outputs.forEach((value, index) => {
      const portKey = getPortKey(compId, 'output', index);
      portValues.set(portKey, value);
    });

    // Store component outputs
    componentOutputs.set(compId, outputs);
  }

  return { portValues, componentOutputs };
}

/**
 * Get the value of a specific port
 */
export function getPortValue(
  portValues: PortValueMap,
  componentId: string,
  portType: 'input' | 'output',
  portIndex: number
): boolean {
  const key = getPortKey(componentId, portType, portIndex);
  return portValues.get(key) ?? false;
}

/**
 * Update LED component values based on simulation results
 * This mutates the components object to update LED states
 */
export function updateComponentStates(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  portValues: PortValueMap
): void {
  for (const component of Object.values(components)) {
    // Update LED values based on their input
    if (component.type === 'LED') {
      // Type guard: LED components have a value property
      if ('value' in component) {
        const inputs = getComponentInputs(component.id, component.type, connections, portValues);
        component.value = inputs[0] ?? false;
      }
    }
  }
}
