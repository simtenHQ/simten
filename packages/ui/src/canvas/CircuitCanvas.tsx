import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { Circuit, CircuitLibrary, FlatPortValueMap, FlatSequentialState } from '@simten/core';
import React, {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NodeData } from '../nodes';
import { CompositeInspectorDialog } from './CompositeInspectorDialog';
import { useDetectTheme } from './hooks/useDetectTheme';
import { useIsMobile } from './hooks/useIsMobile';
import { cleanCircuitLabels } from './label-utils';
import { EDGE_TYPES, NODE_TYPES } from './node-types';
import { projectCircuitToReactFlow } from './projection';
import type { CircuitLayout, InspectorFrame, MetadataState } from './types';
import { useLayout } from './useLayout';

function CanvasControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const btn =
    'bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-secondary)] p-1.5 rounded border border-[var(--embed-border)] transition-colors';
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => zoomOut()} className={btn} title="Zoom out" aria-label="Zoom out">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </button>
      <button onClick={() => zoomIn()} className={btn} title="Zoom in" aria-label="Zoom in">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        onClick={() => fitView({ padding: 0.3 })}
        className={btn}
        title="Fit view"
        aria-label="Fit view"
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
    </div>
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
  onPortClick?: (nodeLabel: string, portName: string, portType: 'input' | 'output') => void;
  glowUnconnected?: boolean;
  /** Theme for the canvas. Defaults to "dark". */
  theme?: 'light' | 'dark';
  /**
   * Allow single-finger pan on mobile. Default false — inline embeds need
   * the page to scroll naturally over them. Set to true inside modal/full-
   * screen contexts (drill-down inspector, fullscreen mode) where there's
   * no page scroll to compete with.
   */
  panOnMobile?: boolean;
}

// Default library — created once, reused
let _defaultLibrary: CircuitLibrary | null = null;
function getDefaultLibrary(): CircuitLibrary {
  if (!_defaultLibrary) {
    const circuitMap = new Map<string, Circuit>();
    _defaultLibrary = {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () =>
        [...circuitMap.entries()]
          .filter(([, c]) => c.implementation.kind === 'primitive')
          .map(([n]) => n),
      addCircuit: (c: Circuit) => {
        circuitMap.set(c.name, c);
      },
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
  height = '100%',
  focus,
  className,
  renderEmptyState,
  renderOverlay,
  nodeTypes: nodeTypesOverride,
  edgeTypes: edgeTypesOverride,
  showControls = true,
  showPortLabels,
  onPortClick: onPortClickProp,
  glowUnconnected,
  theme: themeProp,
  panOnMobile = false,
  onRequestRemount,
}: CircuitCanvasProps & { onRequestRemount?: () => void }) {
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
    if (!cleanedCircuit) return { components: {}, connections: {} } as MetadataState;

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
        data.onPortClick = (portName: string, portType: 'input' | 'output') =>
          onPortClickProp(label, portName, portType);
      }

      if (componentRef === 'Input' && onSetNodeValue) {
        data.onValueChange = (value: number) => onSetNodeValue(node.id, value);
      }
      if (onToggleNode && (componentRef === 'Switch' || componentRef === 'Button')) {
        data.onToggle = () => onToggleNode(node.id);
      }
      if (onLoadMemory && (componentRef === 'RV32I_InstrMem' || componentRef === 'DualPortROM')) {
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
              transition: 'opacity 0.2s',
            },
          };
        }),
        projectedEdges: projected.edges.map((edge) => ({
          ...edge,
          style: {
            ...edge.style,
            opacity: focusedNodeIds.has(edge.source) || focusedNodeIds.has(edge.target) ? 1 : 0.15,
            transition: 'opacity 0.2s',
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
  const updateNodeInternals = useUpdateNodeInternals();
  const prevCircuitIdRef = useRef<string | null>(null);
  const prevNodeIdSetRef = useRef<Set<string>>(new Set());
  const prevPortShapeRef = useRef<Map<string, string>>(new Map());
  const prevNodeCountRef = useRef<number>(0);

  useLayoutEffect(() => {
    const prevName = prevCircuitIdRef.current;
    const prevIdSet = prevNodeIdSetRef.current;
    const prevPortShape = prevPortShapeRef.current;

    const newName = cleanedCircuit?.name ?? null;
    const newIdSet = new Set(projectedNodes.map((n) => n.id));

    // Per-node port shape signature, computed synchronously so the
    // updateNodeInternals call below doesn't depend on React's setState
    // batching to populate change lists.
    const newPortShape = new Map<string, string>();
    for (const node of projectedNodes) {
      const d = node.data as NodeData;
      const sig = `${(d.inputNames ?? []).join('|')}>${(d.outputNames ?? []).join('|')}`;
      newPortShape.set(node.id, sig);
    }

    prevCircuitIdRef.current = newName;
    prevNodeIdSetRef.current = newIdSet;
    prevPortShapeRef.current = newPortShape;

    const nameChanged = newName !== prevName;

    // Surviving fraction = |prev ∩ new| / max(|prev|, |new|). Topology is
    // considered "replaced" if less than half the node ids survive on
    // either side of the change. Using max() makes the signal symmetric:
    // a small→big swap (e.g. cmd-z restoring a larger circuit) scores
    // the same as the matching big→small swap, so the position-merge
    // path doesn't preserve stale dagre positions for the few survivors
    // while new nodes land in the fresh layout — that mismatch is what
    // produced overlapping switches on undo. Single/double renames stay
    // above the threshold so #111's position preservation still applies.
    // Guards the 0/0 case on first mount — wasBlank handles it.
    let survived = 0;
    for (const id of newIdSet) if (prevIdSet.has(id)) survived++;
    const denom = Math.max(prevIdSet.size, newIdSet.size);
    const topologyReplaced = denom > 0 && survived / denom < 0.5;

    const fullReset = nameChanged || topologyReplaced;

    // Ids whose port set changed, computed synchronously from the ref.
    const idsToUpdate: string[] = [];
    if (!fullReset) {
      for (const [id, sig] of newPortShape) {
        const prevSig = prevPortShape.get(id);
        if (prevSig !== undefined && prevSig !== sig) idsToUpdate.push(id);
      }
    }

    const wasBlank = prevNodeCountRef.current === 0;
    prevNodeCountRef.current = projectedNodes.length;

    // Nodes purely added or purely removed — no rename in the mix. The
    // preserved positions then belong to a layout computed for a different node
    // count, while newly projected nodes carry the current one, so mixing the
    // two put a new node exactly on top of a surviving one (adding an input
    // landed its switch on the previous input's slot, hiding it entirely).
    // Take the fresh layout for everything in that case.
    //
    // A rename removes an id *and* adds one, so it fails this test and keeps
    // the preserved positions — which is what #111 asked for.
    let added = 0;
    for (const id of newIdSet) if (!prevIdSet.has(id)) added++;
    let removed = 0;
    for (const id of prevIdSet) if (!newIdSet.has(id)) removed++;
    const relayout = (added > 0 && removed === 0) || (removed > 0 && added === 0);

    setNodes((currentNodes) => {
      const prevById = new Map(currentNodes.map((n) => [n.id, n]));
      return projectedNodes.map((node) => {
        const prev = prevById.get(node.id);
        if (prev && !fullReset) {
          // Light edit — keep React Flow's internal fields (measured handles)
          // and the user-dragged position; only refresh data/type from projection.
          return {
            ...prev,
            position: relayout ? node.position : prev.position,
            type: node.type,
            data: node.data,
            selectable: node.selectable,
            deletable: node.deletable,
          };
        }
        return node;
      });
    });

    // Edges must be set in the same commit as nodes so a key-bump remount
    // mounts the new React Flow with both fresh — otherwise the remount
    // happens with stale edges still in state and the in-place edge update
    // arrives on the next render (the bug this fix exists to avoid).
    setEdges(projectedEdges);

    // Topology replacement: ask the outer wrapper to remount the entire
    // <ReactFlowProvider>. Keying only <ReactFlow> leaves the provider's
    // Zustand store intact and stale handle ids from the previous circuit
    // survive, producing bent wires when paste-over shares node ids with
    // the previous circuit. Skipped on first mount (prevIdSet empty).
    if (fullReset && prevIdSet.size > 0) {
      onRequestRemount?.();
    } else if (idsToUpdate.length > 0) {
      // Light edit with handle changes — refresh just those nodes.
      requestAnimationFrame(() => updateNodeInternals(idsToUpdate));
    }

    // After a paste-over the remount handles fitView via React Flow's
    // own `fitView` prop. The remaining case is wasBlank without a
    // remount (nodes appeared after an empty state on a stable canvas).
    if (projectedNodes.length > 0 && wasBlank && !fullReset) {
      requestAnimationFrame(() => fitView({ padding: 0.3 }));
    }
  }, [projectedNodes, projectedEdges]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // ── Inspector stack for automatic drill-down ──
  const [inspectorStack, setInspectorStack] = useState<InspectorFrame[]>([]);

  const pushInspectorLevel = useCallback((name: string, def: Circuit, label: string) => {
    setInspectorStack((prev) => [
      ...prev,
      { componentName: name, componentDef: def, nodeLabel: label },
    ]);
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
  const defaultNodeDoubleClick = useCallback(
    (nodeData: NodeData) => {
      if (!nodeData.isComposite) return;
      const componentDef = library.resolveCircuit(nodeData.componentRef);
      if (!componentDef) return;

      if (componentDef.implementation.kind === 'composite' && componentDef.nodes.length > 0) {
        setInspectorStack([
          {
            componentName: nodeData.componentRef,
            componentDef,
            nodeLabel: nodeData.label ?? nodeData.componentRef,
          },
        ]);
      }
    },
    [library],
  );

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
      className={`bg-[var(--embed-bg-primary)] overflow-hidden relative ${className ?? ''}`}
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
        minZoom={0.1}
        maxZoom={3}
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
        panOnDrag={isMobile && !panOnMobile ? false : [1, 2]}
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
        {showControls && (
          <Panel position="bottom-left">
            <CanvasControls />
          </Panel>
        )}
      </ReactFlow>
      {renderOverlay?.()}
      {/* Empty state overlay — rendered on top of ReactFlow when no circuit */}
      {!circuit &&
        (renderEmptyState ? (
          renderEmptyState()
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--embed-text-muted)]">
            No circuit
          </div>
        ))}
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
  // Keyed at the provider level so a topology-replacement remount also wipes
  // React Flow's Zustand store (handle registry, cached edge routes). Keying
  // <ReactFlow> alone leaves the store intact and stale handle ids from the
  // previous circuit survive, which is what was producing the bent wires
  // when paste-over shared input/output names with the previous circuit.
  const [resetGeneration, setResetGeneration] = useState(0);
  const requestRemount = useCallback(() => {
    setResetGeneration((g) => g + 1);
  }, []);
  return (
    <ReactFlowProvider key={resetGeneration}>
      <CircuitCanvasInner {...props} onRequestRemount={requestRemount} />
    </ReactFlowProvider>
  );
}
