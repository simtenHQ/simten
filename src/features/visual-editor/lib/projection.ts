/**
 * Projection Layer
 *
 * Transforms IR + Metadata into ReactFlow's node/edge format.
 * This is the bridge between our stores and ReactFlow's controlled component model.
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  Component,
  ComponentMetadata,
  ConnectionMetadata,
  ComponentType,
  Connection,
} from '../types';
import { COMPONENT_SPECS, WIRE_COLORS } from '../types';

/**
 * Port position calculation
 * Returns the relative position of a port on a component
 */
function getPortPosition(
  portType: 'input' | 'output',
  portIndex: number,
  componentType: ComponentType
): { x: number; y: number } {
  const specs = COMPONENT_SPECS[componentType];
  const portCount = portType === 'input' ? specs.inputCount : specs.outputCount;

  if (portCount === 0) return { x: 0, y: 0 };

  // Distribute ports evenly along the left (input) or right (output) side
  const spacing = 60 / (portCount + 1);
  const y = spacing * (portIndex + 1);
  const x = portType === 'input' ? 0 : 100;

  return { x, y };
}

/**
 * Generate ReactFlow handle ID for a port
 */
function getHandleId(componentId: string, portType: 'input' | 'output', portIndex: number): string {
  return `${componentId}.${portType}.${portIndex}`;
}

/**
 * Convert a single component + metadata to a ReactFlow node
 */
function componentToNode(component: Component, metadata: ComponentMetadata | undefined): Node {
  // Default position if no metadata exists
  const position = metadata?.position ?? { x: 0, y: 0 };

  return {
    id: component.id,
    type: component.type.toLowerCase(), // 'switch', 'led', 'and_gate'
    position,
    data: {
      component, // Pass full component data for rendering
      metadata,
    },
    selected: metadata?.selected ?? false,
  };
}

/**
 * Convert a connection + metadata to a ReactFlow edge
 */
function connectionToEdge(
  connection: Connection,
  metadata: ConnectionMetadata | undefined,
  components: Record<string, Component>
): Edge {
  const sourceComponent = components[connection.sourceComponentId];
  const targetComponent = components[connection.targetComponentId];

  // Determine wire color based on the source component's output value
  let color = WIRE_COLORS.UNDEFINED;

  if (sourceComponent) {
    // For switches, use the value directly
    if (sourceComponent.type === 'SWITCH') {
      color = sourceComponent.value ? WIRE_COLORS.TRUE : WIRE_COLORS.FALSE;
    }
    // For gates, we'll need to evaluate them (done by simulator)
    // For now, default to undefined
  }

  const sourceHandle = getHandleId(
    connection.sourceComponentId,
    'output',
    connection.sourcePortIndex
  );
  const targetHandle = getHandleId(
    connection.targetComponentId,
    'input',
    connection.targetPortIndex
  );

  return {
    id: connection.id,
    source: connection.sourceComponentId,
    target: connection.targetComponentId,
    sourceHandle,
    targetHandle,
    type: 'smoothstep', // Use smoothstep for now, will replace with custom waypoint edges in Phase 2
    animated: metadata?.animated ?? false,
    style: {
      stroke: metadata?.color ?? color,
      strokeWidth: 2,
    },
  };
}

/**
 * Main projection function
 * Transforms IR + Metadata → ReactFlow nodes/edges
 */
export function projectToReactFlow(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  componentMetadata: Record<string, ComponentMetadata>,
  connectionMetadata: Record<string, ConnectionMetadata>
): { nodes: Node[]; edges: Edge[] } {
  // Convert components to nodes
  const nodes = Object.values(components).map((component) => {
    const metadata = componentMetadata[component.id];
    return componentToNode(component, metadata);
  });

  // Convert connections to edges
  const edges = Object.values(connections).map((connection) => {
    const metadata = connectionMetadata[connection.id];
    return connectionToEdge(connection, metadata, components);
  });

  return { nodes, edges };
}

/**
 * Get port handle IDs for a component
 * Useful for programmatic port access
 */
export function getComponentPortHandles(componentId: string, componentType: ComponentType) {
  const specs = COMPONENT_SPECS[componentType];

  const inputs = Array.from({ length: specs.inputCount }, (_, i) =>
    getHandleId(componentId, 'input', i)
  );

  const outputs = Array.from({ length: specs.outputCount }, (_, i) =>
    getHandleId(componentId, 'output', i)
  );

  return { inputs, outputs };
}
