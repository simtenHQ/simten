"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  applyNodeChanges,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type Node,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Circuit } from "@/features/dsl";
import type {
  FlatPortValueMap,
  FlatSequentialState,
} from "@/features/visual-editor/lib/flat-simulator";
import { projectCircuitToReactFlow } from "@/features/visual-editor/utils/projection";
import type { MetadataState } from "@/features/visual-editor/types";

// Import node components
import { InputNode } from "@/features/visual-editor/components/nodes/InputNode";
import { NumericInputNode } from "@/features/visual-editor/components/nodes/NumericInputNode";
import { OutputNode } from "@/features/visual-editor/components/nodes/OutputNode";
import { LogicGateNode } from "@/features/visual-editor/components/nodes/LogicGateNode";
import { RegisterNode } from "@/features/visual-editor/components/nodes/RegisterNode";

// Define node types for this mini canvas
const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  numericInputNode: NumericInputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  registerNode: RegisterNode,
  // Add minimal fallbacks for other types
  screenNode: LogicGateNode,
  rasterDisplayNode: LogicGateNode,
  ramNode: LogicGateNode,
  romNode: LogicGateNode,
  consoleNode: LogicGateNode,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Fit view button component (must be inside ReactFlow)
function FitViewButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.3 })}
      className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-1.5 rounded border border-gray-600 transition-colors"
      title="Fit view"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    </button>
  );
}

interface MiniCanvasProps {
  circuit: Circuit | null;
  portValues?: FlatPortValueMap | null;
  sequentialState?: FlatSequentialState | null;
  inputValues?: Record<string, boolean | number>; // Current input values from simulator
  onToggleInput?: (inputName: string) => void; // Callback when switch is clicked
  height?: number | string;
}

/**
 * Create an augmented circuit with explicit input/output port nodes
 * This makes the visualization show inputs coming in and outputs going out
 */
function augmentCircuitWithPorts(
  circuit: Circuit,
  inputValues?: Record<string, boolean | number>
): Circuit {
  // Create virtual nodes for circuit inputs (like Switch nodes)
  const inputPortNodes = circuit.inputs.map((input) => ({
    id: `__input_${input.name}`,
    label: input.name,
    componentRef: "Switch", // Render as input switch
    arguments: { value: inputValues?.[input.name] ?? false },
    inputs: [],
    outputs: [{ id: `__input_${input.name}.out`, name: "out", portType: input.portType }],
    clocks: [],
  }));

  // Create virtual nodes for circuit outputs (like LED nodes)
  const outputPortNodes = circuit.outputs.map((output) => ({
    id: `__output_${output.name}`,
    label: output.name,
    componentRef: "Led", // Render as output LED
    arguments: {},
    inputs: [{ id: `__output_${output.name}.in`, name: "in", portType: output.portType }],
    outputs: [],
    clocks: [],
  }));

  // Remap connections:
  // - Connections from "" (top-level input) become connections from __input_X.out
  // - Connections to "" (top-level output) become connections to __output_X.in
  const remappedConnections = circuit.connections.map((conn) => {
    let source = conn.source;
    let target = conn.target;

    // If source is top-level input, remap to virtual input node
    if (conn.source.nodeId === "") {
      source = {
        nodeId: `__input_${conn.source.portName}`,
        portName: "out",
      };
    }

    // If target is top-level output, remap to virtual output node
    if (conn.target.nodeId === "") {
      target = {
        nodeId: `__output_${conn.target.portName}`,
        portName: "in",
      };
    }

    return {
      id: conn.id,
      source,
      target,
      portType: conn.portType,
    };
  });

  return {
    ...circuit,
    nodes: [...inputPortNodes, ...circuit.nodes, ...outputPortNodes],
    connections: remappedConnections,
  };
}

/**
 * Remap port values to match augmented circuit node IDs
 * - __top__.inputName → __input_inputName.out
 * - __top__.outputName → __output_outputName.in (for wire coloring)
 */
function remapPortValues(
  portValues: FlatPortValueMap | null | undefined,
  circuit: Circuit
): FlatPortValueMap {
  const remapped = new Map<string, number | boolean>();

  if (!portValues) return remapped;

  // Copy all existing values
  for (const [key, value] of portValues.entries()) {
    remapped.set(key, value);
  }

  // Add remapped values for virtual input nodes
  for (const input of circuit.inputs) {
    const originalKey = `__top__.${input.name}`;
    const newKey = `__input_${input.name}.out`;
    const value = portValues.get(originalKey);
    if (value !== undefined) {
      remapped.set(newKey, value);
    }
  }

  // Add remapped values for virtual output nodes
  for (const output of circuit.outputs) {
    const originalKey = `__top__.${output.name}`;
    const newKey = `__output_${output.name}.in`;
    const value = portValues.get(originalKey);
    if (value !== undefined) {
      remapped.set(newKey, value);
    }
  }

  return remapped;
}

/**
 * Auto-layout nodes in a simple grid/flow pattern
 */
function autoLayoutCircuit(circuit: Circuit): MetadataState {
  const metadata: MetadataState = {
    components: {},
    connections: {},
  };

  if (!circuit || !circuit.nodes) return metadata;

  // Separate into columns: inputs, middle (impl nodes), outputs
  const inputPortNodes: string[] = [];
  const implNodes: string[] = [];
  const outputPortNodes: string[] = [];

  for (const node of circuit.nodes) {
    if (node.id.startsWith("__input_")) {
      inputPortNodes.push(node.id);
    } else if (node.id.startsWith("__output_")) {
      outputPortNodes.push(node.id);
    } else {
      implNodes.push(node.id);
    }
  }

  // Position nodes
  const SPACING_X = 160;
  const SPACING_Y = 70;
  const START_X = 30;
  const START_Y = 40;

  // Calculate vertical centering
  const maxRows = Math.max(inputPortNodes.length, implNodes.length, outputPortNodes.length, 1);
  const totalHeight = (maxRows - 1) * SPACING_Y;

  // Input port nodes on left
  const inputStartY = START_Y + (totalHeight - (inputPortNodes.length - 1) * SPACING_Y) / 2;
  inputPortNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = {
      id: nodeId,
      position: { x: START_X, y: inputStartY + i * SPACING_Y },
    };
  });

  // Impl nodes in center (may need multiple columns for complex circuits)
  const implCols = Math.ceil(implNodes.length / 3);
  const implStartY = START_Y + (totalHeight - (Math.min(implNodes.length, 3) - 1) * SPACING_Y) / 2;
  implNodes.forEach((nodeId, i) => {
    const col = Math.floor(i / 3);
    const row = i % 3;
    metadata.components[nodeId] = {
      id: nodeId,
      position: {
        x: START_X + SPACING_X + col * SPACING_X,
        y: implStartY + row * SPACING_Y,
      },
    };
  });

  // Output port nodes on right
  const outputX = START_X + SPACING_X * (1 + Math.max(implCols, 1));
  const outputStartY = START_Y + (totalHeight - (outputPortNodes.length - 1) * SPACING_Y) / 2;
  outputPortNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = {
      id: nodeId,
      position: { x: outputX, y: outputStartY + i * SPACING_Y },
    };
  });

  return metadata;
}

export function MiniCanvas({
  circuit,
  portValues,
  sequentialState,
  inputValues,
  onToggleInput,
  height = "100%",
}: MiniCanvasProps) {
  // Augment circuit with explicit input/output port nodes
  const augmentedCircuit = useMemo(() => {
    if (!circuit) return null;
    return augmentCircuitWithPorts(circuit, inputValues);
  }, [circuit, inputValues]);

  // Remap port values to match augmented node IDs
  const remappedPortValues = useMemo(() => {
    if (!circuit || !portValues) return undefined;
    return remapPortValues(portValues, circuit);
  }, [circuit, portValues]);

  // Auto-generate layout metadata
  const metadata = useMemo(() => {
    if (!augmentedCircuit) return { components: {}, connections: {} };
    return autoLayoutCircuit(augmentedCircuit);
  }, [augmentedCircuit]);

  // Project to React Flow format and add click handlers to input nodes
  const { projectedNodes, edges } = useMemo(() => {
    if (!augmentedCircuit) return { projectedNodes: [], edges: [] };
    const projected = projectCircuitToReactFlow(
      augmentedCircuit,
      metadata,
      remappedPortValues,
      sequentialState ?? undefined
    );

    // Add onToggle callback to virtual input nodes
    const nodesWithHandlers = projected.nodes.map((node) => {
      if (node.id.startsWith('__input_') && onToggleInput) {
        const inputName = node.id.replace('__input_', '');
        return {
          ...node,
          data: {
            ...node.data,
            onToggle: () => onToggleInput(inputName),
          },
        };
      }
      return node;
    });

    return { projectedNodes: nodesWithHandlers, edges: projected.edges };
  }, [augmentedCircuit, metadata, remappedPortValues, sequentialState, onToggleInput]);

  // Store node positions in state so dragging works
  const [nodes, setNodes] = useState<Node[]>([]);

  // Update nodes when projected nodes change, preserving user-dragged positions
  useEffect(() => {
    setNodes((currentNodes) => {
      // Create a map of current positions
      const positionMap = new Map(currentNodes.map(n => [n.id, n.position]));

      // Merge projected nodes with stored positions
      return projectedNodes.map(node => ({
        ...node,
        position: positionMap.get(node.id) ?? node.position,
      }));
    });
  }, [projectedNodes]);

  // Handle node changes (dragging)
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  if (!circuit) {
    return (
      <div
        className="bg-gray-900 rounded-lg flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        No circuit
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden" style={{ height }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={[1, 2]}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          preventScrolling={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#374151"
          />
          <Panel position="bottom-left">
            <FitViewButton />
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
