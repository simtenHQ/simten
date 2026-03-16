/**
 * Chat UI Utilities
 *
 * Exports for UI-layer utilities.
 */

export { extractPotentialNodeRefs, extractNodeReferences, extractUniqueNodeIds, type CircuitNodeChecker } from './node-reference-parser';
export { highlightNodesFromMessage, clearMessageHighlights, clearAllHighlights, getHighlightState, createCircuitChecker, type HighlightState, type HighlightActions } from './auto-highlighter';
