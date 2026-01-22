/**
 * Projection Utilities (IR v0.1)
 *
 * Converts Circuit + Metadata into ReactFlow nodes and edges.
 * This is the bridge between our logical representation (IR v0.1) and the visual canvas.
 *
 * Key changes from legacy projection:
 * - Works with Circuit/Node instead of IRState/Component
 * - Uses name-based port handles ("out-portName") instead of index-based ("out-0")
 * - Cleaner component type resolution via ComponentLibrary
 */

import type { Node as ReactFlowNode, Edge } from '@xyflow/react';
import type { Circuit, Node, Connection, PortPath } from '../types/ir-v0.1';
import type { MetadataState } from '../types';
import { WIRE_COLORS } from '../types';
import { useComponentLibraryStore } from '../stores/component-library-store';
import type { PortValueMap, SequentialState } from '../lib/simulator-v0.1';

// Custom data structure for our ReactFlow nodes
export interface NodeData extends Record<string, unknown> {
  nodeId: string;
  componentRef: string;
  label?: string;
  value?: boolean;
  numericValue?: number;
  width?: number;
  inputCount: number;
  outputCount: number;
  inputNames: string[];
  outputNames: string[];
  __pixels?: number[]; // For Screen component - pixel data from RAM
}

/**
 * Create port path key for value lookup
 */
function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

/**
 * Get node type for ReactFlow rendering based on component type
 */
function getNodeTypeForComponent(componentRef: string, inputCount: number, outputCount: number): string {
  // Primitive type mapping
  const typeMap: Record<string, string> = {
    Switch: 'inputNode',
    Input: 'numericInputNode',
    Led: 'outputNode',
    And: 'logicGateNode',
    Or: 'logicGateNode',
    Not: 'logicGateNode',
    Nand: 'logicGateNode',
    Nor: 'logicGateNode',
    Xor: 'logicGateNode',
    Xnor: 'logicGateNode',
    Buffer: 'logicGateNode',
    DFlipFlop: 'logicGateNode',
    Register: 'logicGateNode',
    RAM: 'logicGateNode',
    HexDisplay: 'outputNode',
    SevenSegment: 'outputNode',
    Screen: 'screenNode',
  };

  if (typeMap[componentRef]) {
    return typeMap[componentRef];
  }

  // For user-defined components, classify based on port counts
  if (inputCount === 0 && outputCount > 0) {
    return 'inputNode'; // Source components
  } else if (inputCount > 0 && outputCount === 0) {
    return 'outputNode'; // Sink components
  } else if (inputCount > 0 && outputCount > 0) {
    return 'logicGateNode'; // Processing components
  }

  return 'default';
}

/**
 * Project Circuit nodes to ReactFlow nodes
 */
export function projectCircuitToNodes(
  circuit: Circuit,
  metadata: MetadataState,
  portValues?: PortValueMap,
  seqState?: SequentialState
): ReactFlowNode<NodeData>[] {
  const reactFlowNodes: ReactFlowNode<NodeData>[] = [];
  const library = useComponentLibraryStore.getState();

  for (const node of circuit.nodes) {
    const nodeMetadata = metadata.components[node.id];

    if (!nodeMetadata) {
      console.warn(`Missing metadata for node ${node.id}`);
      continue;
    }

    // Get component definition from library
    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) {
      console.warn(`Component not found in library: ${node.componentRef}`);
      continue;
    }

    // Extract port information
    const inputCount = node.inputs.length;
    const outputCount = node.outputs.length;
    const inputNames = node.inputs.map((p) => p.name);
    const outputNames = node.outputs.map((p) => p.name);

    // Determine ReactFlow node type
    const nodeType = getNodeTypeForComponent(node.componentRef, inputCount, outputCount);

    // Extract component-specific values
    let value: boolean | undefined = undefined;
    let numericValue: number | undefined = undefined;
    let width: number | undefined = undefined;
    let pixels: number[] | undefined = undefined;

    if (node.componentRef === 'Switch' || node.componentRef === 'Led') {
      // For Switch/Led, check if there's a value in arguments or port values
      if ('value' in node.arguments) {
        value = Boolean(node.arguments.value);
      } else if (portValues) {
        // Try to get from port values (for Led, this is the input value)
        if (node.componentRef === 'Led' && node.inputs.length > 0) {
          const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
          const portValue = portValues.get(inputKey);
          value = Boolean(portValue);
        } else if (node.componentRef === 'Switch' && node.outputs.length > 0) {
          const outputKey = portPathKey({ nodeId: node.id, portName: node.outputs[0].name });
          const portValue = portValues.get(outputKey);
          value = Boolean(portValue);
        }
      }
    } else if (node.componentRef === 'Input') {
      numericValue = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
      width = typeof node.arguments.width === 'number' ? node.arguments.width : 8;
    } else if (node.componentRef === 'HexDisplay' || node.componentRef === 'SevenSegment') {
      // Get display value from port values
      if (portValues && node.inputs.length > 0) {
        const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
        const portValue = portValues.get(inputKey);
        numericValue = typeof portValue === 'number' ? portValue : 0;
      }
    } else if (node.componentRef === 'Screen') {
      // Memory-mapped display - burst DMA read via FrameSnapshotSource
      // Screen consumes framebuffer snapshot (simulates VBLANK refresh)
      pixels = new Array(64).fill(0);

      if (seqState) {
        const library = useComponentLibraryStore.getState();

        // Find all components that provide FrameSnapshotSource capability
        const providers: { nodeId: string; componentRef: string }[] = [];

        for (const n of circuit.nodes) {
          const componentDef = library.resolveComponent(n.componentRef);
          if (componentDef?.metadata?.provides?.includes('FrameSnapshotSource')) {
            providers.push({ nodeId: n.id, componentRef: n.componentRef });
          }
        }

        // Validate exactly one provider (enforces hardware constraint)
        if (providers.length !== 1) {
          console.error(
            `[Screen] ${node.id} requires exactly one FrameSnapshotSource, found ${providers.length}`
          );
          // Fall back to black screen
        } else {
          // Get snapshot from the provider
          const provider = providers[0];
          const providerState = seqState.currentState.get(provider.nodeId);

          if (providerState instanceof Map) {
            const memory = providerState as Map<number, number>;
            // Burst read framebuffer snapshot (addresses 0-63)
            for (let addr = 0; addr < 64; addr++) {
              pixels[addr] = memory.get(addr) ?? 0;
            }
          }
        }
      }
    }

    reactFlowNodes.push({
      id: node.id,
      type: nodeType,
      position: nodeMetadata.position,
      data: {
        nodeId: node.id,
        componentRef: node.componentRef,
        label: node.label,
        value,
        numericValue,
        width,
        inputCount,
        outputCount,
        inputNames,
        outputNames,
        __pixels: pixels,
      },
      selected: nodeMetadata.selected,
      selectable: true,
      deletable: true,
    });
  }

  return reactFlowNodes;
}

/**
 * Project Circuit connections to ReactFlow edges
 */
export function projectCircuitToEdges(
  circuit: Circuit,
  metadata: MetadataState,
  portValues?: PortValueMap
): Edge[] {
  const edges: Edge[] = [];

  for (const connection of circuit.connections) {
    const connectionMetadata = metadata.connections[connection.id];

    // Determine wire color based on signal value
    let edgeColor = WIRE_COLORS.UNDEFINED;

    if (portValues) {
      const sourceKey = portPathKey(connection.source);
      const value = portValues.get(sourceKey);

      if (value !== undefined) {
        if (typeof value === 'boolean') {
          edgeColor = value ? WIRE_COLORS.TRUE : WIRE_COLORS.FALSE;
        } else {
          // For bus values, use TRUE color if non-zero
          edgeColor = value !== 0 ? WIRE_COLORS.TRUE : WIRE_COLORS.FALSE;
        }
      }
    }

    // Use metadata color if provided
    const finalColor = connectionMetadata?.color || edgeColor;

    // Create handle IDs using port names (not indices!)
    const sourceHandle = `out-${connection.source.portName}`;
    const targetHandle = `in-${connection.target.portName}`;

    edges.push({
      id: connection.id,
      type: 'orthogonal',
      source: connection.source.nodeId,
      target: connection.target.nodeId,
      sourceHandle,
      targetHandle,
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
 * Main projection function
 */
export function projectCircuitToReactFlow(
  circuit: Circuit | null,
  metadata: MetadataState,
  portValues?: PortValueMap,
  seqState?: SequentialState
) {
  if (!circuit) {
    return { nodes: [], edges: [] };
  }

  return {
    nodes: projectCircuitToNodes(circuit, metadata, portValues, seqState),
    edges: projectCircuitToEdges(circuit, metadata, portValues),
  };
}
