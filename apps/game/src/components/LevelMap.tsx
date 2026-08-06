/**
 * The campaign map.
 *
 * A React Flow canvas rather than a list, reading bottom to top. It is
 * deliberately larger than the viewport: seeing the whole act at once would
 * make it look small, and panning up through work you have not done yet is
 * most of what a map is for.
 *
 * Nodes are not draggable. This is a map, not an editor — the layout carries
 * meaning, so letting a player rearrange it only lets them break it.
 */

import { Link } from '@tanstack/react-router';
import { CompositeBadge } from '@simten/ui/nodes';
import {
  Background,
  BackgroundVariant,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo } from 'react';
import { buildMapGraph, type LevelNodeData, MAP_ROWS, NODE_WIDTH } from '../game/map';
import { simulateMap } from '../game/map-circuit';

/** Node data plus the interaction callbacks, which are view state rather than map data. */
type LevelNodeView = LevelNodeData & {
  onHover?: (levelId: string) => void;
  onExpand?: (levelId: string) => void;
};
type LevelNode = Node<LevelNodeView, 'level'>;

/**
 * Whether the circuit's verdict is allowed to actually lock a level.
 *
 * The map really does compute unlock state — see `map-circuit.ts` — but nothing
 * persists progress yet, so no level can ever become solved and enforcing the
 * result would leave every level after the first permanently shut. The gate is
 * built and wired; this just lets it pass through until there is a save system
 * for it to read. Flip to `true` the day progress is stored.
 */
const ENFORCE_LOCKING = false;

const STATE_STYLES: Record<LevelNodeData['state'], string> = {
  solved: 'border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400',
  available: 'border-border bg-card hover:border-foreground/40',
  locked: 'border-border/40 bg-muted/30 text-muted-foreground',
};

function LevelMapNode({ data }: NodeProps<LevelNode>) {
  const locked = data.state === 'locked';

  const body = (
    <span className="flex items-baseline gap-3">
      <span className="font-mono text-xs text-muted-foreground">
        {String(data.position).padStart(2, '0')}
      </span>
      <span className="font-medium leading-tight">{data.title}</span>
    </span>
  );

  return (
    <>
      {/* Edges enter from below and leave from the top: the map reads upward. */}
      <Handle type="target" position={Position.Bottom} className="!opacity-0" />
      {/*
        `pointer-events-auto` is load-bearing. A node that is neither draggable
        nor selectable gets `pointer-events: none` from React Flow, so the pane
        underneath swallows every click and the links silently do nothing.
        `nopan` stops a click on a card from being read as a drag of the canvas.
      */}
      <div
        className={`nopan pointer-events-auto relative flex items-center rounded-lg border px-4 py-3 transition-colors ${
          STATE_STYLES[data.state]
        }`}
        style={{ width: NODE_WIDTH }}
      >
        {locked ? (
          body
        ) : (
          <>
            <Link
              to="/play/$levelId"
              params={{ levelId: data.levelId }}
              // Opening the drilldown on focus as well as hover is not just for
              // the linter: it is what gives the panel to anyone tabbing the map
              // rather than pointing at it.
              onMouseEnter={() => data.onHover?.(data.levelId)}
              onFocus={() => data.onHover?.(data.levelId)}
              className="w-full outline-none focus-visible:underline"
            >
              {body}
            </Link>
            {/*
              The same badge the canvas puts on a composite component, carrying
              the same gesture and the same tooltip — so "there is something
              inside this" is a thing you can see rather than a thing you have
              to guess. It sits outside the Link deliberately: clicking the card
              still opens the level, and inspecting is its own target.

              `contents` keeps the button boxless, so the badge's own absolute
              positioning still resolves against the card rather than nesting a
              second offset inside a wrapper.
            */}
            <button
              type="button"
              className="contents"
              aria-label={`Look inside ${data.title}`}
              onDoubleClick={() => data.onExpand?.(data.levelId)}
            >
              <CompositeBadge />
            </button>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Top} className="!opacity-0" />
    </>
  );
}

const NODE_TYPES: NodeTypes = { level: LevelMapNode };

export interface LevelMapProps {
  /** Completed level ids. Empty until progress is persisted. */
  solved?: ReadonlySet<string>;
  /** Called when a level is hovered, so the page can preview its drilldown. */
  onHoverLevel?: (levelId: string) => void;
  /** Called on double-click, to open the full inspector. */
  onExpandLevel?: (levelId: string) => void;
}

type LevelMapCanvasProps = LevelMapProps;

function LevelMapCanvas({ solved, onHoverLevel, onExpandLevel }: LevelMapCanvasProps) {
  const { nodes, edges } = useMemo(() => buildMapGraph(solved), [solved]);

  /**
   * Unlock state comes from running the map as a circuit, not from computing it
   * here. `live` is the set of levels whose switch is on, which is what decides
   * whether the wire leaving them carries signal.
   */
  const { unlocked, live } = useMemo(() => simulateMap(solved), [solved]);

  const flowNodes: LevelNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'level' as const,
        position: n.position,
        data: {
          ...n.data,
          state:
            n.data.state === 'solved'
              ? 'solved'
              : !ENFORCE_LOCKING || unlocked.has(n.id)
                ? 'available'
                : 'locked',
          onHover: onHoverLevel,
          onExpand: onExpandLevel,
        },
      })),
    [nodes, unlocked, onHoverLevel, onExpandLevel],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        // A wire is hot when the level driving it is solved — the same fact the
        // simulator used to decide what the gates above it see.
        const hot = live.has(e.source);
        return {
          ...e,
          type: 'smoothstep',
          animated: hot,
          style: {
            stroke: hot ? 'var(--color-emerald-500, #10b981)' : 'var(--color-border)',
            strokeWidth: hot ? 2.5 : 2,
          },
        };
      }),
    [edges, live],
  );

  /**
   * Open on the start of the campaign rather than fitting the whole graph,
   * which would shrink it to illegibility and give away how much is left.
   */
  const focusStart = useCallback((instance: ReactFlowInstance<LevelNode, Edge>) => {
    const first = MAP_ROWS[0]?.[0];
    const node = first ? instance.getNode(first) : undefined;
    // Centre well above the first node so it sits near the bottom of the
    // viewport with the rest of the act climbing away above it, rather than
    // dead-centre with empty canvas underneath.
    if (node) instance.setCenter(node.position.x, node.position.y - 240, { zoom: 1 });
  }, []);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onInit={focusStart}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.4}
      maxZoom={1.4}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
    </ReactFlow>
  );
}

export function LevelMap(props: LevelMapProps) {
  return (
    <ReactFlowProvider>
      <LevelMapCanvas {...props} />
    </ReactFlowProvider>
  );
}
