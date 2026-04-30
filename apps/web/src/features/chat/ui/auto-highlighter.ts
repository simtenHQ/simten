/**
 * Auto Highlighter
 *
 * UI-driven highlighting based on text references.
 * Watches message text and highlights mentioned nodes.
 */

import { extractNodeReferences, extractUniqueNodeIds, type CircuitNodeChecker } from './node-reference-parser';

// ============================================================================
// Highlighting State
// ============================================================================

export interface HighlightState {
  /** Currently highlighted node IDs */
  highlightedNodes: Set<string>;
  /** Message ID that triggered this highlighting */
  sourceMessageId: string | null;
}

let currentHighlightState: HighlightState = {
  highlightedNodes: new Set(),
  sourceMessageId: null,
};

// ============================================================================
// Highlight Management
// ============================================================================

export interface HighlightActions {
  /** Highlight specific nodes */
  setHighlightedNodes: (nodeIds: string[]) => void;
  /** Clear all highlighting */
  clearHighlights: () => void;
}

/**
 * Process a message and trigger node highlighting.
 */
export function highlightNodesFromMessage(
  messageId: string,
  messageText: string,
  circuitChecker: CircuitNodeChecker,
  actions: HighlightActions
): string[] {
  // Extract node references
  const references = extractNodeReferences(messageText, circuitChecker);
  const nodeIds = extractUniqueNodeIds(references);

  // Update highlight state
  currentHighlightState = {
    highlightedNodes: new Set(nodeIds),
    sourceMessageId: messageId,
  };

  // Apply highlighting
  if (nodeIds.length > 0) {
    actions.setHighlightedNodes(nodeIds);
  }

  return nodeIds;
}

/**
 * Clear highlighting if triggered by a specific message.
 */
export function clearMessageHighlights(
  messageId: string,
  actions: HighlightActions
): void {
  if (currentHighlightState.sourceMessageId === messageId) {
    currentHighlightState = {
      highlightedNodes: new Set(),
      sourceMessageId: null,
    };
    actions.clearHighlights();
  }
}

/**
 * Clear all message-triggered highlights.
 */
export function clearAllHighlights(actions: HighlightActions): void {
  currentHighlightState = {
    highlightedNodes: new Set(),
    sourceMessageId: null,
  };
  actions.clearHighlights();
}

/**
 * Get current highlight state.
 */
export function getHighlightState(): HighlightState {
  return { ...currentHighlightState };
}

// ============================================================================
// Integration Hook
// ============================================================================

/**
 * Create a circuit checker from a circuit store.
 */
export function createCircuitChecker(
  circuit: { nodes: Array<{ id: string }> } | null
): CircuitNodeChecker {
  const nodeIds = circuit?.nodes.map((n) => n.id) ?? [];

  return {
    hasNode: (nodeId: string) =>
      nodeIds.some((id) => id.toLowerCase() === nodeId.toLowerCase()),
    getAllNodeIds: () => nodeIds,
  };
}
