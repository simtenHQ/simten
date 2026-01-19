/**
 * Auto-Layout Utilities
 *
 * Automatic layout algorithms for organizing circuit components.
 * Creates professional-looking layouts with minimal wire crossings.
 */

import type { IRState, Position } from '../types';

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
  ir: IRState
): Record<string, Position> {
  const newPositions: Record<string, Position> = {};

  // Categorize components by type
  const inputs: string[] = [];
  const outputs: string[] = [];
  const logicGates: string[] = [];

  Object.entries(ir.components).forEach(([id, component]) => {
    if (component.type === 'SWITCH') {
      inputs.push(id);
    } else if (component.type === 'LED') {
      outputs.push(id);
    } else {
      logicGates.push(id);
    }
  });

  // Calculate levels for logic gates based on dependencies
  const levels = calculateLevels(ir, inputs);

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
function calculateLevels(ir: IRState, inputs: string[]): Record<string, number> {
  const levels: Record<string, number> = {};

  // Inputs are at level -1 (before level 0)
  inputs.forEach((id) => {
    levels[id] = -1;
  });

  // Build adjacency list (component -> components it feeds into)
  const graph: Record<string, string[]> = {};
  Object.values(ir.connections).forEach((conn) => {
    if (!graph[conn.sourceComponentId]) {
      graph[conn.sourceComponentId] = [];
    }
    graph[conn.sourceComponentId].push(conn.targetComponentId);
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
  ir: IRState
): Record<string, Position> {
  const newPositions: Record<string, Position> = {};
  const componentIds = Object.keys(ir.components);

  const cols = Math.ceil(Math.sqrt(componentIds.length));

  componentIds.forEach((id, index) => {
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
