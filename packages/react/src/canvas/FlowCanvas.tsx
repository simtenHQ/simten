/**
 * FlowCanvas: draws a circuit with React Flow. Internal: `CircuitCanvas`
 * draws a simulation with it, and the drill-down draws each level with it.
 *
 * It draws and reports double-clicks, and holds no simulation. The nodes and
 * wires are built from the circuit alone (`circuit-to-flow.ts`) and read their
 * values from `values` as they render, so an update re-renders only the nodes
 * whose value changed (`values.ts`).
 */

import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  type OnNodesChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { CircuitDefinitions } from '@simten/core/internal';
import type React from 'react';
import {
  type CSSProperties,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NodeData } from '../nodes';
import { type Projection, projectCircuit } from './circuit-to-flow';
import { type Change, classifyChange, type Shape } from './classify-change';
import { computeDagreLayout } from './dagre-layout';
import { useDetectTheme } from './hooks/useDetectTheme';
import { useIsMobile } from './hooks/useIsMobile';
import { cleanCircuitLabels } from './label-utils';
import { EDGE_TYPES, NODE_TYPES } from './node-types';
import type { CircuitLayout, DrawnCircuit, Positions } from './types';
import { type CanvasActions, CanvasContext, type ValueStore } from './values';

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

interface FlowCanvasProps {
  circuit: DrawnCircuit | null;
  /** What the circuit's components are. Nothing is drawn without them. */
  definitions: CircuitDefinitions | null;
  /** Where `circuit` sits in the session `values` come from: '' for its top level. */
  path?: string;
  /** The session's values, which each node reads its own from. */
  values: ValueStore;
  /** What clicks on the canvas do. Without them its switches and inputs are indicators. */
  actions?: CanvasActions;
  /** Session paths of consoles nested out of sight, drawn at the side. */
  consoles?: readonly string[];
  draggable?: boolean;
  /**
   * Re-run the layout engine on every structural change, instead of only when
   * nodes are added or removed.
   *
   * Positions are preserved by default because the editor lets people drag
   * nodes, and #111 wanted a rename to leave them where they were. But that
   * keys on node ids alone, so adding a *wire* between existing nodes leaves
   * them in a layout computed before the wire existed — the new edge takes a
   * long detour to a node that should have moved.
   *
   * A read-only canvas has no dragged positions worth keeping, so it wants the
   * fresh layout every time. @default false
   */
  autoLayout?: boolean;
  /**
   * Pre-computed node positions keyed by node label (or id, as fallback).
   * When provided, the layout engine is skipped entirely.
   */
  layout?: CircuitLayout;
  onNodeDoubleClick?: (nodeData: NodeData) => void;
  height?: number | string;
  focus?: string | readonly string[];
  /** Theme for the canvas. Defaults to the page theme (`html.dark`). */
  theme?: 'light' | 'dark';
  /**
   * Allow single-finger pan on mobile. Default false — inline embeds need
   * the page to scroll naturally over them. Set to true inside modal/full-
   * screen contexts (drill-down inspector, fullscreen mode) where there's
   * no page scroll to compete with.
   */
  panOnMobile?: boolean;
}

/** Below this zoom an 11px pin label is too small to read, so the canvas drops them. */
const PIN_LABEL_MIN_ZOOM = 0.35;
const NO_ACTIONS: CanvasActions = {};
const NO_CONSOLES: readonly string[] = [];
/** How far `focus` fades the nodes outside it. */
const FOCUS_DIM = 0.15;

/** The nodes and wires to draw, and the shape that decides what kind of change they are. */
interface Drawing extends Projection {
  shape: Shape;
}

const NOTHING: Drawing = { nodes: [], edges: [], shape: { name: null, pins: new Map() } };

/** Positions from a `layout` prop: by label, then by id. A node missing from it isn't drawn. */
function positionsFromLayout(circuit: DrawnCircuit, layout: CircuitLayout): Positions {
  const positions: Positions = {};
  for (const node of circuit.nodes) {
    const position = layout[node.label || node.id] ?? layout[node.id];
    if (position) positions[node.id] = position;
  }
  return positions;
}

/** Dims every node but those labelled in `focus`, and every wire touching none of them. */
function dimOutOfFocus(projection: Projection, focus: ReadonlySet<string>): Projection {
  const focused = new Set(
    projection.nodes.filter((n) => focus.has(n.data.label ?? n.id)).map((n) => n.id),
  );
  const fade = (on: boolean) => ({ opacity: on ? 1 : FOCUS_DIM, transition: 'opacity 0.2s' });
  return {
    nodes: projection.nodes.map((n) => ({
      ...n,
      style: { ...n.style, ...fade(focused.has(n.id)) },
    })),
    edges: projection.edges.map((e) => ({
      ...e,
      style: { ...e.style, ...fade(focused.has(e.source) || focused.has(e.target)) },
    })),
  };
}

function shapeOf(name: string, nodes: Projection['nodes']): Shape {
  return {
    name,
    pins: new Map(
      nodes.map((n) => [n.id, `${n.data.inputNames.join('|')}>${n.data.outputNames.join('|')}`]),
    ),
  };
}

/**
 * A redrawn node that was already on the canvas keeps what React Flow knows
 * about it (its measured handles) and, unless the circuit is laid out again,
 * where it was dragged to.
 */
function keepPositions(current: Node[], next: Node[], relayout: boolean): Node[] {
  const before = new Map(current.map((n) => [n.id, n]));
  return next.map((node) => {
    const prev = before.get(node.id);
    if (!prev) return node;
    return { ...prev, ...node, position: relayout ? node.position : prev.position };
  });
}

export const FlowCanvas = memo(function FlowCanvas({
  circuit,
  definitions,
  path = '',
  values,
  actions = NO_ACTIONS,
  consoles = NO_CONSOLES,
  layout,
  focus,
  autoLayout = false,
  ...view
}: FlowCanvasProps) {
  const focusLabels = useMemo(
    () => (focus === undefined ? null : new Set(typeof focus === 'string' ? [focus] : focus)),
    [focus],
  );
  const drawing = useMemo((): Drawing => {
    if (!circuit || !definitions) return NOTHING;
    const cleaned = cleanCircuitLabels(circuit);
    const positions = layout ? positionsFromLayout(cleaned, layout) : computeDagreLayout(cleaned);
    const projected = projectCircuit(cleaned, positions, definitions, path, consoles);
    const drawn = focusLabels ? dimOutOfFocus(projected, focusLabels) : projected;
    return { ...drawn, shape: shapeOf(cleaned.name, drawn.nodes) };
  }, [circuit, definitions, path, consoles, layout, focusLabels]);

  // A different circuit starts React Flow over: keyed at the provider, so its
  // store (handle registry, cached edge routes) goes too. Keying <ReactFlow>
  // alone kept stale handle ids from the previous circuit, which bent the
  // wires when a paste-over shared input/output names with it.
  const [shown, setShown] = useState<{ drawing: Drawing; change: Change; generation: number }>(
    () => ({ drawing, change: { kind: 'first' }, generation: 0 }),
  );
  if (shown.drawing !== drawing) {
    const change = classifyChange(shown.drawing.shape, drawing.shape, autoLayout);
    const generation = shown.generation + (change.kind === 'replaced' ? 1 : 0);
    setShown({ drawing, change, generation });
  }

  const context = useMemo(() => ({ values, actions }), [values, actions]);
  return (
    <CanvasContext.Provider value={context}>
      <ReactFlowProvider key={shown.generation}>
        <FlowCanvasInner
          {...view}
          drawing={shown.drawing}
          change={shown.change}
          focusLabels={focusLabels}
          empty={!circuit}
        />
      </ReactFlowProvider>
    </CanvasContext.Provider>
  );
});

interface FlowCanvasInnerProps
  extends Pick<
    FlowCanvasProps,
    'draggable' | 'onNodeDoubleClick' | 'height' | 'theme' | 'panOnMobile'
  > {
  drawing: Drawing;
  change: Change;
  focusLabels: ReadonlySet<string> | null;
  empty: boolean;
}

function FlowCanvasInner({
  drawing,
  change,
  focusLabels,
  empty,
  draggable = true,
  onNodeDoubleClick,
  height = '100%',
  theme: themeProp,
  panOnMobile = false,
}: FlowCanvasInnerProps) {
  const detectedTheme = useDetectTheme();
  const theme = themeProp ?? detectedTheme;
  const isMobile = useIsMobile();
  // A boolean, so zooming only re-renders the canvas when it crosses the line.
  const pinLabelsReadable = useStore((s) => s.transform[2] >= PIN_LABEL_MIN_ZOOM);

  // React Flow's own copy, which it moves nodes in as they're dragged.
  const [nodes, setNodes] = useState<Node[]>(drawing.nodes);
  const [edges, setEdges] = useState<Edge[]>(drawing.edges);
  const { fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // A new drawing on the same React Flow: an edit, or the first circuit after none.
  const applied = useRef(drawing);
  useLayoutEffect(() => {
    if (applied.current === drawing) return;
    applied.current = drawing;
    // Nodes and edges in the same commit, so React Flow never routes the new
    // wires against the old nodes.
    setNodes((current) =>
      change.kind === 'edited'
        ? keepPositions(current, drawing.nodes, change.relayout)
        : drawing.nodes,
    );
    setEdges(drawing.edges);
    if (change.kind !== 'edited') return;
    // Pins added or removed: React Flow measures handles once, so measure again.
    if (change.handlesChanged.length > 0) {
      requestAnimationFrame(() => updateNodeInternals(change.handlesChanged));
    }
    // Laid out again: the diagram's extent changed, so the old viewport no
    // longer frames it (adding an input grew the switch column off the bottom).
    if (change.relayout && drawing.nodes.length > 0) {
      requestAnimationFrame(() => fitView({ padding: 0.3 }));
    }
  }, [drawing, change, fitView, updateNodeInternals]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => onNodeDoubleClick?.(node.data as NodeData),
    [onNodeDoubleClick],
  );

  return (
    <div
      data-embed-theme={theme}
      className="bg-[var(--embed-bg-primary)] overflow-hidden relative"
      style={
        { height, '--simten-pin-labels': pinLabelsReadable ? 'block' : 'none' } as CSSProperties
      }
      aria-label="Circuit diagram"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        minZoom={0.1}
        maxZoom={3}
        fitViewOptions={{
          padding: 0.3,
          ...(focusLabels && {
            nodes: nodes.filter((n) => focusLabels.has((n.data as NodeData).label ?? n.id)),
          }),
        }}
        nodesDraggable={draggable && !isMobile}
        nodesConnectable={false}
        elementsSelectable={true}
        selectionOnDrag={false}
        panOnDrag={!isMobile || panOnMobile}
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
        <Panel position="bottom-left">
          <CanvasControls />
        </Panel>
      </ReactFlow>
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--embed-text-muted)]">
          No circuit
        </div>
      )}
    </div>
  );
}
