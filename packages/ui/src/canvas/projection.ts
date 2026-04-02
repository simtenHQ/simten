/**
 * Pure projection utility for embed.
 * Converts Circuit + Metadata into ReactFlow nodes and edges.
 * No stores, no caches, no globals — explicit params only.
 */

import type { Node as ReactFlowNode, Edge } from '@xyflow/react';
import type { Circuit, PortPath } from '@turing-incomplete/core/dsl';
import type { ComponentLibrary, FlatPortValueMap, FlatSequentialState } from '@turing-incomplete/core/simulator';
import { getReferenceCircuit } from '@turing-incomplete/core/simulator';
import type { MetadataState } from './types';
import type { NodeData } from '../nodes';

export type { NodeData };

const WIRE_COLORS = {
  TRUE: '#22c55e',
  FALSE: '#94a3b8',
  UNDEFINED: '#cbd5e1',
};

function portPathKey(path: PortPath): string {
  return path.nodeId === '' ? `.${path.portName}` : `${path.nodeId}.${path.portName}`;
}

function getNodeTypeForComponent(componentRef: string, inputCount: number, outputCount: number): string {
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
    DualPortROM: 'rv32iInstrMemNode',
    Eth_FrameInput: 'ethFrameInputNode',
  };

  if (typeMap[componentRef]) return typeMap[componentRef];

  if (inputCount === 0 && outputCount > 0) return 'inputNode';
  if (inputCount > 0 && outputCount === 0) return 'outputNode';
  if (inputCount > 0 && outputCount > 0) return 'logicGateNode';

  return 'default';
}

/**
 * Project Circuit nodes to ReactFlow nodes.
 * Pure function — all state passed explicitly.
 */
function projectCircuitToNodes(
  circuit: Circuit,
  metadata: MetadataState,
  library: ComponentLibrary,
  portValues?: FlatPortValueMap,
  seqState?: FlatSequentialState,
): ReactFlowNode<NodeData>[] {
  const reactFlowNodes: ReactFlowNode<NodeData>[] = [];

  for (const node of circuit.nodes) {
    const nodeMetadata = metadata.components[node.id];
    if (!nodeMetadata) continue;

    const componentDef = library.resolveComponent(node.componentRef);
    if (!componentDef) continue;

    const inputCount = node.inputs.length;
    const outputCount = node.outputs.length;
    const inputNames = node.inputs.map((p) => p.name);
    const outputNames = node.outputs.map((p) => p.name);
    const nodeType = getNodeTypeForComponent(node.componentRef, inputCount, outputCount);

    let value: boolean | undefined = undefined;
    let numericValue: number | undefined = undefined;
    let width: number | undefined = undefined;
    let pixels: number[] | undefined = undefined;
    let consoleText: string | undefined = undefined;
    let uartText: string | undefined = undefined;
    let nicState: { txCount: number; rxCount: number; draining: boolean } | undefined = undefined;

    if (node.componentRef === 'Switch' || node.componentRef === 'Led') {
      let resolved = false;
      if (portValues) {
        if (node.componentRef === 'Led' && node.inputs.length > 0) {
          const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
          const portValue = portValues.get(inputKey);
          if (portValue !== undefined) { value = Boolean(portValue); resolved = true; }
        } else if (node.componentRef === 'Switch' && node.outputs.length > 0) {
          const outputKey = portPathKey({ nodeId: node.id, portName: node.outputs[0].name });
          const portValue = portValues.get(outputKey);
          if (portValue !== undefined) { value = Boolean(portValue); resolved = true; }
        }
      }
      if (!resolved && 'value' in node.arguments) {
        value = Boolean(node.arguments.value);
      }
    } else if (node.componentRef === 'Input') {
      width = typeof node.arguments.width === 'number' ? node.arguments.width : 8;
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
      if (portValues && node.inputs.length > 0) {
        const inputKey = portPathKey({ nodeId: node.id, portName: node.inputs[0].name });
        const portValue = portValues.get(inputKey);
        numericValue = typeof portValue === 'number' ? portValue : 0;
      }
    } else if (node.componentRef === 'Screen') {
      const screenW = (node.arguments.width as number) ?? 8;
      const screenH = (node.arguments.height as number) ?? 8;
      const totalPixels = screenW * screenH;
      pixels = new Array(totalPixels).fill(0);

      if (seqState && portValues) {
        const dataInConnection = Array.from(circuit.connections).find(
          conn => conn.target.nodeId === node.id && conn.target.portName === 'dataIn'
        );
        if (dataInConnection) {
          const sourceNode = circuit.nodes.find(n => n.id === dataInConnection.source.nodeId);
          if (sourceNode?.componentRef === 'DualPortRAM') {
            const ramState = seqState.currentState.get(sourceNode.id);
            if (ramState instanceof Map) {
              for (let addr = 0; addr < totalPixels; addr++) {
                pixels[addr] = (ramState as Map<number, number>).get(addr) ?? 0;
              }
            }
          } else if (sourceNode?.componentRef === 'Mux') {
            const selKey = portPathKey({ nodeId: sourceNode.id, portName: 'sel' });
            const selValue = portValues.get(selKey);
            const selectedInputPort = selValue === 0 ? 'in0' : 'in1';
            const muxInputConnection = Array.from(circuit.connections).find(
              conn => conn.target.nodeId === sourceNode.id && conn.target.portName === selectedInputPort
            );
            if (muxInputConnection) {
              const ramNode = circuit.nodes.find(n => n.id === muxInputConnection.source.nodeId);
              if (ramNode?.componentRef === 'DualPortRAM') {
                const ramState = seqState.currentState.get(ramNode.id);
                if (ramState instanceof Map) {
                  for (let addr = 0; addr < totalPixels; addr++) {
                    pixels[addr] = (ramState as Map<number, number>).get(addr) ?? 0;
                  }
                }
              }
            }
          }
        }
      }
    } else if (node.componentRef === 'RasterDisplay') {
      const rasterW = (node.arguments.width as number) ?? 8;
      const rasterH = (node.arguments.height as number) ?? 8;
      const rasterPixels = rasterW * rasterH;
      pixels = new Array(rasterPixels).fill(0);
      if (seqState) {
        const displayState = seqState.currentState.get(node.id);
        if (displayState instanceof Map) {
          for (let addr = 0; addr < rasterPixels; addr++) {
            pixels[addr] = (displayState as Map<number, number>).get(addr) ?? 0;
          }
        }
      }
    } else if (node.componentRef === 'Console') {
      if (seqState) {
        const consoleState = seqState.currentState.get(node.id);
        if (typeof consoleState === 'string') consoleText = consoleState;
      }
    } else if (node.componentRef === 'UART_TX') {
      if (seqState) {
        const uartState = seqState.currentState.get(node.id);
        if (typeof uartState === 'string') uartText = uartState;
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
      deletable: false,
    });
  }

  // Surface nested console/UART nodes
  if (seqState) {
    const existingNodeIds = new Set(reactFlowNodes.map(n => n.id));
    let consoleIndex = 0;

    for (const [nodeId, state] of seqState.currentState.entries()) {
      if (existingNodeIds.has(nodeId)) continue;
      if (typeof state === 'string') {
        const pathParts = nodeId.split('.');
        const shortLabel = pathParts.length > 1 ? pathParts.slice(-2).join('.') : nodeId;
        const isUart = nodeId.toLowerCase().includes('uart');

        reactFlowNodes.push({
          id: `__virtual_console_${consoleIndex}`,
          type: isUart ? 'uartTxNode' : 'consoleNode',
          position: { x: 600, y: 50 + (consoleIndex * 250) },
          data: {
            nodeId,
            componentRef: isUart ? 'UART_TX' : 'Console',
            label: isUart ? `UART (${shortLabel})` : `Console (${shortLabel})`,
            value: undefined,
            numericValue: undefined,
            width: undefined,
            inputCount: isUart ? 4 : 2,
            outputCount: 1,
            inputNames: isUart ? ['addr', 'write_data', 'mem_read', 'mem_write'] : ['data', 'we'],
            outputNames: isUart ? ['read_data'] : ['text'],
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

  return reactFlowNodes;
}

/**
 * Project Circuit connections to ReactFlow edges.
 * Pure function — no hidden state.
 */
function projectCircuitToEdges(
  circuit: Circuit,
  metadata: MetadataState,
  portValues?: FlatPortValueMap,
): Edge[] {
  const edges: Edge[] = [];

  for (const connection of circuit.connections) {
    const connectionMetadata = metadata.connections[connection.id];

    let edgeColor = WIRE_COLORS.UNDEFINED;
    if (portValues) {
      const value = portValues.get(portPathKey(connection.source))
        ?? portValues.get(portPathKey(connection.target));
      if (value !== undefined) {
        edgeColor = (typeof value === 'boolean' ? value : value !== 0)
          ? WIRE_COLORS.TRUE : WIRE_COLORS.FALSE;
      }
    }

    edges.push({
      id: connection.id,
      type: 'orthogonal',
      source: connection.source.nodeId,
      target: connection.target.nodeId,
      sourceHandle: `out-${connection.source.portName}`,
      targetHandle: `in-${connection.target.portName}`,
      style: { stroke: edgeColor, strokeWidth: 2 },
      animated: false,
      selected: connectionMetadata?.selected,
      selectable: false,
      deletable: false,
    });
  }

  return edges;
}

/**
 * Main projection function — pure, no side effects.
 */
export function projectCircuitToReactFlow(
  circuit: Circuit | null,
  metadata: MetadataState,
  library: ComponentLibrary,
  portValues?: FlatPortValueMap,
  seqState?: FlatSequentialState,
) {
  if (!circuit) return { nodes: [], edges: [] };

  return {
    nodes: projectCircuitToNodes(circuit, metadata, library, portValues, seqState),
    edges: projectCircuitToEdges(circuit, metadata, portValues),
  };
}
