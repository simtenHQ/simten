/**
 * Design Delta Analysis
 *
 * Compares two circuit versions to understand what changed.
 * Supports design space exploration:
 * - "What changes if I add a register here?"
 * - "How does pipelining affect depth?"
 *
 * Design Principles:
 * - Delta is always computed between two ElaboratedContexts
 * - Latency approximation is documented as rough estimate
 * - All output is deterministic
 */

import type { ElaboratedContext, CircuitMetrics, CircuitDelta } from './types.js';
import { emptyDelta } from './types.js';
import { analyzeCircuit } from './metrics.js';
import { buildCombinationalGraph, hasCycle } from '../validation/structural.js';

// ============================================================================
// Main Comparison Function
// ============================================================================

/**
 * Compare two circuits and compute what changed.
 *
 * @param original - Original circuit context
 * @param mutated - Modified circuit context
 * @returns Delta describing the changes
 */
export function compareCircuits(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): CircuitDelta {
  // Compute metrics for both circuits
  // Handle potential cycles gracefully
  let origMetrics: CircuitMetrics | null = null;
  let mutMetrics: CircuitMetrics | null = null;
  let origHasCycle = false;
  let mutHasCycle = false;

  try {
    origMetrics = analyzeCircuit(original);
  } catch {
    origHasCycle = true;
  }

  try {
    mutMetrics = analyzeCircuit(mutated);
  } catch {
    mutHasCycle = true;
  }

  // Check if cycles were resolved
  const origGraph = buildCombinationalGraph(original.flat, original.library);
  const mutGraph = buildCombinationalGraph(mutated.flat, mutated.library);
  const cycleResolved = hasCycle(origGraph) && !hasCycle(mutGraph);

  // If both have cycles, we can still compute some deltas
  if (origHasCycle && mutHasCycle) {
    return {
      ...emptyDelta(),
      cycleResolved: false,
      nodeCountChange: mutated.flat.nodes.length - original.flat.nodes.length,
      nodesAdded: findAddedNodes(original, mutated),
      nodesRemoved: findRemovedNodes(original, mutated),
    };
  }

  // Compute metrics-based deltas
  const combinationalDepthChange =
    (mutMetrics?.combinationalDepth ?? 0) - (origMetrics?.combinationalDepth ?? 0);

  const registerCountChange =
    (mutMetrics?.registerCount ?? 0) - (origMetrics?.registerCount ?? 0);

  const nodeCountChange =
    (mutMetrics?.nodeCount ?? 0) - (origMetrics?.nodeCount ?? 0);

  // NOTE: latencyChange is an APPROXIMATION using registerCountChange
  // Not accurate for complex pipelines - document this clearly
  const latencyChange = registerCountChange;

  return {
    combinationalDepthChange,
    registerCountChange,
    cycleResolved,
    latencyChange,
    nodesAdded: findAddedNodes(original, mutated),
    nodesRemoved: findRemovedNodes(original, mutated),
    nodeCountChange,
  };
}

// ============================================================================
// Node Difference Computation
// ============================================================================

/**
 * Find nodes that were added in the mutated circuit.
 */
export function findAddedNodes(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): string[] {
  const origNodeIds = new Set(original.flat.nodes.map((n) => n.id));
  const added: string[] = [];

  for (const node of mutated.flat.nodes) {
    if (!origNodeIds.has(node.id)) {
      added.push(node.id);
    }
  }

  return added.sort();
}

/**
 * Find nodes that were removed from the original circuit.
 */
export function findRemovedNodes(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): string[] {
  const mutNodeIds = new Set(mutated.flat.nodes.map((n) => n.id));
  const removed: string[] = [];

  for (const node of original.flat.nodes) {
    if (!mutNodeIds.has(node.id)) {
      removed.push(node.id);
    }
  }

  return removed.sort();
}

// ============================================================================
// Connection Difference Computation
// ============================================================================

/**
 * Connection identifier for comparison.
 */
function connectionId(
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string
): string {
  return `${sourceNodeId}.${sourcePort}->${targetNodeId}.${targetPort}`;
}

/**
 * Find connections that were added in the mutated circuit.
 */
export function findAddedConnections(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): string[] {
  const origConnIds = new Set(
    original.flat.connections.map((c) =>
      connectionId(c.source.nodeId, c.source.portName, c.target.nodeId, c.target.portName)
    )
  );

  const added: string[] = [];
  for (const conn of mutated.flat.connections) {
    const id = connectionId(
      conn.source.nodeId,
      conn.source.portName,
      conn.target.nodeId,
      conn.target.portName
    );
    if (!origConnIds.has(id)) {
      added.push(id);
    }
  }

  return added.sort();
}

/**
 * Find connections that were removed from the original circuit.
 */
export function findRemovedConnections(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): string[] {
  const mutConnIds = new Set(
    mutated.flat.connections.map((c) =>
      connectionId(c.source.nodeId, c.source.portName, c.target.nodeId, c.target.portName)
    )
  );

  const removed: string[] = [];
  for (const conn of original.flat.connections) {
    const id = connectionId(
      conn.source.nodeId,
      conn.source.portName,
      conn.target.nodeId,
      conn.target.portName
    );
    if (!mutConnIds.has(id)) {
      removed.push(id);
    }
  }

  return removed.sort();
}

// ============================================================================
// Delta Summary
// ============================================================================

/**
 * Generate a human-readable summary of the delta.
 */
export function summarizeDelta(delta: CircuitDelta): string {
  const parts: string[] = [];

  if (delta.cycleResolved) {
    parts.push('Resolved combinational cycle');
  }

  if (delta.combinationalDepthChange !== 0) {
    const direction = delta.combinationalDepthChange < 0 ? 'reduced' : 'increased';
    parts.push(`Combinational depth ${direction} by ${Math.abs(delta.combinationalDepthChange)}`);
  }

  if (delta.registerCountChange !== 0) {
    const direction = delta.registerCountChange > 0 ? 'added' : 'removed';
    parts.push(`${Math.abs(delta.registerCountChange)} register(s) ${direction}`);
  }

  if (delta.nodesAdded.length > 0) {
    parts.push(`Added nodes: ${delta.nodesAdded.join(', ')}`);
  }

  if (delta.nodesRemoved.length > 0) {
    parts.push(`Removed nodes: ${delta.nodesRemoved.join(', ')}`);
  }

  if (parts.length === 0) {
    return 'No significant changes detected';
  }

  return parts.join('. ');
}

/**
 * Generate an LLM-friendly suggestion based on the delta.
 */
export function generateDeltaSuggestion(delta: CircuitDelta): string {
  const suggestions: string[] = [];

  if (delta.cycleResolved) {
    suggestions.push('The combinational cycle has been broken.');
  }

  if (delta.combinationalDepthChange < 0) {
    suggestions.push(
      `Combinational depth reduced by ${Math.abs(delta.combinationalDepthChange)}, ` +
      'potentially allowing higher clock frequencies.'
    );
  }

  if (delta.registerCountChange > 0 && delta.combinationalDepthChange < 0) {
    suggestions.push(
      `Adding ${delta.registerCountChange} register(s) creates pipelining ` +
      `but adds ${delta.latencyChange} cycle(s) of latency.`
    );
  }

  if (suggestions.length === 0) {
    return 'No significant design impact from this change.';
  }

  return suggestions.join(' ');
}

// ============================================================================
// Detailed Comparison
// ============================================================================

/**
 * Extended delta with more details.
 */
export interface DetailedDelta extends CircuitDelta {
  /** Connections added */
  connectionsAdded: string[];
  /** Connections removed */
  connectionsRemoved: string[];
  /** Component type changes */
  componentTypeChanges: Array<{
    nodeId: string;
    from: string;
    to: string;
  }>;
}

/**
 * Compute a detailed delta with connection changes.
 */
export function compareCircuitsDetailed(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): DetailedDelta {
  const baseDelta = compareCircuits(original, mutated);

  return {
    ...baseDelta,
    connectionsAdded: findAddedConnections(original, mutated),
    connectionsRemoved: findRemovedConnections(original, mutated),
    componentTypeChanges: findComponentTypeChanges(original, mutated),
  };
}

/**
 * Find nodes whose component type changed.
 */
function findComponentTypeChanges(
  original: ElaboratedContext,
  mutated: ElaboratedContext
): Array<{ nodeId: string; from: string; to: string }> {
  const changes: Array<{ nodeId: string; from: string; to: string }> = [];

  const origNodeMap = new Map(original.flat.nodes.map((n) => [n.id, n]));
  const mutNodeMap = new Map(mutated.flat.nodes.map((n) => [n.id, n]));

  for (const [nodeId, origNode] of origNodeMap) {
    const mutNode = mutNodeMap.get(nodeId);
    if (mutNode && origNode.primitiveType !== mutNode.primitiveType) {
      changes.push({
        nodeId,
        from: origNode.primitiveType,
        to: mutNode.primitiveType,
      });
    }
  }

  return changes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}
