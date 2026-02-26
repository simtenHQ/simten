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

import type { Circuit } from "@turing-incomplete/core/dsl";
import type {
  FlatPortValueMap,
  FlatSequentialState,
} from "../editor/lib/flat-simulator";
import { projectCircuitToReactFlow, type NodeData } from "../editor/utils/projection";
import type { MetadataState } from "../editor/types";
import { useInspectorStore } from "../editor/stores/expansion-store";
import { useComponentLibraryStore } from "../editor/stores/component-library-store";
import { getCompiledReferenceCircuit } from "../editor/utils/reference-circuit-cache";
import { CompositeInspectorDialog } from "../editor/components/CompositeInspectorDialog";

// Import node components
import { InputNode } from "../editor/components/nodes/InputNode";
import { OutputNode } from "../editor/components/nodes/OutputNode";
import { LogicGateNode } from "../editor/components/nodes/LogicGateNode";
import { EmbedConsoleNode } from "./EmbedConsoleNode";
import { EmbedScreenNode } from "./EmbedScreenNode";

// Define node types with lightweight console/screen support
const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  // Fallbacks
  numericInputNode: InputNode,
  registerNode: LogicGateNode,
  ramNode: LogicGateNode,
  romNode: LogicGateNode,
  // Lightweight standalone display nodes
  consoleNode: EmbedConsoleNode,
  screenNode: EmbedScreenNode,
  rasterDisplayNode: EmbedScreenNode,
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

interface EmbedCanvasProps {
  circuit: Circuit | null;
  portValues?: FlatPortValueMap | null;
  sequentialState?: FlatSequentialState | null;
  onToggleNode?: (nodeId: string) => void;
  onSetNodeValue?: (nodeId: string, value: number) => void;
  height?: number | string;
  /** Override positions by node label (cleaned). Unmatched nodes fall back to auto-layout. */
  nodePositions?: Record<string, { x: number; y: number }>;
  /** Show only specific nodes at full opacity; others are dimmed. Simulation still runs on the full circuit. */
  focus?: string | string[];
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

export function EmbedCanvas({
  circuit,
  portValues,
  sequentialState,
  onToggleNode,
  onSetNodeValue,
  height = "100%",
  nodePositions,
  focus,
}: EmbedCanvasProps) {
  // Normalize focus to a Set of labels
  const focusLabels = useMemo(() => {
    if (!focus) return null;
    const arr = Array.isArray(focus) ? focus : [focus];
    return new Set(arr);
  }, [focus]);

  // Clean up labels for display
  const cleanedCircuit = useMemo(() => {
    return circuit ? cleanCircuitLabels(circuit) : null;
  }, [circuit]);

  // Auto-generate layout, then apply any position overrides by label
  const metadata = useMemo(() => {
    if (!cleanedCircuit) return { components: {}, connections: {} };
    const base = autoLayoutCircuit(cleanedCircuit);
    if (!nodePositions) return base;
    // Apply overrides: match node label to nodePositions keys
    for (const node of cleanedCircuit.nodes) {
      const label = node.label || node.id;
      if (nodePositions[label]) {
        base.components[node.id] = {
          id: node.id,
          position: nodePositions[label],
        };
      }
    }
    return base;
  }, [cleanedCircuit, nodePositions]);

  // Project to React Flow format
  const { projectedNodes, edges } = useMemo(() => {
    if (!cleanedCircuit) return { projectedNodes: [], edges: [] };
    const projected = projectCircuitToReactFlow(
      cleanedCircuit,
      metadata,
      portValues ?? undefined,
      sequentialState ?? undefined
    );

    // Add callbacks to interactive nodes
    const nodesWithHandlers = projected.nodes.map((node) => {
      const componentRef = node.data?.componentRef;
      if (componentRef === 'Input' && onSetNodeValue) {
        return {
          ...node,
          data: {
            ...node.data,
            onValueChange: (value: number) => onSetNodeValue(node.id, value),
          },
        };
      }
      if (onToggleNode && (componentRef === 'Switch' || componentRef === 'Button')) {
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

    // Apply focus dimming
    if (focusLabels) {
      const focusedNodeIds = new Set<string>();
      for (const node of nodesWithHandlers) {
        const label = node.data?.label ?? node.id;
        if (focusLabels.has(label)) {
          focusedNodeIds.add(node.id);
        }
      }

      const dimmedNodes = nodesWithHandlers.map((node) => {
        const label = node.data?.label ?? node.id;
        const isFocused = focusLabels.has(label);
        return {
          ...node,
          style: {
            ...node.style,
            opacity: isFocused ? 1 : 0.15,
            transition: 'opacity 0.2s',
          },
        };
      });

      const dimmedEdges = projected.edges.map((edge) => {
        const sourceFocused = focusedNodeIds.has(edge.source);
        const targetFocused = focusedNodeIds.has(edge.target);
        const edgeFocused = sourceFocused || targetFocused;
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: edgeFocused ? 1 : 0.15,
            transition: 'opacity 0.2s',
          },
        };
      });

      return { projectedNodes: dimmedNodes, edges: dimmedEdges };
    }

    return { projectedNodes: nodesWithHandlers, edges: projected.edges };
  }, [cleanedCircuit, metadata, portValues, sequentialState, onToggleNode, focusLabels]);

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

  // Composite inspection on double-click
  const openInspector = useInspectorStore((state) => state.open);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const data = node.data as NodeData;
      if (!data.isComposite) return;

      const componentDef = resolveComponent(data.componentRef);
      if (!componentDef) return;

      const domNode = document.querySelector(`[data-id="${node.id}"]`);
      const rect = domNode?.getBoundingClientRect();
      const originRect = rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined;

      if (componentDef.implementation.kind === "composite") {
        openInspector(data.componentRef, componentDef, data.label || data.componentRef, originRect);
      } else {
        const store = useComponentLibraryStore.getState();
        const refCircuit = getCompiledReferenceCircuit(data.componentRef, store, data.arguments as Record<string, number> | undefined);
        if (refCircuit) {
          openInspector(data.componentRef, refCircuit, data.label || data.componentRef, originRect);
        }
      }
    },
    [resolveComponent, openInspector],
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
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          fitViewOptions={{
            padding: 0.3,
            ...(focusLabels && {
              nodes: nodes.filter((n) => {
                const label = n.data?.label ?? n.id;
                return focusLabels.has(label as string);
              }),
            }),
          }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={[1, 2]}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
          <Panel position="bottom-left">
            <FitViewButton />
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
      <CompositeInspectorDialog />
    </div>
  );
}
