"use client";

import React, { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
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

import { EMBED_NODE_TYPES, EDGE_TYPES } from "./node-types";
import { cleanCircuitLabels } from "./label-utils";
import { useElkLayout } from "./useElkLayout";

// ---------------------------------------------------------------------------
// FitViewButton
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CircuitCanvasProps {
  circuit?: Circuit | null;
  portValues?: FlatPortValueMap | null;
  sequentialState?: FlatSequentialState | null;
  draggable?: boolean;
  drillDown?: boolean;
  autoLayout?: boolean;
  /** Override positions by node label (cleaned). Unmatched nodes fall back to auto-layout. */
  nodePositions?: Record<string, { x: number; y: number }>;
  /** Pre-computed metadata from the editor store. Skips ELK layout and nodePositions when provided. */
  metadata?: MetadataState;
  onToggleNode?: (nodeId: string) => void;
  onSetNodeValue?: (nodeId: string, value: number) => void;
  height?: number | string;
  /** Show only specific nodes at full opacity; others are dimmed. */
  focus?: string | string[];
  theme?: "light" | "dark";
  className?: string;
  renderEmptyState?: () => ReactNode;
  /** Render overlay content outside ReactFlow but inside the canvas container. */
  renderOverlay?: () => ReactNode;
  /** Override node type map (defaults to EMBED_NODE_TYPES). */
  nodeTypes?: NodeTypes;
  /** Override edge type map (defaults to EDGE_TYPES). */
  edgeTypes?: EdgeTypes;
  /** Show ReactFlow Controls widget instead of minimal FitViewButton. */
  showControls?: boolean;
  /** Render the CompositeInspectorDialog inside this canvas. Set to false when a parent already renders it. */
  renderInspector?: boolean;

  // --- Editing mode ---

  /** Enable editing capabilities: connect, delete, selection tracking, drag-and-drop. */
  editable?: boolean;
  onNodePositionChange?: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeSelect?: (nodeId: string, selected: boolean) => void;
  onNodesDelete?: (nodeIds: string[]) => void;
  onEdgeSelect?: (edgeId: string, selected: boolean) => void;
  onEdgesDelete?: (edgeIds: string[]) => void;
  onConnect?: (source: { nodeId: string; portName: string }, target: { nodeId: string; portName: string }) => void;
  onDrop?: (componentType: string, position: { x: number; y: number }) => void;
  onNodeDragStop?: () => void;
}

// ---------------------------------------------------------------------------
// Inner component (must be inside ReactFlowProvider)
// ---------------------------------------------------------------------------

function CircuitCanvasInner({
  circuit,
  portValues,
  sequentialState,
  draggable = true,
  drillDown = true,
  autoLayout = true,
  nodePositions,
  metadata: metadataProp,
  onToggleNode,
  onSetNodeValue,
  height = "100%",
  focus,
  theme = "dark",
  className,
  renderEmptyState,
  renderOverlay,
  nodeTypes: nodeTypesOverride,
  edgeTypes: edgeTypesOverride,
  showControls = false,
  editable = false,
  onNodePositionChange,
  onNodeSelect,
  onNodesDelete,
  onEdgeSelect,
  onEdgesDelete,
  onConnect: onConnectProp,
  onDrop: onDropProp,
  onNodeDragStop,
}: CircuitCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const resolvedNodeTypes = nodeTypesOverride ?? EMBED_NODE_TYPES;
  const resolvedEdgeTypes = edgeTypesOverride ?? EDGE_TYPES;

  // Normalize focus to a Set of labels
  const focusLabels = useMemo(() => {
    if (!focus) return null;
    const arr = Array.isArray(focus) ? focus : [focus];
    return new Set(arr);
  }, [focus]);

  // Clean up labels for display
  const cleanedCircuit = useMemo(() => {
    return circuit && autoLayout ? cleanCircuitLabels(circuit) : circuit ?? null;
  }, [circuit, autoLayout]);

  // ELK auto-layout (skipped when metadata prop is provided)
  const { metadata: elkMetadata } = useElkLayout(
    autoLayout && !metadataProp ? cleanedCircuit : null,
  );

  // Compute final metadata: prop > ELK + nodePositions > empty
  const metadata = useMemo(() => {
    // When metadata prop is provided, use it directly (editor mode)
    if (metadataProp) return metadataProp;

    if (!cleanedCircuit) return { components: {}, connections: {} } as MetadataState;

    const base = autoLayout ? elkMetadata : ({ components: {}, connections: {} } as MetadataState);

    // If not using autoLayout, build metadata from nodePositions prop
    if (!autoLayout && nodePositions) {
      for (const node of cleanedCircuit.nodes) {
        const label = node.label || node.id;
        if (nodePositions[label]) {
          base.components[node.id] = { id: node.id, position: nodePositions[label] };
        }
      }
      return base;
    }

    // Apply position overrides on top of ELK layout
    if (nodePositions) {
      for (const node of cleanedCircuit.nodes) {
        const label = node.label || node.id;
        if (nodePositions[label]) {
          base.components[node.id] = { id: node.id, position: nodePositions[label] };
        }
      }
    }

    return base;
  }, [cleanedCircuit, autoLayout, elkMetadata, nodePositions, metadataProp]);

  // Project to React Flow format
  const { projectedNodes, projectedEdges } = useMemo(() => {
    if (!cleanedCircuit) return { projectedNodes: [], projectedEdges: [] };
    const projected = projectCircuitToReactFlow(
      cleanedCircuit,
      metadata,
      portValues ?? undefined,
      sequentialState ?? undefined,
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
        const label = (node.data as NodeData)?.label ?? node.id;
        if (focusLabels.has(label)) {
          focusedNodeIds.add(node.id);
        }
      }

      const dimmedNodes = nodesWithHandlers.map((node) => {
        const label = (node.data as NodeData)?.label ?? node.id;
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

      return { projectedNodes: dimmedNodes, projectedEdges: dimmedEdges };
    }

    return { projectedNodes: nodesWithHandlers, projectedEdges: projected.edges };
  }, [cleanedCircuit, metadata, portValues, sequentialState, onToggleNode, onSetNodeValue, focusLabels]);

  // Local node state for smooth drag feedback
  const [nodes, setNodes] = useState<Node[]>([]);
  // Local edge state (needed for editable mode selection/deletion)
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map(n => [n.id, n.position]));
      return projectedNodes.map(node => ({
        ...node,
        position: positionMap.get(node.id) ?? node.position,
      }));
    });
  }, [projectedNodes]);

  useEffect(() => {
    setEdges(projectedEdges);
  }, [projectedEdges]);

  // Node changes: position, selection, removal
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      if (editable) {
        const removedIds: string[] = [];
        for (const change of changes) {
          if (change.type === "position" && change.position) {
            onNodePositionChange?.(change.id, change.position);
          } else if (change.type === "select") {
            onNodeSelect?.(change.id, change.selected);
          } else if (change.type === "remove") {
            removedIds.push(change.id);
          }
        }
        if (removedIds.length > 0) {
          onNodesDelete?.(removedIds);
        }
      }
    },
    [editable, onNodePositionChange, onNodeSelect, onNodesDelete],
  );

  // Edge changes: selection, removal (only in editable mode)
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!editable) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));

      const removedIds: string[] = [];
      for (const change of changes) {
        if (change.type === "select") {
          onEdgeSelect?.(change.id, change.selected);
        } else if (change.type === "remove") {
          removedIds.push(change.id);
        }
      }
      if (removedIds.length > 0) {
        onEdgesDelete?.(removedIds);
      }
    },
    [editable, onEdgeSelect, onEdgesDelete],
  );

  // New connections (editable mode only)
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (
        !onConnectProp ||
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return;
      }
      const sourcePortName = connection.sourceHandle.replace("out-", "");
      const targetPortName = connection.targetHandle.replace("in-", "");
      onConnectProp(
        { nodeId: connection.source, portName: sourcePortName },
        { nodeId: connection.target, portName: targetPortName },
      );
    },
    [onConnectProp],
  );

  // Drag-and-drop from palette (editable mode only)
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!onDropProp) return;
      event.preventDefault();
      const componentType = event.dataTransfer.getData("application/reactflow");
      if (!componentType) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onDropProp(componentType, position);
    },
    [onDropProp, screenToFlowPosition],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Node drag stop
  const handleNodeDragStop = useCallback(() => {
    onNodeDragStop?.();
  }, [onNodeDragStop]);

  // Composite inspection on double-click
  const inspectorStack = useInspectorStore((state) => state.stack);
  const openInspector = useInspectorStore((state) => state.open);
  const pushLevel = useInspectorStore((state) => state.pushLevel);
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!drillDown) return;
      const data = node.data as NodeData;
      if (!data.isComposite) return;

      const componentDef = resolveComponent(data.componentRef);
      if (!componentDef) return;

      const label = data.label || data.componentRef;

      // Resolve the actual circuit to inspect
      let circuitToInspect: Circuit | undefined;
      if (componentDef.implementation.kind === "composite") {
        circuitToInspect = componentDef;
      } else {
        const store = useComponentLibraryStore.getState();
        circuitToInspect = getCompiledReferenceCircuit(data.componentRef, store, data.arguments as Record<string, number> | undefined) ?? undefined;
      }
      if (!circuitToInspect) return;

      if (inspectorStack.length > 0) {
        pushLevel(data.componentRef, circuitToInspect, label);
      } else {
        const domNode = document.querySelector(`[data-id="${node.id}"]`);
        const rect = domNode?.getBoundingClientRect();
        const originRect = rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : undefined;
        openInspector(data.componentRef, circuitToInspect, label, originRect);
      }
    },
    [drillDown, resolveComponent, openInspector, pushLevel, inspectorStack.length],
  );

  if (!circuit) {
    if (renderEmptyState) return <>{renderEmptyState()}</>;
    return (
      <div
        className={`bg-gray-900 rounded-lg flex items-center justify-center text-gray-500 ${className ?? ""}`}
        style={{ height }}
      >
        No circuit
      </div>
    );
  }

  const isDark = theme === "dark";
  const bgColor = isDark ? "#374151" : "#d1d5db";

  return (
    <div
      className={`${isDark ? "bg-gray-900" : "bg-white"} rounded-lg overflow-hidden ${editable ? "relative h-full w-full" : ""} ${className ?? ""}`}
      style={editable ? undefined : { height }}
      onDrop={editable ? handleDrop : undefined}
      onDragOver={editable ? handleDragOver : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={resolvedNodeTypes}
        edgeTypes={resolvedEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={editable ? onEdgesChange : undefined}
        onConnect={editable ? handleConnect : undefined}
        onNodeDragStop={editable ? handleNodeDragStop : undefined}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{
          padding: 0.3,
          ...(focusLabels && {
            nodes: nodes.filter((n) => {
              const label = (n.data as NodeData)?.label ?? n.id;
              return focusLabels.has(label as string);
            }),
          }),
        }}
        nodesDraggable={draggable}
        nodesConnectable={editable}
        elementsSelectable={true}
        panOnDrag={[1, 2]}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={editable ? undefined : false}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={editable ? ["Delete", "Backspace"] : null}
        multiSelectionKeyCode={editable ? "Shift" : undefined}
        selectionOnDrag={editable ? true : undefined}
        selectionMode={editable ? SelectionMode.Partial : undefined}
        selectNodesOnDrag={editable ? false : undefined}
        panActivationKeyCode={editable ? null : undefined}
        className={isDark ? undefined : "bg-gray-50"}
      >
        {isDark ? (
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={bgColor} />
        ) : (
          <Background />
        )}
        {showControls ? (
          <Controls />
        ) : (
          <Panel position="bottom-left">
            <FitViewButton />
          </Panel>
        )}
      </ReactFlow>
      {renderOverlay?.()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component (wraps in ReactFlowProvider + Inspector dialog)
// ---------------------------------------------------------------------------

export function CircuitCanvas(props: CircuitCanvasProps) {
  const drillDown = props.drillDown ?? true;
  const renderInspector = props.renderInspector ?? true;
  return (
    <ReactFlowProvider>
      <CircuitCanvasInner {...props} />
      {drillDown && renderInspector && <CompositeInspectorDialog />}
    </ReactFlowProvider>
  );
}
