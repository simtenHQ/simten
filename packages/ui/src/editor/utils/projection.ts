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
import { getReferenceCircuit } from '@turing-incomplete/core/simulator';
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
  arguments?: Record<string, unknown>; // Primitive arguments (e.g., { width: 16 })
  __pixels?: number[]; // For Screen component - pixel data from RAM
  __consoleText?: string; // For Console component - accumulated text
  __uartText?: string; // For UART_TX component - accumulated text
  __nicState?: { txCount: number; rxCount: number; draining: boolean }; // For NIC_FIFO component
  onToggle?: () => void; // Optional callback for input toggle (used by MiniCanvas/Inspector)
  onValueChange?: (value: number) => void; // Optional callback for numeric input change (used by Inspector)
  showPortLabels?: boolean; // Show port name labels next to handles
  onPortClick?: (portName: string, portType: 'input' | 'output') => void; // Port click callback
  glowUnconnected?: boolean; // Pulse unconnected ports
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
    UART_TX: 'uartTxNode',
    NIC_FIFO: 'nicFifoNode',
    Constant: 'logicGateNode',
    RV32I_InstrMem: 'rv32iInstrMemNode',
    Eth_FrameInput: 'ethFrameInputNode',
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
    let uartText: string | undefined = undefined;
    let nicState: { txCount: number; rxCount: number; draining: boolean } | undefined = undefined;

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
      // The typical wiring: Screen.addrB -> RAM.addrB, RAM.outB -> Screen.dataIn
      const screenW = (node.arguments.width as number) ?? 8;
      const screenH = (node.arguments.height as number) ?? 8;
      const totalPixels = screenW * screenH;
      pixels = new Array(totalPixels).fill(0);

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
              for (let addr = 0; addr < totalPixels; addr++) {
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
                  for (let addr = 0; addr < totalPixels; addr++) {
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
      const rasterW = (node.arguments.width as number) ?? 8;
      const rasterH = (node.arguments.height as number) ?? 8;
      const rasterPixels = rasterW * rasterH;
      pixels = new Array(rasterPixels).fill(0);

      if (seqState) {
        const displayState = seqState.currentState.get(node.id);

        if (displayState instanceof Map) {
          const state = displayState as Map<number, number>;
          // Read pixel data (excluding -1/-2 which are scanX/scanY)
          for (let addr = 0; addr < rasterPixels; addr++) {
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
    } else if (node.componentRef === 'UART_TX') {
      if (seqState) {
        const uartState = seqState.currentState.get(node.id);
        if (typeof uartState === 'string') {
          uartText = uartState;
        }
      }
    } else if (node.componentRef === 'NIC_FIFO') {
      if (seqState) {
        const state = seqState.currentState.get(node.id);
        if (state instanceof Map) {
          const s = state as Map<number, number>;
          const txWp = s.get(0x2000) ?? 0;
          const txRp = s.get(0x2001) ?? 0;
          const rxCount = s.get(0x2012) ?? 0;
          const draining = (s.get(0x2004) ?? 0) !== 0;
          nicState = { txCount: txWp - txRp, rxCount, draining };
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
        arguments: node.arguments,
        __pixels: pixels,
        __consoleText: consoleText,
        __uartText: uartText,
        __nicState: nicState,
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

      // Check if this looks like a Console/UART_TX state (string type)
      if (typeof state === 'string') {
        const pathParts = nodeId.split('.');
        const shortLabel = pathParts.length > 1
          ? pathParts.slice(-2).join('.')
          : nodeId;

        // Determine if this is a UART_TX or Console based on node ID
        const isUart = nodeId.toLowerCase().includes('uart');
        const nodeType = isUart ? 'uartTxNode' : 'consoleNode';
        const componentRef = isUart ? 'UART_TX' : 'Console';
        const label = isUart ? `UART (${shortLabel})` : `Console (${shortLabel})`;

        reactFlowNodes.push({
          id: `__virtual_console_${consoleIndex}`,
          type: nodeType,
          position: {
            x: 600,
            y: 50 + (consoleIndex * 250)
          },
          data: {
            nodeId: nodeId,
            componentRef,
            label,
            value: undefined,
            numericValue: undefined,
            width: undefined,
            inputCount: isUart ? 4 : 2,
            outputCount: 1,
            inputNames: isUart ? ['addr', 'write_data', 'mem_read', 'mem_write'] : ['data', 'we'],
            outputNames: isUart ? ['read_data'] : ['text'],
            __pixels: undefined,
            __consoleText: isUart ? undefined : state,
            __uartText: isUart ? state : undefined,
          },
          selected: false,
          selectable: false,
          deletable: false,
        });
        consoleIndex++;
      }
    }
  }

  // Look for RV32I_InstrMem primitives nested in subcircuits that aren't already projected
  // This surfaces InstrMem nodes so users can load programs into sub-circuit CPUs
  if (seqState) {
    const existingNodeIds = new Set(reactFlowNodes.map(n => n.id));
    let instrMemIndex = 0;

    for (const [nodeId, state] of seqState.currentState.entries()) {
      if (existingNodeIds.has(nodeId)) continue;

      // InstrMem state is a Map (memory data) and the node ID contains 'imem' or 'instrmem'
      const isInstrMem = state instanceof Map &&
        (nodeId.toLowerCase().includes('imem') || nodeId.toLowerCase().includes('instrmem')) &&
        !nodeId.toLowerCase().includes('imem_data'); // exclude the read-only data port copy

      if (isInstrMem) {
        const pathParts = nodeId.split('.');
        // Build a short label like "cpu0.imem" from the long elaborated path
        const shortLabel = pathParts.length > 1
          ? pathParts.slice(-2).join('.')
          : nodeId;
        // Try to extract a friendly CPU name (e.g., "cpu0", "cpu1")
        const cpuMatch = nodeId.match(/cpu(\d+)/i);
        const label = cpuMatch ? `CPU${cpuMatch[1]} InstrMem` : `InstrMem (${shortLabel})`;

        reactFlowNodes.push({
          id: `__virtual_instrmem_${instrMemIndex}`,
          type: 'rv32iInstrMemNode',
          position: {
            x: 600,
            y: 500 + (instrMemIndex * 250)
          },
          data: {
            nodeId: nodeId,
            componentRef: 'RV32I_InstrMem',
            label,
            value: undefined,
            numericValue: undefined,
            width: undefined,
            inputCount: 1,
            outputCount: 1,
            inputNames: ['addr'],
            outputNames: ['instruction'],
          },
          selected: false,
          selectable: false,
          deletable: false,
        });
        instrMemIndex++;
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
