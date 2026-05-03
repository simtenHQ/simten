
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Circuit,
  CircuitLibrary,
  FlatPortValueMap,
  FlatSequentialState,
} from "@simten/core";
import type { NodeData } from "../nodes";
import { cleanCircuitLabels } from "./label-utils";
import { EDGE_TYPES, NODE_TYPES } from "./node-types";
import { projectCircuitToReactFlow } from "./projection";
import type { CircuitLayout, InspectorFrame, MetadataState } from "./types";
import { useLayout } from "./useLayout";
import { useIsMobile } from "./hooks/useIsMobile";
import { useDetectTheme } from "./hooks/useDetectTheme";
import { CompositeInspectorDialog } from "./CompositeInspectorDialog";

function FitViewButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.3 })}
      className="bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-secondary)] p-1.5 rounded border border-[var(--embed-border)] transition-colors"
      title="Fit view"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
        />
      </svg>
    </button>
  );
}

export interface CircuitCanvasProps {
  circuit?: Circuit | null;
  componentLibrary?: CircuitLibrary;
  portValues?: FlatPortValueMap | null;
  sequentialState?: FlatSequentialState | null;
  draggable?: boolean;
  /**
   * Pre-computed node positions keyed by node label (or id, as fallback).
   * When provided, the layout engine is skipped entirely.
   * When absent, positions are computed by the layout engine on mount.
   */
  layout?: CircuitLayout;
  onToggleNode?: (nodeId: string) => void;
  onSetNodeValue?: (nodeId: string, value: number) => void;
  onLoadMemory?: (nodeId: string, data: Map<number, number>) => void;
  onNodeDoubleClick?: (nodeData: NodeData) => void;
  height?: number | string;
  focus?: string | string[];
  className?: string;
  renderEmptyState?: () => ReactNode;
  renderOverlay?: () => ReactNode;
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  showControls?: boolean;
  showPortLabels?: boolean;
  onPortClick?: (
    nodeLabel: string,
    portName: string,
    portType: "input" | "output",
  ) => void;
  glowUnconnected?: boolean;
  /** Theme for the canvas. Defaults to "dark". */
  theme?: "light" | "dark";
}

// Default library — created once, reused
let _defaultLibrary: CircuitLibrary | null = null;
function getDefaultLibrary(): CircuitLibrary {
  if (!_defaultLibrary) {
    const circuitMap = new Map<string, Circuit>();
    _defaultLibrary = {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
      addCircuit: (c: Circuit) => { circuitMap.set(c.name, c); },
    } as CircuitLibrary & { addCircuit(c: Circuit): void };
  }
  return _defaultLibrary;
}

function CircuitCanvasInner({
  circuit,
  componentLibrary,
  portValues,
  sequentialState,
  draggable = true,
  layout,
  onToggleNode,
  onSetNodeValue,
  onLoadMemory,
  onNodeDoubleClick: onNodeDoubleClickProp,
  height = "100%",
  focus,
  className,
  renderEmptyState,
  renderOverlay,
  nodeTypes: nodeTypesOverride,
  edgeTypes: edgeTypesOverride,
  showControls = false,
  showPortLabels,
  onPortClick: onPortClickProp,
  glowUnconnected,
  theme: themeProp,
}: CircuitCanvasProps) {
  const detectedTheme = useDetectTheme();
  const theme = themeProp ?? detectedTheme;
  const isMobile = useIsMobile();
  const resolvedNodeTypes = nodeTypesOverride ?? NODE_TYPES;
  const resolvedEdgeTypes = edgeTypesOverride ?? EDGE_TYPES;
  const library = componentLibrary ?? getDefaultLibrary();

  const focusLabels = useMemo(() => {
    if (!focus) return null;
    return new Set(Array.isArray(focus) ? focus : [focus]);
  }, [focus]);

  const cleanedCircuit = useMemo(() => {
    return circuit ? cleanCircuitLabels(circuit) : null;
  }, [circuit]);

  // Run engine only when no layout is provided.
  const { metadata: computedMetadata } = useLayout(layout ? null : cleanedCircuit);

  const metadata = useMemo(() => {
    if (!cleanedCircuit)
      return { components: {}, connections: {} } as MetadataState;

    if (!layout) return computedMetadata;

    // Build MetadataState from the user-provided layout. Try label first, fall
    // back to id. Nodes missing from the layout get no position.
    const components: Record<string, { id: string; position: { x: number; y: number } }> = {};
    for (const node of cleanedCircuit.nodes) {
      const labelKey = node.label || node.id;
      const pos = layout[labelKey] ?? layout[node.id];
      if (pos) {
        components[node.id] = { id: node.id, position: pos };
      }
    }
    return { components, connections: {} } as MetadataState;
  }, [cleanedCircuit, computedMetadata, layout]);

  const { projectedNodes, projectedEdges } = useMemo(() => {
    if (!cleanedCircuit) return { projectedNodes: [], projectedEdges: [] };
    const projected = projectCircuitToReactFlow(
      cleanedCircuit,
      metadata,
      library,
      portValues ?? undefined,
      sequentialState ?? undefined,
    );

    const nodesWithHandlers = projected.nodes.map((node) => {
      const nodeData = node.data as NodeData;
      const componentRef = nodeData?.componentRef;
      const data = { ...node.data } as NodeData;

      if (showPortLabels) data.showPortLabels = true;
      if (glowUnconnected) data.glowUnconnected = true;
      if (onPortClickProp) {
        const label = nodeData.label || nodeData.componentRef;
        data.onPortClick = (portName: string, portType: "input" | "output") =>
          onPortClickProp(label, portName, portType);
      }

      if (componentRef === "Input" && onSetNodeValue) {
        data.onValueChange = (value: number) => onSetNodeValue(node.id, value);
      }
      if (
        onToggleNode &&
        (componentRef === "Switch" || componentRef === "Button")
      ) {
        data.onToggle = () => onToggleNode(node.id);
      }
      if (onLoadMemory && (componentRef === "RV32I_InstrMem" || componentRef === "DualPortROM")) {
        data.onLoadMemory = (memData: Map<number, number>) => onLoadMemory(node.id, memData);
      }

      return { ...node, data };
    });

    if (focusLabels) {
      const focusedNodeIds = new Set<string>();
      for (const node of nodesWithHandlers) {
        const label = (node.data as NodeData)?.label ?? node.id;
        if (focusLabels.has(label)) focusedNodeIds.add(node.id);
      }

      return {
        projectedNodes: nodesWithHandlers.map((node) => {
          const label = (node.data as NodeData)?.label ?? node.id;
          return {
            ...node,
            style: {
              ...node.style,
              opacity: focusLabels.has(label) ? 1 : 0.15,
              transition: "opacity 0.2s",
            },
          };
        }),
        projectedEdges: projected.edges.map((edge) => ({
          ...edge,
          style: {
            ...edge.style,
            opacity:
              focusedNodeIds.has(edge.source) || focusedNodeIds.has(edge.target)
                ? 1
                : 0.15,
            transition: "opacity 0.2s",
          },
        })),
      };
    }

    return {
      projectedNodes: nodesWithHandlers,
      projectedEdges: projected.edges,
    };
  }, [
    cleanedCircuit,
    metadata,
    library,
    portValues,
    sequentialState,
    onToggleNode,
    onSetNodeValue,
    onLoadMemory,
    focusLabels,
    showPortLabels,
    onPortClickProp,
    glowUnconnected,
  ]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const { fitView } = useReactFlow();
  const prevCircuitIdRef = useRef<string | null>(null);
  const prevNodeCountRef = useRef<number>(0);

  useEffect(() => {
    const newId = cleanedCircuit?.id ?? null;
    const circuitChanged = newId !== prevCircuitIdRef.current;
    prevCircuitIdRef.current = newId;

    const wasBlank = prevNodeCountRef.current === 0;
    prevNodeCountRef.current = projectedNodes.length;

    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      return projectedNodes.map((node) => ({
        ...node,
        // Preserve user-dragged positions for same circuit; use layout positions for new circuit
        position: (!circuitChanged && positionMap.get(node.id)) ? positionMap.get(node.id)! : node.position,
      }));
    });

    // Fit view when circuit changes OR when nodes appear after a blank state
    if (projectedNodes.length > 0 && (circuitChanged || wasBlank)) {
      requestAnimationFrame(() => fitView({ padding: 0.3 }));
    }
  }, [projectedNodes]);

  useEffect(() => {
    setEdges(projectedEdges);
  }, [projectedEdges]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // ── Inspector stack for automatic drill-down ──
  const [inspectorStack, setInspectorStack] = useState<InspectorFrame[]>([]);

  const pushInspectorLevel = useCallback((name: string, def: Circuit, label: string) => {
    setInspectorStack((prev) => [...prev, { componentName: name, componentDef: def, nodeLabel: label }]);
  }, []);

  const popInspectorLevel = useCallback(() => {
    setInspectorStack((prev) => prev.slice(0, -1));
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorStack([]);
  }, []);

  const navigateInspector = useCallback((index: number) => {
    setInspectorStack((prev) => prev.slice(0, index + 1));
  }, []);

  // Default double-click handler: opens inspector for composites
  const defaultNodeDoubleClick = useCallback((nodeData: NodeData) => {
    if (!nodeData.isComposite) return;
    const componentDef = library.resolveCircuit(nodeData.componentRef);
    if (!componentDef) return;

    if (componentDef.implementation.kind === "composite" && componentDef.nodes.length > 0) {
      setInspectorStack([{ componentName: nodeData.componentRef, componentDef, nodeLabel: nodeData.label ?? nodeData.componentRef }]);
    }
  }, [library]);

  // Use caller's handler if provided, otherwise use built-in inspector
  const effectiveNodeDoubleClick = onNodeDoubleClickProp ?? defaultNodeDoubleClick;

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      effectiveNodeDoubleClick(node.data as NodeData);
    },
    [effectiveNodeDoubleClick],
  );

  return (
    <div
      data-embed-theme={theme}
      className={`bg-[var(--embed-bg-primary)] overflow-hidden relative ${
        className ?? ""
      }`}
      style={{ height }}
      aria-label="Circuit diagram"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={resolvedNodeTypes}
        edgeTypes={resolvedEdgeTypes}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
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
        nodesDraggable={draggable && !isMobile}
        nodesConnectable={false}
        elementsSelectable={true}
        selectionOnDrag={false}
        panOnDrag={isMobile ? false : [1, 2]}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        panActivationKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--embed-dot-color)"
        />
        {showControls ? (
          <Controls />
        ) : (
          <Panel position="bottom-left">
            <FitViewButton />
          </Panel>
        )}
      </ReactFlow>
      {renderOverlay?.()}
      {/* Empty state overlay — rendered on top of ReactFlow when no circuit */}
      {!circuit && (
        renderEmptyState ? renderEmptyState() : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--embed-text-muted)]">
            No circuit
          </div>
        )
      )}
      {/* Built-in inspector (only when no external onNodeDoubleClick) */}
      {!onNodeDoubleClickProp && inspectorStack.length > 0 && (
        <CompositeInspectorDialog
          stack={inspectorStack}
          componentLibrary={library}
          theme={theme}
          onClose={closeInspector}
          onPopLevel={popInspectorLevel}
          onPushLevel={pushInspectorLevel}
          onNavigate={navigateInspector}
        />
      )}
    </div>
  );
}

export function CircuitCanvas(props: CircuitCanvasProps) {
  return (
    <ReactFlowProvider>
      <CircuitCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
