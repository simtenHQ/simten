/**
 * Auto-Layout Utilities
 *
 * Automatic layout algorithms for organizing circuit components.
 * Creates professional-looking layouts with minimal wire crossings.
 */

import type { Circuit } from '../types/ir-v0.1';
import type { Position } from '../types';

const GRID_SIZE = 20;
const HORIZONTAL_SPACING = 200;
const VERTICAL_SPACING = 100;

/**
 * Snaps a value to the nearest grid point
 */
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/**
 * Performs a hierarchical layout of components
 * Places inputs on the left, outputs on the right, and logic gates in the middle
 */
export function performHierarchicalLayout(
  circuit: Circuit
): Record<string, Position> {
  const newPositions: Record<string, Position> = {};

  // Categorize components by type
  const inputs: string[] = [];
  const outputs: string[] = [];
  const logicGates: string[] = [];

  circuit.nodes.forEach((node) => {
    if (node.componentRef === 'Switch') {
      inputs.push(node.id);
    } else if (node.componentRef === 'Led') {
      outputs.push(node.id);
    } else {
      logicGates.push(node.id);
    }
  });

  // Calculate levels for logic gates based on dependencies
  const levels = calculateLevels(circuit, inputs);

  // Group logic gates by level
  const gatesByLevel: Record<number, string[]> = {};
  logicGates.forEach((id) => {
    const level = levels[id] || 0;
    if (!gatesByLevel[level]) {
      gatesByLevel[level] = [];
    }
    gatesByLevel[level].push(id);
  });

  // Layout inputs (leftmost column)
  inputs.forEach((id, index) => {
    newPositions[id] = {
      x: snapToGrid(100),
      y: snapToGrid(100 + index * VERTICAL_SPACING),
    };
  });

  // Layout logic gates by level (middle columns)
  const maxLevel = Math.max(...Object.keys(gatesByLevel).map(Number), 0);
  Object.entries(gatesByLevel).forEach(([levelStr, gateIds]) => {
    const level = parseInt(levelStr);
    const x = snapToGrid(100 + (level + 1) * HORIZONTAL_SPACING);

    gateIds.forEach((id, index) => {
      newPositions[id] = {
        x,
        y: snapToGrid(100 + index * VERTICAL_SPACING),
      };
    });
  });

  // Layout outputs (rightmost column)
  const outputX = snapToGrid(100 + (maxLevel + 2) * HORIZONTAL_SPACING);
  outputs.forEach((id, index) => {
    newPositions[id] = {
      x: outputX,
      y: snapToGrid(100 + index * VERTICAL_SPACING),
    };
  });

  return newPositions;
}

/**
 * Calculates the hierarchical level of each component
 * Level 0 = directly connected to inputs
 * Level 1 = connected to level 0 outputs
 * etc.
 */
function calculateLevels(circuit: Circuit, inputs: string[]): Record<string, number> {
  const levels: Record<string, number> = {};

  // Inputs are at level -1 (before level 0)
  inputs.forEach((id) => {
    levels[id] = -1;
  });

  // Build adjacency list (node -> nodes it feeds into)
  const graph: Record<string, string[]> = {};
  circuit.connections.forEach((conn) => {
    const sourceNodeId = conn.source.nodeId;
    const targetNodeId = conn.target.nodeId;

    if (!graph[sourceNodeId]) {
      graph[sourceNodeId] = [];
    }
    graph[sourceNodeId].push(targetNodeId);
  });

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = inputs.map((id) => ({ id, level: -1 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    levels[current.id] = current.level;

    // Add connected components to queue
    const targets = graph[current.id] || [];
    targets.forEach((targetId) => {
      if (!visited.has(targetId)) {
        const targetLevel = Math.max(levels[targetId] || 0, current.level + 1);
        levels[targetId] = targetLevel;
        queue.push({ id: targetId, level: targetLevel });
      }
    });
  }

  return levels;
}

/**
 * Simple grid-based layout
 * Arranges components in a grid pattern
 */
export function performGridLayout(
  circuit: Circuit
): Record<string, Position> {
  const newPositions: Record<string, Position> = {};
  const nodeIds = circuit.nodes.map((n) => n.id);

  const cols = Math.ceil(Math.sqrt(nodeIds.length));

  nodeIds.forEach((id, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    newPositions[id] = {
      x: snapToGrid(100 + col * HORIZONTAL_SPACING),
      y: snapToGrid(100 + row * VERTICAL_SPACING),
    };
  });

  return newPositions;
}

/**
 * Center the layout in the viewport
 */
export function centerLayout(positions: Record<string, Position>): Record<string, Position> {
  if (Object.keys(positions).length === 0) return positions;

  // Find bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  Object.values(positions).forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  });

  // Calculate center offset
  const width = maxX - minX;
  const height = maxY - minY;
  const viewportWidth = 1200; // Approximate viewport width
  const viewportHeight = 800; // Approximate viewport height

  const offsetX = (viewportWidth - width) / 2 - minX;
  const offsetY = (viewportHeight - height) / 2 - minY;

  // Apply offset to all positions
  const centeredPositions: Record<string, Position> = {};
  Object.entries(positions).forEach(([id, pos]) => {
    centeredPositions[id] = {
      x: snapToGrid(pos.x + offsetX),
      y: snapToGrid(pos.y + offsetY),
    };
  });

  return centeredPositions;
}
