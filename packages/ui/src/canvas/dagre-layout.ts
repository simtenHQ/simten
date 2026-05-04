/**
 * Dagre layout computation — synchronous, no I/O.
 *
 * Uses @dagrejs/dagre (~30 KB gzip) for Sugiyama-style layered layouts
 * — the right shape for digital circuits with their natural left-to-right
 * data flow. Dagre returns node positions as CENTER coordinates; we
 * convert to top-left to match React Flow's expected convention.
 */

import dagre from "@dagrejs/dagre";
import type { Circuit } from "@simten/core";
import type { MetadataState } from "./types";

/** Node size constants by component type. Used to feed dagre. */
export const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  Switch:        { width: 140, height: 110 },
  Button:        { width: 120, height: 80 },
  Input:         { width: 140, height: 80 },
  Led:           { width: 100, height: 110 },
  Output:        { width: 100, height: 80 },
  HexDisplay:    { width: 100, height: 80 },
  SevenSegment:  { width: 100, height: 80 },
  Screen:        { width: 200, height: 200 },
  RasterDisplay: { width: 200, height: 200 },
  Console:       { width: 380, height: 220 },
  Register:      { width: 120, height: 80 },
  RAM:           { width: 120, height: 80 },
  ROM:           { width: 120, height: 80 },
  DualPortRAM:   { width: 140, height: 100 },
};

export const DEFAULT_DIMENSIONS = { width: 160, height: 80 };

export function getDimensions(componentRef: string) {
  return NODE_DIMENSIONS[componentRef] ?? DEFAULT_DIMENSIONS;
}

export interface DagreLayoutOptions {
  /** Layout direction. "LR" = left-to-right (default), "TB" = top-to-bottom. */
  direction?: "LR" | "TB" | "RL" | "BT";
  /** Inter-node spacing in the same rank. */
  nodeSpacing?: number;
  /** Spacing between ranks. */
  rankSpacing?: number;
}

/**
 * Compute dagre layout for a circuit. Returns a MetadataState with node
 * positions in top-left coordinates.
 *
 * Synchronous — dagre.layout() does no I/O. Callers can use the result
 * immediately on first render.
 */
export function computeDagreLayout(
  circuit: Circuit,
  options?: DagreLayoutOptions,
): MetadataState {
  const direction = options?.direction ?? "LR";
  const nodeSpacing = options?.nodeSpacing ?? 60;
  const rankSpacing = options?.rankSpacing ?? 90;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their dimensions.
  const nodeIds = new Set<string>();
  for (const node of circuit.nodes) {
    const dims = getDimensions(node.componentRef);
    g.setNode(node.id, { width: dims.width, height: dims.height });
    nodeIds.add(node.id);
  }

  // Add edges. Dagre doesn't track per-port connections, so we just
  // record source→target. Skip connections whose endpoints aren't real
  // nodes (e.g. circuit-level input/output ports) — calling setEdge with
  // unknown ids would auto-create dimensionless phantom nodes and crash
  // dagre's layout passes.
  for (const conn of circuit.connections) {
    if (!nodeIds.has(conn.source.nodeId) || !nodeIds.has(conn.target.nodeId)) continue;
    g.setEdge(conn.source.nodeId, conn.target.nodeId);
  }

  // Synchronous; no I/O.
  dagre.layout(g);

  const metadata: MetadataState = { components: {}, connections: {} };
  for (const node of circuit.nodes) {
    const laid = g.node(node.id);
    if (!laid) continue;
    // Dagre returns center; convert to top-left.
    metadata.components[node.id] = {
      id: node.id,
      position: {
        x: laid.x - laid.width / 2,
        y: laid.y - laid.height / 2,
      },
    };
  }

  return metadata;
}
