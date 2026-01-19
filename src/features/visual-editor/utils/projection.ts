/**
 * Projection Utilities
 *
 * Converts IR + Metadata into ReactFlow nodes and edges.
 * This is the bridge between our logical representation and the visual canvas.
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  Component,
  IRState,
  MetadataState,
  ComponentType,
} from '../types';
import { getComponentSpec, WIRE_COLORS } from '../types';
import type { ComponentLibrary } from '../stores/component-library-store';

// Custom data structure for our ReactFlow nodes
export interface NodeData extends Record<string, unknown> {
  componentId: string;
  componentType: ComponentType;
  label?: string;
  value?: boolean;
  inputCount: number;
  outputCount: number;
}

/**
 * Helper: Get port counts for a component type.
 * Looks up primitive specs or resolves from component library for user-defined components.
 */
function getPortCounts(
  componentType: ComponentType,
  library?: ComponentLibrary
): { inputCount: number; outputCount: number } {
  // Try primitive specs first
  const spec = getComponentSpec(componentType);
  if (spec) {
    return {
      inputCount: spec.inputCount,
      outputCount: spec.outputCount,
    };
  }

  // For user-defined components, look up in library
  if (library) {
    const circuit =
      library.primitives.get(componentType) ||
      library.standard.get(componentType) ||
      library.user.get(componentType);

    if (circuit) {
      return {
        inputCount: circuit.inputs.length,
        outputCount: circuit.outputs.length,
      };
    }
  }

  // Fallback: no ports if component not found
  console.warn(`Component type '${componentType}' not found in specs or library`);
  return { inputCount: 0, outputCount: 0 };
}

/**
 * Projects the IR and Metadata into ReactFlow nodes
 */
export function projectToNodes(
  ir: IRState,
  metadata: MetadataState,
  library?: ComponentLibrary
): Node<NodeData>[] {
  const nodes: Node<NodeData>[] = [];

  for (const [id, component] of Object.entries(ir.components)) {
    const componentMetadata = metadata.components[id];

    if (!componentMetadata) {
      console.warn(`Missing metadata for component ${id}`);
      continue;
    }

    // Get port counts (primitive or user-defined)
    const { inputCount, outputCount } = getPortCounts(component.type, library);

    // Determine node type for custom rendering (needs port counts for user-defined components)
    const nodeType = getNodeTypeForComponent(component.type, inputCount, outputCount);

    // Extract value based on component type (with proper type guard)
    let value: boolean | undefined = undefined;
    if (component.type === 'SWITCH' || component.type === 'LED') {
      value = 'value' in component ? component.value : undefined;
    }

    nodes.push({
      id,
      type: nodeType,
      position: componentMetadata.position,
      data: {
        componentId: id,
        componentType: component.type,
        label: component.label,
        value,
        inputCount,
        outputCount,
      },
      selected: componentMetadata.selected,
      selectable: true,
      deletable: true,
    });
  }

  return nodes;
}

/**
 * Projects the IR and Metadata into ReactFlow edges
 */
export function projectToEdges(ir: IRState, metadata: MetadataState): Edge[] {
  const edges: Edge[] = [];

  for (const [id, connection] of Object.entries(ir.connections)) {
    const connectionMetadata = metadata.connections[id];

    // Get the source component to determine output value
    const sourceComponent = ir.components[connection.sourceComponentId];
    let edgeColor = WIRE_COLORS.UNDEFINED;

    if (sourceComponent) {
      // Determine wire color based on signal value
      const value = getOutputValue(sourceComponent, connection.sourcePortIndex, ir);
      if (value !== undefined) {
        edgeColor = value ? WIRE_COLORS.TRUE : WIRE_COLORS.FALSE;
      }
    }

    // Use metadata color if provided, otherwise use computed color
    const finalColor = connectionMetadata?.color || edgeColor;

    edges.push({
      id,
      type: 'orthogonal', // Use custom orthogonal edge type
      source: connection.sourceComponentId,
      target: connection.targetComponentId,
      sourceHandle: `out-${connection.sourcePortIndex}`,
      targetHandle: `in-${connection.targetPortIndex}`,
      style: {
        stroke: finalColor,
        strokeWidth: 2,
      },
      animated: connectionMetadata?.animated || false,
      selected: connectionMetadata?.selected,
      selectable: true,
      deletable: true,
      data: {
        waypoints: connectionMetadata?.waypoints || [],
      },
    });
  }

  return edges;
}

/**
 * Main projection function that combines nodes and edges
 */
export function projectToReactFlow(
  ir: IRState,
  metadata: MetadataState,
  library?: ComponentLibrary
) {
  return {
    nodes: projectToNodes(ir, metadata, library),
    edges: projectToEdges(ir, metadata),
  };
}

/**
 * Helper: Determine the ReactFlow node type based on component type and port counts
 */
function getNodeTypeForComponent(
  componentType: ComponentType,
  inputCount: number,
  outputCount: number
): string {
  // Check primitive types first
  switch (componentType) {
    case 'SWITCH':
      return 'inputNode';
    case 'LED':
      return 'outputNode';
    case 'AND_GATE':
    case 'OR_GATE':
    case 'NOT_GATE':
    case 'NAND_GATE':
    case 'NOR_GATE':
    case 'XOR_GATE':
    case 'XNOR_GATE':
    case 'BUFFER':
      return 'logicGateNode';
  }

  // For user-defined components, classify based on port counts
  if (inputCount === 0 && outputCount > 0) {
    return 'inputNode'; // Source components (like SWITCH)
  } else if (inputCount > 0 && outputCount === 0) {
    return 'outputNode'; // Sink components (like LED)
  } else if (inputCount > 0 && outputCount > 0) {
    return 'logicGateNode'; // Processing components (like gates)
  }

  // Fallback for components with no ports
  return 'default';
}

/**
 * Helper: Get the output value of a component's specific port
 */
function getOutputValue(component: Component, portIndex: number, ir: IRState): boolean | undefined {
  switch (component.type) {
    case 'SWITCH':
      // Type guard: SWITCH components have a value property
      if ('value' in component) {
        return component.value;
      }
      return undefined;

    // All logic gates follow the same pattern
    case 'AND_GATE':
    case 'OR_GATE':
    case 'NOT_GATE':
    case 'NAND_GATE':
    case 'NOR_GATE':
    case 'XOR_GATE':
    case 'XNOR_GATE':
    case 'BUFFER': {
      // For logic gates, we need to evaluate based on inputs
      const spec = getComponentSpec(component.type);
      if (!spec?.evaluate) return undefined;

      // Get all connections to this gate's inputs
      const inputValues: boolean[] = [];
      const connections = Object.values(ir.connections).filter(
        (conn) => conn.targetComponentId === component.id
      );

      // Build input array
      for (let i = 0; i < spec.inputCount; i++) {
        const inputConnection = connections.find((conn) => conn.targetPortIndex === i);
        if (inputConnection) {
          const sourceComponent = ir.components[inputConnection.sourceComponentId];
          if (sourceComponent) {
            const value = getOutputValue(sourceComponent, inputConnection.sourcePortIndex, ir);
            inputValues[i] = value ?? false;
          } else {
            inputValues[i] = false;
          }
        } else {
          inputValues[i] = false; // Unconnected input defaults to false
        }
      }

      // Evaluate the gate
      const outputs = spec.evaluate(inputValues);
      return outputs[portIndex];
    }

    case 'LED':
      // LEDs don't have outputs
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Helper: Get the input value of a component's specific port
 */
export function getInputValue(componentId: string, portIndex: number, ir: IRState): boolean | undefined {
  // Find the connection to this input port
  const connection = Object.values(ir.connections).find(
    (conn) => conn.targetComponentId === componentId && conn.targetPortIndex === portIndex
  );

  if (!connection) {
    return undefined; // Unconnected
  }

  const sourceComponent = ir.components[connection.sourceComponentId];
  if (!sourceComponent) {
    return undefined;
  }

  return getOutputValue(sourceComponent, connection.sourcePortIndex, ir);
}
