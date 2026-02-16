/**
 * Component Resolver
 *
 * Utilities for resolving component references and instantiating nodes.
 */

import { nanoid } from 'nanoid';
import type {
  Circuit,
  Node,
  PortInstance,
  ClockInstance,
  ArgumentValue,
} from '../types/circuit';
import type { ComponentLibrary } from '../stores/component-library-store';

/**
 * Resolution result
 */
export interface ResolvedComponent {
  circuit: Circuit;
  isPrimitive: boolean;
}

/**
 * Resolution error
 */
export class ComponentResolutionError extends Error {
  constructor(
    public componentName: string,
    message: string
  ) {
    super(message);
    this.name = 'ComponentResolutionError';
  }
}

/**
 * Resolve a component name to its circuit definition
 */
export function resolveComponent(
  componentName: string,
  library: ComponentLibrary
): ResolvedComponent {
  // Try primitives first
  const primitive = library.primitives.get(componentName);
  if (primitive) {
    return { circuit: primitive, isPrimitive: true };
  }

  // Try standard library
  const standard = library.standard.get(componentName);
  if (standard) {
    return { circuit: standard, isPrimitive: false };
  }

  // Try user components
  const user = library.user.get(componentName);
  if (user) {
    return { circuit: user, isPrimitive: false };
  }

  // Not found
  throw new ComponentResolutionError(
    componentName,
    `Cannot resolve component '${componentName}'. Component not found in library.`
  );
}

/**
 * Create a node instance from a circuit definition
 */
export function instantiateNode(
  circuit: Circuit,
  nodeId: string,
  label: string | undefined,
  args: Record<string, ArgumentValue>
): Node {
  // Validate arguments match parameters
  validateArguments(circuit, args);

  // Create port instances from descriptors
  const inputs: PortInstance[] = circuit.inputs.map((descriptor) => ({
    id: `${nodeId}.${descriptor.name}`,
    name: descriptor.name,
    portType: descriptor.portType,
    value: undefined,
  }));

  const outputs: PortInstance[] = circuit.outputs.map((descriptor) => ({
    id: `${nodeId}.${descriptor.name}`,
    name: descriptor.name,
    portType: descriptor.portType,
    value: undefined,
  }));

  const clocks: ClockInstance[] = circuit.clocks.map((descriptor) => ({
    id: `${nodeId}.${descriptor.name}`,
    name: descriptor.name,
    state: undefined,
  }));

  return {
    id: nodeId,
    label,
    componentRef: circuit.name,
    arguments: args,
    inputs,
    outputs,
    clocks,
  };
}

/**
 * Validate that arguments match circuit parameters
 */
function validateArguments(circuit: Circuit, args: Record<string, ArgumentValue>): void {
  // Check for unknown arguments
  for (const argName of Object.keys(args)) {
    const param = circuit.parameters.find((p) => p.name === argName);
    if (!param) {
      throw new Error(
        `Unknown argument '${argName}' for component '${circuit.name}'. ` +
          `Valid parameters: ${circuit.parameters.map((p) => p.name).join(', ')}`
      );
    }

    // Type check argument value
    const argValue = args[argName];
    const expectedType = param.paramType;

    if (expectedType === 'int' && typeof argValue !== 'number') {
      throw new Error(
        `Argument '${argName}' for component '${circuit.name}' must be a number, got ${typeof argValue}`
      );
    }

    if (expectedType === 'string' && typeof argValue !== 'string') {
      throw new Error(
        `Argument '${argName}' for component '${circuit.name}' must be a string, got ${typeof argValue}`
      );
    }

    if (expectedType === 'bool' && typeof argValue !== 'boolean') {
      throw new Error(
        `Argument '${argName}' for component '${circuit.name}' must be a boolean, got ${typeof argValue}`
      );
    }
  }

  // Check for missing required arguments (no default value)
  for (const param of circuit.parameters) {
    if (param.defaultValue === undefined && !(param.name in args)) {
      throw new Error(
        `Missing required argument '${param.name}' for component '${circuit.name}'`
      );
    }
  }
}

/**
 * Create a node with automatic ID generation
 */
export function createNode(
  componentName: string,
  library: ComponentLibrary,
  label?: string,
  args: Record<string, ArgumentValue> = {}
): Node {
  const resolved = resolveComponent(componentName, library);
  const nodeId = nanoid();
  return instantiateNode(resolved.circuit, nodeId, label, args);
}

/**
 * Get input port by name from a node
 */
export function getInputPort(node: Node, portName: string): PortInstance | undefined {
  return node.inputs.find((port) => port.name === portName);
}

/**
 * Get output port by name from a node
 */
export function getOutputPort(node: Node, portName: string): PortInstance | undefined {
  return node.outputs.find((port) => port.name === portName);
}

/**
 * Get clock by name from a node
 */
export function getClock(node: Node, clockName: string): ClockInstance | undefined {
  return node.clocks.find((clk) => clk.name === clockName);
}

/**
 * Check if two nodes are compatible for connection
 * (i.e., source output port type matches target input port type)
 */
export function arePortsCompatible(
  sourcePort: PortInstance,
  targetPort: PortInstance
): boolean {
  const sourceType = sourcePort.portType;
  const targetType = targetPort.portType;

  if (sourceType.kind !== targetType.kind) {
    return false;
  }

  if (sourceType.kind === 'bus' && targetType.kind === 'bus') {
    return sourceType.width === targetType.width;
  }

  return true;
}
