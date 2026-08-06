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

type LevelNode = Node<LevelNodeData, 'level'>;

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
        className={`nopan pointer-events-auto flex items-center rounded-lg border px-4 py-3 transition-colors ${
          STATE_STYLES[data.state]
        }`}
        style={{ width: NODE_WIDTH }}
      >
        {locked ? (
          body
        ) : (
          <Link
            to="/play/$levelId"
            params={{ levelId: data.levelId }}
            className="w-full outline-none focus-visible:underline"
          >
            {body}
          </Link>
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
}

function LevelMapCanvas({ solved }: LevelMapProps) {
  const { nodes, edges } = useMemo(() => buildMapGraph(solved), [solved]);

  const flowNodes: LevelNode[] = useMemo(
    () => nodes.map((n) => ({ id: n.id, type: 'level', position: n.position, data: n.data })),
    [nodes],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        ...e,
        type: 'smoothstep',
        style: { stroke: 'var(--color-border)', strokeWidth: 2 },
      })),
    [edges],
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
