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

import { CompositeBadge } from '@simten/ui/nodes';
import { Link } from '@tanstack/react-router';
import {
  Background,
  BackgroundVariant,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  type NodeTypes,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Crosshair } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useState } from 'react';
import {
  buildMapGraph,
  type LevelNodeData,
  MAP_ROWS,
  NODE_HEIGHT,
  NODE_WIDTH,
  SECTION_WIDTH,
} from '../game/map';
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
 * On, now that progress persists — the map computes unlock state by running
 * itself as a circuit (see `map-circuit.ts`), and a campaign where every level
 * is open from the start has no shape and no reason to care about the unlock
 * line the arithmetic band earns.
 *
 * It stays a constant rather than disappearing because it is a soft gate and
 * worth being able to lift: every level is still reachable by URL, so this
 * shapes the front door rather than enforcing anything. Off is also how you
 * look at a late level without solving nine first.
 */
const ENFORCE_LOCKING = true;

/**
 * Wire and port styling, matched to the circuit canvas rather than invented.
 *
 * `WIRE_COLORS` in `packages/ui/src/editor/types/visual.ts`: a live signal is
 * green-500, a low one slate-400, and the canvas draws every wire at
 * `strokeWidth: 2` without animation. Matching is not only cosmetic — the map
 * *is* a circuit, so a wire leaving a solved level carries a real 1, and it
 * should be the same green a 1 is everywhere else in the product.
 */
const WIRE_LIVE = '#22c55e';
const WIRE_LOW = '#94a3b8';
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
      {/*
        Edges enter from below and leave from the top: the map reads upward.
        Styled as the canvas styles a connected port — same size, same blue —
        because these are ports, on a circuit, carrying real signal.
      */}
      <Handle type="target" position={Position.Bottom} />
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
              to="/$levelId"
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

              Solved levels only. On an unsolved one there is nothing of the
              player's to show, so the drilldown falls back to the reference
              answer — which hands over the solution to a level they have not
              attempted. The badge is the affordance, so removing it is what
              removes the spoiler.

              `contents` keeps the button boxless, so the badge's own absolute
              positioning still resolves against the card rather than nesting a
              second offset inside a wrapper.
            */}
            {data.state === 'solved' && (
              <button
                type="button"
                className="contents"
                aria-label={`Look inside ${data.title}`}
                onDoubleClick={() => data.onExpand?.(data.levelId)}
              >
                <CompositeBadge />
              </button>
            )}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Top} />
    </>
  );
}

/**
 * A band label: a dashed rule with a caption, drawn as a node so it pans and
 * zooms with the map rather than floating over it.
 */
function SectionBand({ data }: NodeProps<SectionFlowNode>) {
  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-dashed border-border/60 bg-foreground/[0.025]"
      style={{ width: SECTION_WIDTH, height: data.height }}
    >
      <span className="absolute bottom-2 left-4 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
        {data.label}
      </span>
    </div>
  );
}

type SectionFlowNode = Node<{ label: string; height: number }, 'section'>;

/** Everything the map renders: level cards and band labels. */
type MapFlowNode = LevelNode | SectionFlowNode;

const NODE_TYPES: NodeTypes = { level: LevelMapNode, section: SectionBand };

export interface LevelMapProps {
  /** Completed level ids. Empty for the first frame, before storage is read. */
  solved?: ReadonlySet<string>;
  /** Called when a level is hovered, so the page can preview its drilldown. */
  onHoverLevel?: (levelId: string) => void;
  /** Called on double-click, to open the full inspector. */
  onExpandLevel?: (levelId: string) => void;
}

type LevelMapCanvasProps = LevelMapProps;

function LevelMapCanvas({ solved, onHoverLevel, onExpandLevel }: LevelMapCanvasProps) {
  const { nodes, edges, sections } = useMemo(() => buildMapGraph(solved), [solved]);

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

  // Band labels are nodes too, so React Flow pans them with everything else.
  // Not selectable and behind the levels, so they never intercept a click.
  const sectionNodes = useMemo<SectionFlowNode[]>(
    () =>
      sections.map((s) => ({
        id: s.id,
        type: 'section' as const,
        position: s.position,
        data: { label: s.label, height: s.height },
        selectable: false,
        draggable: false,
        zIndex: -1,
      })),
    [sections],
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
          animated: false,
          style: { stroke: hot ? WIRE_LIVE : WIRE_LOW, strokeWidth: 2 },
        };
      }),
    [edges, live],
  );

  /**
   * Open on the start of the campaign rather than fitting the whole graph,
   * which would shrink it to illegibility and give away how much is left.
   */
  /**
   * Put the start of the campaign back under the viewport.
   *
   * Used for the initial view and by the recenter control — the map is larger
   * than the screen and pans freely, so it is possible to end up looking at
   * empty grid with no way to tell which direction the levels are in.
   */
  const centerOnStart = useCallback(
    (instance: ReactFlowInstance<MapFlowNode, Edge>, animate = false) => {
      const first = MAP_ROWS[0]?.[0];
      const node = first ? instance.getNode(first) : undefined;
      if (!node) return;
      // `position` is the top-left corner, so half the node is added back to aim
      // at its middle. Then centre well above it, so it sits near the bottom of
      // the viewport with the rest of the act climbing away above rather than
      // dead-centre with empty canvas underneath.
      instance.setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2 - 240,
        {
          zoom: 1,
          duration: animate ? 400 : 0,
        },
      );
    },
    [],
  );

  const flow = useReactFlow<MapFlowNode, Edge>();
  const recenter = useCallback(() => centerOnStart(flow, true), [flow, centerOnStart]);

  /**
   * Hold the first paint until the map has been positioned.
   *
   * React Flow paints once at its default viewport — origin, zoom 1 — which
   * puts the graph in the top-left corner, and only then does `onInit` fire and
   * centre it. The result is a visible jump from wrong place to right place.
   * Centring earlier is not possible: it needs the container's measured size,
   * which does not exist until after mount, and server rendering has no
   * viewport at all. So the honest fix is to show nothing for that one frame
   * rather than show it in the wrong place.
   */
  const [positioned, setPositioned] = useState(false);

  return (
    <ReactFlow
      nodes={[...sectionNodes, ...flowNodes]}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onInit={(instance) => {
        centerOnStart(instance);
        setPositioned(true);
      }}
      className={`transition-opacity duration-150 ${positioned ? 'opacity-100' : 'opacity-0'}`}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.4}
      maxZoom={1.4}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <Panel position="bottom-left">
        <button
          type="button"
          onClick={recenter}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Recenter
        </button>
      </Panel>
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
