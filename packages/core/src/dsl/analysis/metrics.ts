/**
 * Circuit Metrics Extraction
 *
 * Extracts structural metrics from elaborated circuits:
 * - Node counts
 * - Register counts
 * - Combinational depth (critical path)
 * - Fan-in/Fan-out analysis
 *
 * Design Principles:
 * - All analysis is static (no simulation required)
 * - Fail fast on cyclic graphs
 * - Use metadata for component classification
 * - Deterministic output ordering
 */

import type {
  FlatCircuit,
  FlatNode,
  ComponentLibrary,
} from '../../types/simulator.js';
import { TOP_LEVEL_NODE } from '../../types/simulator.js';

import type { ElaboratedContext, CircuitMetrics, BehavioralDiagnostic } from './types.js';
import { ANALYSIS_THRESHOLDS } from './types.js';
import { buildCombinationalGraph, hasCycle } from '../validation/structural.js';

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze an elaborated circuit and extract structural metrics.
 *
 * @param ctx - Elaborated context containing flat circuit and library
 * @returns Structural metrics for the circuit
 * @throws Error if the circuit contains combinational cycles
 */
export function analyzeCircuit(ctx: ElaboratedContext): CircuitMetrics {
  const { flat, library } = ctx;

  // CRITICAL: Fail fast if graph not acyclic
  // Critical path computation requires DAG
  const combGraph = buildCombinationalGraph(flat, library);
  if (hasCycle(combGraph)) {
    throw new Error('Cannot compute metrics on cyclic graph');
  }

  // Count nodes and registers
  const nodeCount = flat.nodes.length;
  const registerCount = countSequentialNodes(flat, library);
  const isPurelyCombinational = registerCount === 0;

  // Compute critical path
  const combinationalDepth = computeCriticalPath(flat, library);

  // Compute fan metrics
  const { maxFanOut, maxFanIn } = computeFanMetrics(flat);

  // Component breakdown
  const componentBreakdown = computeComponentBreakdown(flat);

  return {
    nodeCount,
    registerCount,
    combinationalDepth,
    maxFanOut,
    maxFanIn,
    isPurelyCombinational,
    componentBreakdown,
  };
}

// ============================================================================
// Sequential Node Counting
// ============================================================================

/**
 * Count sequential elements in the circuit.
 */
export function countSequentialNodes(
  flat: FlatCircuit,
  library: ComponentLibrary
): number {
  let count = 0;

  for (const node of flat.nodes) {
    if (isSequentialNode(node, library)) {
      count++;
    }
  }

  return count;
}

/**
 * Check if a node is sequential.
 */
function isSequentialNode(node: FlatNode, library: ComponentLibrary): boolean {
  const component = library.resolveComponent(node.primitiveType);
  if (!component) return false;

  // Check metadata for sequential classification
  if (component.metadata?.kind === 'sequential') {
    return true;
  }

  // Fallback: check outputDependency
  if (component.metadata?.outputDependency === 'state-only') {
    return true;
  }

  return false;
}

// ============================================================================
// Critical Path Computation
// ============================================================================

/**
 * Compute the critical path (longest combinational chain) in the circuit.
 * This represents the maximum number of combinational gates between
 * any register output and register input, or input to output.
 */
export function computeCriticalPath(
  flat: FlatCircuit,
  library: ComponentLibrary
): number {
  // Build adjacency list for combinational nodes only
  const graph = buildCombinationalGraph(flat, library);

  // Find all sources (nodes with no combinational predecessors)
  const inDegree = new Map<string, number>();
  for (const nodeId of graph.keys()) {
    inDegree.set(nodeId, 0);
  }

  for (const successors of graph.values()) {
    for (const succ of successors) {
      inDegree.set(succ, (inDegree.get(succ) ?? 0) + 1);
    }
  }

  // Initialize distances
  const dist = new Map<string, number>();
  const queue: string[] = [];

  // Start from sources
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      dist.set(nodeId, 1); // Depth 1 for the node itself
      queue.push(nodeId);
    }
  }

  // Also consider top-level inputs as sources with depth 0
  for (const node of flat.nodes) {
    const nodeId = node.id;
    if (!dist.has(nodeId)) {
      // Check if this node is only connected from top-level
      const hasNonTopLevelSource = flat.connections.some(
        conn => conn.target.nodeId === nodeId &&
                conn.source.nodeId !== TOP_LEVEL_NODE &&
                graph.has(conn.source.nodeId)
      );

      if (!hasNonTopLevelSource && inDegree.get(nodeId) === 0) {
        dist.set(nodeId, 1);
        queue.push(nodeId);
      }
    }
  }

  // Process in topological order
  let maxDepth = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = dist.get(current) ?? 0;
    maxDepth = Math.max(maxDepth, currentDist);

    for (const next of graph.get(current) ?? []) {
      const nextDist = dist.get(next) ?? 0;
      const newDist = currentDist + 1;

      if (newDist > nextDist) {
        dist.set(next, newDist);
      }

      // Decrease in-degree and add to queue if all predecessors processed
      const newInDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, newInDegree);

      if (newInDegree === 0) {
        queue.push(next);
      }
    }
  }

  return maxDepth;
}

// ============================================================================
// Fan Metrics
// ============================================================================

/**
 * Compute maximum fan-in and fan-out for all nodes.
 */
export function computeFanMetrics(flat: FlatCircuit): {
  maxFanOut: number;
  maxFanIn: number;
} {
  const fanOut = new Map<string, number>();
  const fanIn = new Map<string, number>();

  // Initialize counts
  for (const node of flat.nodes) {
    fanOut.set(node.id, 0);
    fanIn.set(node.id, 0);
  }

  // Count connections
  for (const conn of flat.connections) {
    const sourceId = conn.source.nodeId;
    const targetId = conn.target.nodeId;

    if (sourceId !== TOP_LEVEL_NODE && fanOut.has(sourceId)) {
      fanOut.set(sourceId, (fanOut.get(sourceId) ?? 0) + 1);
    }

    if (targetId !== TOP_LEVEL_NODE && fanIn.has(targetId)) {
      fanIn.set(targetId, (fanIn.get(targetId) ?? 0) + 1);
    }
  }

  // Find maximums
  let maxFanOut = 0;
  let maxFanIn = 0;

  for (const count of fanOut.values()) {
    maxFanOut = Math.max(maxFanOut, count);
  }

  for (const count of fanIn.values()) {
    maxFanIn = Math.max(maxFanIn, count);
  }

  return { maxFanOut, maxFanIn };
}

/**
 * Get fan-out for a specific node.
 */
export function getNodeFanOut(flat: FlatCircuit, nodeId: string): number {
  let count = 0;
  for (const conn of flat.connections) {
    if (conn.source.nodeId === nodeId) {
      count++;
    }
  }
  return count;
}

/**
 * Get fan-in for a specific node.
 */
export function getNodeFanIn(flat: FlatCircuit, nodeId: string): number {
  let count = 0;
  for (const conn of flat.connections) {
    if (conn.target.nodeId === nodeId) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Component Breakdown
// ============================================================================

/**
 * Count nodes by component type.
 */
export function computeComponentBreakdown(flat: FlatCircuit): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const node of flat.nodes) {
    const type = node.primitiveType;
    breakdown[type] = (breakdown[type] ?? 0) + 1;
  }

  return breakdown;
}

// ============================================================================
// Structural Diagnostics
// ============================================================================

/**
 * Generate structural behavioral diagnostics from metrics.
 * These are insights about the design, not errors.
 */
export function generateStructuralDiagnostics(
  metrics: CircuitMetrics
): BehavioralDiagnostic[] {
  const diagnostics: BehavioralDiagnostic[] = [];

  // Long combinational path warning
  if (metrics.combinationalDepth > ANALYSIS_THRESHOLDS.LONG_COMBINATIONAL_PATH) {
    diagnostics.push({
      code: 'LONG_COMBINATIONAL_PATH',
      severity: 'suggestion',
      message: `Combinational depth is ${metrics.combinationalDepth} - consider pipelining for higher clock speeds`,
      suggestion: 'Add pipeline registers to break up long combinational paths',
    });
  }

  // High fan-out warning
  if (metrics.maxFanOut > ANALYSIS_THRESHOLDS.HIGH_FAN_OUT) {
    diagnostics.push({
      code: 'HIGH_TOGGLE_RATE', // Using this as proxy for fan-out concern
      severity: 'info',
      message: `Maximum fan-out is ${metrics.maxFanOut} - may cause timing issues at high frequencies`,
      suggestion: 'Consider buffering high fan-out signals',
    });
  }

  return diagnostics;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if circuit has any sequential elements.
 */
export function hasSequentialElements(ctx: ElaboratedContext): boolean {
  return countSequentialNodes(ctx.flat, ctx.library) > 0;
}

/**
 * Get all sequential node IDs.
 */
export function getSequentialNodeIds(ctx: ElaboratedContext): string[] {
  const ids: string[] = [];
  for (const node of ctx.flat.nodes) {
    if (isSequentialNode(node, ctx.library)) {
      ids.push(node.id);
    }
  }
  return ids.sort();
}
