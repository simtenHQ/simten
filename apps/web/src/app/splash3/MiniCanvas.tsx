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
import { OutputNode } from "@/features/visual-editor/components/nodes/OutputNode";
import { LogicGateNode } from "@/features/visual-editor/components/nodes/LogicGateNode";

// Define node types for this mini canvas
const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  // Fallbacks
  numericInputNode: InputNode,
  registerNode: LogicGateNode,
  screenNode: LogicGateNode,
  rasterDisplayNode: LogicGateNode,
  ramNode: LogicGateNode,
  romNode: LogicGateNode,
  consoleNode: LogicGateNode,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Fit view button component
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
  onToggleNode?: (nodeId: string) => void;
  height?: number | string;
}

/**
 * Auto-layout nodes: inputs left, implementation center, outputs right.
 */
function autoLayoutCircuit(circuit: Circuit): MetadataState {
  const metadata: MetadataState = { components: {}, connections: {} };
  if (!circuit?.nodes) return metadata;

  const inputNodes: string[] = [];
  const implNodes: string[] = [];
  const outputNodes: string[] = [];

  for (const node of circuit.nodes) {
    const ref = node.componentRef;
    if (ref === 'Switch' || ref === 'Input' || ref === 'Button') {
      inputNodes.push(node.id);
    } else if (ref === 'Led' || ref === 'Output') {
      outputNodes.push(node.id);
    } else {
      implNodes.push(node.id);
    }
  }

  const SPACING_X = 160;
  const SPACING_Y = 70;
  const START_X = 30;
  const START_Y = 40;

  const maxRows = Math.max(inputNodes.length, implNodes.length, outputNodes.length, 1);
  const totalHeight = (maxRows - 1) * SPACING_Y;

  // Input nodes on left
  const inputStartY = START_Y + (totalHeight - (inputNodes.length - 1) * SPACING_Y) / 2;
  inputNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = {
      id: nodeId,
      position: { x: START_X, y: inputStartY + i * SPACING_Y },
    };
  });

  // Impl nodes in center
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

  // Output nodes on right
  const outputX = START_X + SPACING_X * (1 + Math.max(implCols, 1));
  const outputStartY = START_Y + (totalHeight - (outputNodes.length - 1) * SPACING_Y) / 2;
  outputNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = {
      id: nodeId,
      position: { x: outputX, y: outputStartY + i * SPACING_Y },
    };
  });

  return metadata;
}

/**
 * Extract clean label from node ID (removes timestamps and prefixes).
 */
function extractCleanLabel(nodeId: string): string {
  if (nodeId.includes('.')) {
    return extractCleanLabel(nodeId.split('.').pop() || nodeId);
  }
  const parts = nodeId.split('_');
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{10,}$/.test(parts[i])) {
      const nameParts = parts.slice(0, i);
      if (nameParts.length > 1 && /^[A-Z]/.test(nameParts[0])) {
        return nameParts.slice(1).join('_') || nameParts[0];
      }
      return nameParts.join('_') || nodeId;
    }
  }
  return nodeId;
}

/**
 * Clean up node labels for display.
 */
function cleanCircuitLabels(circuit: Circuit): Circuit {
  return {
    ...circuit,
    nodes: circuit.nodes.map(node => ({
      ...node,
      label: extractCleanLabel(node.label || node.id),
    })),
  };
}

export function MiniCanvas({
  circuit,
  portValues,
  sequentialState,
  onToggleNode,
  height = "100%",
}: MiniCanvasProps) {
  // Clean up labels for display
  const cleanedCircuit = useMemo(() => {
    return circuit ? cleanCircuitLabels(circuit) : null;
  }, [circuit]);

  // Auto-generate layout
  const metadata = useMemo(() => {
    if (!cleanedCircuit) return { components: {}, connections: {} };
    return autoLayoutCircuit(cleanedCircuit);
  }, [cleanedCircuit]);

  // Project to React Flow format
  const { projectedNodes, edges } = useMemo(() => {
    if (!cleanedCircuit) return { projectedNodes: [], edges: [] };
    const projected = projectCircuitToReactFlow(
      cleanedCircuit,
      metadata,
      portValues ?? undefined,
      sequentialState ?? undefined
    );

    // Add onToggle callback to Switch nodes
    const nodesWithHandlers = projected.nodes.map((node) => {
      const componentRef = node.data?.componentRef;
      if (onToggleNode && (componentRef === 'Switch' || componentRef === 'Input' || componentRef === 'Button')) {
        return {
          ...node,
          data: {
            ...node.data,
            onToggle: () => onToggleNode(node.id),
          },
        };
      }
      return node;
    });

    return { projectedNodes: nodesWithHandlers, edges: projected.edges };
  }, [cleanedCircuit, metadata, portValues, sequentialState, onToggleNode]);

  // Store node positions for dragging
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map(n => [n.id, n.position]));
      return projectedNodes.map(node => ({
        ...node,
        position: positionMap.get(node.id) ?? node.position,
      }));
    });
  }, [projectedNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  if (!circuit) {
    return (
      <div className="bg-gray-900 rounded-lg flex items-center justify-center text-gray-500" style={{ height }}>
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
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
          <Panel position="bottom-left">
            <FitViewButton />
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
