/**
 * Dagre layout computation — synchronous, no I/O.
 *
 * Uses @dagrejs/dagre (~30 KB gzip) for Sugiyama-style layered layouts
 * — the right shape for digital circuits with their natural left-to-right
 * data flow. Dagre returns node positions as CENTER coordinates; we
 * convert to top-left to match React Flow's expected convention.
 */

import dagre from '@dagrejs/dagre';
import { pinColumnHeight, pinLabelGutter } from '../nodes/BaseNode';
import type { DrawnCircuit, DrawnNode, Positions } from './types';

/** Node size constants by component type. Used to feed dagre. */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  Switch: { width: 140, height: 110 },
  Input: { width: 140, height: 80 },
  Led: { width: 100, height: 110 },
  Output: { width: 100, height: 80 },
  HexDisplay: { width: 100, height: 80 },
  SevenSegment: { width: 100, height: 80 },
  Screen: { width: 200, height: 200 },
  RasterDisplay: { width: 200, height: 200 },
  Console: { width: 380, height: 220 },
  Register: { width: 120, height: 80 },
  RAM: { width: 120, height: 80 },
  ROM: { width: 120, height: 80 },
  DualPortRAM: { width: 140, height: 100 },
};

const DEFAULT_DIMENSIONS = { width: 160, height: 80 };

function getDimensions(componentRef: string) {
  return NODE_DIMENSIONS[componentRef] ?? DEFAULT_DIMENSIONS;
}

/** Roughly one character of the node's name and component text. */
const TITLE_CHAR_WIDTH = 7;

/**
 * The size a node will render at, for spacing. A block's height follows its
 * busier pin column and its width makes room for both columns of pin labels,
 * the same sums `BaseNode` uses, so a 9-output block isn't laid out as if it
 * were 80px tall and then drawn on top of its neighbour.
 */
function nodeDimensions(node: DrawnNode) {
  const base = getDimensions(node.componentRef);
  const pins = Math.max(node.inputs.length, node.outputs.length);
  const height = Math.max(base.height, pinColumnHeight(pins));
  // A port's switch or lamp shows no pin labels.
  if (node.port !== undefined) return { width: base.width, height };
  const title = Math.max((node.label ?? node.id).length, node.componentRef.length);
  const labelled =
    pinLabelGutter(node.inputs.map((p) => p.name)) +
    pinLabelGutter(node.outputs.map((p) => p.name)) +
    title * TITLE_CHAR_WIDTH;
  return { width: Math.max(base.width, labelled), height };
}

/**
 * Compute dagre layout for a circuit, left to right. Returns node positions by
 * id, in top-left coordinates.
 *
 * Synchronous — dagre.layout() does no I/O. Callers can use the result
 * immediately on first render.
 */
export function computeDagreLayout(circuit: DrawnCircuit): Positions {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their dimensions.
  const nodeIds = new Set<string>();
  for (const node of circuit.nodes) {
    const dims = nodeDimensions(node);
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

  const positions: Positions = {};
  for (const node of circuit.nodes) {
    const laid = g.node(node.id);
    if (!laid) continue;
    // Dagre returns center; convert to top-left.
    positions[node.id] = { x: laid.x - laid.width / 2, y: laid.y - laid.height / 2 };
  }

  return positions;
}
