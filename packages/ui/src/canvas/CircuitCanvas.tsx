"use client";

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
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Circuit,
  CircuitLibrary,
  FlatPortValueMap,
  FlatSequentialState,
} from "@turing-incomplete/core";
import {
  createCircuitLibrary,
} from "@turing-incomplete/core";
import { PRIMITIVES, compileReferenceCircuit } from "@turing-incomplete/core/simulator";
import type { NodeData } from "../nodes";
import { cleanCircuitLabels } from "./label-utils";
import { EDGE_TYPES, NODE_TYPES } from "./node-types";
import { projectCircuitToReactFlow } from "./projection";
import type { InspectorFrame, MetadataState } from "./types";
import { useElkLayout } from "./useElkLayout";
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
  autoLayout?: boolean;
  nodePositions?: Record<string, { x: number; y: number }>;
  metadata?: MetadataState;
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

/** Reactively detect theme from <html> class. Falls back to "dark". */
function useDetectTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(el.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// Default library — created once, reused
let _defaultLibrary: CircuitLibrary | null = null;
function getDefaultLibrary(): CircuitLibrary {
  if (!_defaultLibrary)
    _defaultLibrary = createCircuitLibrary([...PRIMITIVES]);
  return _defaultLibrary;
}

function CircuitCanvasInner({
  circuit,
  componentLibrary,
  portValues,
  sequentialState,
  draggable = true,
  autoLayout = true,
  nodePositions,
  metadata: metadataProp,
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
  const resolvedNodeTypes = nodeTypesOverride ?? NODE_TYPES;
  const resolvedEdgeTypes = edgeTypesOverride ?? EDGE_TYPES;
  const library = componentLibrary ?? getDefaultLibrary();

  const focusLabels = useMemo(() => {
    if (!focus) return null;
    return new Set(Array.isArray(focus) ? focus : [focus]);
  }, [focus]);

  const cleanedCircuit = useMemo(() => {
    return circuit && autoLayout
      ? cleanCircuitLabels(circuit)
      : circuit ?? null;
  }, [circuit, autoLayout]);

  const { metadata: elkMetadata } = useElkLayout(
    autoLayout && !metadataProp ? cleanedCircuit : null,
  );

  const metadata = useMemo(() => {
    if (metadataProp) return metadataProp;
    if (!cleanedCircuit)
      return { components: {}, connections: {} } as MetadataState;

    const base = autoLayout
      ? elkMetadata
      : ({ components: {}, connections: {} } as MetadataState);

    if (nodePositions) {
      for (const node of cleanedCircuit.nodes) {
        const label = node.label || node.id;
        if (nodePositions[label]) {
          base.components[node.id] = {
            id: node.id,
            position: nodePositions[label],
          };
        }
      }
    }

    return base;
  }, [cleanedCircuit, autoLayout, elkMetadata, nodePositions, metadataProp]);

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

  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      return projectedNodes.map((node) => ({
        ...node,
        position: positionMap.get(node.id) ?? node.position,
      }));
    });
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

  // Default double-click handler: opens inspector for composites/reference circuits
  const defaultNodeDoubleClick = useCallback((nodeData: NodeData) => {
    if (!nodeData.isComposite) return;
    const componentDef = library.resolveCircuit(nodeData.componentRef);
    if (!componentDef) return;

    if (componentDef.implementation.kind === "composite" && componentDef.nodes.length > 0) {
      setInspectorStack([{ componentName: nodeData.componentRef, componentDef, nodeLabel: nodeData.label ?? nodeData.componentRef }]);
      return;
    }

    // Lazily compile reference circuit for primitives
    const params: Record<string, number> = {};
    if (nodeData.arguments) {
      for (const [k, v] of Object.entries(nodeData.arguments)) {
        if (typeof v === "number") params[k] = v;
      }
    }
    const refCircuit = compileReferenceCircuit(nodeData.componentRef, params);
    if (refCircuit) {
      setInspectorStack([{ componentName: nodeData.componentRef, componentDef: refCircuit, nodeLabel: nodeData.label ?? nodeData.componentRef }]);
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

  if (!circuit) {
    if (renderEmptyState) return <>{renderEmptyState()}</>;
    return (
      <div
        data-embed-theme={theme}
        className={`bg-[var(--embed-bg-primary)] rounded-lg flex items-center justify-center text-[var(--embed-text-muted)] ${
          className ?? ""
        }`}
        style={{ height }}
      >
        No circuit
      </div>
    );
  }

  return (
    <div
      data-embed-theme={theme}
      className={`bg-[var(--embed-bg-primary)] rounded-lg overflow-hidden ${
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
        nodesDraggable={draggable}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={[1, 2]}
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
