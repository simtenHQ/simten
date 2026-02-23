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
import type { Circuit, Node, Connection, PortPath } from '../types/circuit';
import type { MetadataState } from '../types';
import { WIRE_COLORS } from '../types';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { getReferenceCircuit } from '@/core/simulator';
import type { FlatPortValueMap, FlatSequentialState } from '../lib/flat-simulator';

// Alias for backward compatibility
type PortValueMap = FlatPortValueMap;

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
  isComposite?: boolean; // True if this node is a composite component (drillable)
  __pixels?: number[]; // For Screen component - pixel data from RAM
  __consoleText?: string; // For Console component - accumulated text
  onToggle?: () => void; // Optional callback for input toggle (used by MiniCanvas/Inspector)
  onValueChange?: (value: number) => void; // Optional callback for numeric input change (used by Inspector)
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
    Register: 'registerNode',
    RAM: 'ramNode',
    ROM: 'romNode',
    HexDisplay: 'outputNode',
    SevenSegment: 'outputNode',
    Screen: 'screenNode',
    RasterDisplay: 'rasterDisplayNode',
    Console: 'consoleNode',
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
  seqState?: FlatSequentialState
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
    let consoleText: string | undefined = undefined;

    if (node.componentRef === 'Switch' || node.componentRef === 'Led') {
      // For Switch/Led, prefer port values (reflects actual simulation state)
      // then fall back to arguments (initial/configured value).
      // This is important for the inspector dialog where the simulator updates
      // port values but the circuit node arguments stay at their initial values.
      let resolved = false;

      if (portValues) {
        if (node.componentRef === 'Led' && node.inputs.length > 0) {
          const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
          const portValue = portValues.get(inputKey);
          if (portValue !== undefined) {
            value = Boolean(portValue);
            resolved = true;
          }
        } else if (node.componentRef === 'Switch' && node.outputs.length > 0) {
          const outputKey = portPathKey({ nodeId: node.id, portName: node.outputs[0].name });
          const portValue = portValues.get(outputKey);
          if (portValue !== undefined) {
            value = Boolean(portValue);
            resolved = true;
          }
        }
      }

      if (!resolved && 'value' in node.arguments) {
        value = Boolean(node.arguments.value);
      }
    } else if (node.componentRef === 'Input') {
      width = typeof node.arguments.width === 'number' ? node.arguments.width : 8;

      // Prefer port values (reflects simulator state) over arguments (initial value)
      let numResolved = false;
      if (portValues && node.outputs.length > 0) {
        const outputKey = portPathKey({ nodeId: node.id, portName: node.outputs[0].name });
        const portValue = portValues.get(outputKey);
        if (portValue !== undefined && typeof portValue === 'number') {
          numericValue = portValue;
          numResolved = true;
        }
      }
      if (!numResolved) {
        numericValue = typeof node.arguments.value === 'number' ? node.arguments.value : 0;
      }
    } else if (node.componentRef === 'HexDisplay' || node.componentRef === 'SevenSegment') {
      // Get display value from port values
      if (portValues && node.inputs.length > 0) {
        const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
        const portValue = portValues.get(inputKey);
        numericValue = typeof portValue === 'number' ? portValue : 0;
      }
    } else if (node.componentRef === 'Screen') {
      // Screen reads from dataIn port (explicit wiring)
      // The typical wiring: Screen.addrB -> RAM.addrB, RAM.dataB -> Screen.dataIn
      pixels = new Array(64).fill(0);

      if (seqState && portValues) {
        // Read pixels by tracing the dataIn connection
        // Supports direct RAM connection or mux-based double buffering

        // Find what's providing data to Screen.dataIn by tracing connections
        const dataInConnection = Array.from(circuit.connections).find(
          conn => conn.target.nodeId === node.id && conn.target.portName === 'dataIn'
        );

        if (dataInConnection) {
          const sourceNodeId = dataInConnection.source.nodeId;
          const sourceNode = circuit.nodes.find(n => n.id === sourceNodeId);

          // If connected directly to a RAM, read from it
          if (sourceNode?.componentRef === 'DualPortRAM') {
            const ramState = seqState.currentState.get(sourceNode.id);
            if (ramState instanceof Map) {
              for (let addr = 0; addr < 64; addr++) {
                pixels[addr] = ramState.get(addr) ?? 0;
              }
            }
          } else if (sourceNode?.componentRef === 'Mux') {
            // Connected through a mux (double buffering case)
            // Determine which input is selected and read from that RAM
            const selKey = portPathKey({ nodeId: sourceNode.id, portName: 'sel' });
            const selValue = portValues.get(selKey);

            // Find which input is selected (0 or 1)
            const selectedInputPort = selValue === 0 ? 'in0' : 'in1';

            // Find connection to that input
            const muxInputConnection = Array.from(circuit.connections).find(
              conn =>
                conn.target.nodeId === sourceNode.id &&
                conn.target.portName === selectedInputPort
            );

            if (muxInputConnection) {
              const ramNode = circuit.nodes.find(n => n.id === muxInputConnection.source.nodeId);
              if (ramNode?.componentRef === 'DualPortRAM') {
                const ramState = seqState.currentState.get(ramNode.id);
                if (ramState instanceof Map) {
                  for (let addr = 0; addr < 64; addr++) {
                    pixels[addr] = ramState.get(addr) ?? 0;
                  }
                }
              }
            }
          }
        }
      }
    } else if (node.componentRef === 'RasterDisplay') {
      // Hardware-accurate raster display - reads pixels from internal state
      // RasterDisplay stores pixels directly in its state Map (keys 0-63)
      pixels = new Array(64).fill(0);

      if (seqState) {
        const displayState = seqState.currentState.get(node.id);

        if (displayState instanceof Map) {
          const state = displayState as Map<number, number>;
          // Read pixel data (keys 0-63, excluding -1/-2 which are scanX/scanY)
          for (let addr = 0; addr < 64; addr++) {
            pixels[addr] = state.get(addr) ?? 0;
          }
        }
      }
    } else if (node.componentRef === 'Console') {
      // Console accumulates written characters as text
      // State is stored as a string directly
      if (seqState) {
        const consoleState = seqState.currentState.get(node.id);
        if (typeof consoleState === 'string') {
          consoleText = consoleState;
        }
      }
    }

    // Detect composite components (user can drill into these)
    // Also includes primitives with reference circuits (educational drill-down)
    const hasReferenceCircuit = componentDef.implementation.kind === 'primitive'
      && getReferenceCircuit(node.componentRef) !== undefined;
    const isComposite = componentDef.implementation.kind === 'composite' || hasReferenceCircuit;

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
        isComposite,
        __pixels: pixels,
        __consoleText: consoleText,
      },
      selected: nodeMetadata.selected,
      selectable: true,
      deletable: true,
    });
  }

  // Look for Console primitives in flattened state that aren't already projected
  // This handles consoles that are nested deep inside subcircuits
  if (seqState) {
    const existingNodeIds = new Set(reactFlowNodes.map(n => n.id));
    let consoleIndex = 0;

    for (const [nodeId, state] of seqState.currentState.entries()) {
      // Skip if already projected
      if (existingNodeIds.has(nodeId)) continue;

      // Check if this looks like a Console state (string type)
      if (typeof state === 'string') {
        // Extract a readable label from the node ID
        const pathParts = nodeId.split('.');
        const shortLabel = pathParts.length > 1
          ? pathParts.slice(-2).join('.')
          : nodeId;

        // Create a virtual ConsoleNode for this nested console
        reactFlowNodes.push({
          id: `__virtual_console_${consoleIndex}`,
          type: 'consoleNode',
          position: {
            x: 600,
            y: 50 + (consoleIndex * 250)
          },
          data: {
            nodeId: nodeId,
            componentRef: 'Console',
            label: `Console (${shortLabel})`,
            value: undefined,
            numericValue: undefined,
            width: undefined,
            inputCount: 2,
            outputCount: 1,
            inputNames: ['data', 'we'],
            outputNames: ['text'],
            __pixels: undefined,
            __consoleText: state,
          },
          selected: false,
          selectable: false,
          deletable: false,
        });
        consoleIndex++;
      }
    }
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
  seqState?: FlatSequentialState
) {
  if (!circuit) {
    return { nodes: [], edges: [] };
  }

  return {
    nodes: projectCircuitToNodes(circuit, metadata, portValues, seqState),
    edges: projectCircuitToEdges(circuit, metadata, portValues),
  };
}
