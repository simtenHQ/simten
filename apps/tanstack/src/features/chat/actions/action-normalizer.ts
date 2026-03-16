/**
 * Action Normalizer
 *
 * Server-side actionId normalization using nanoid.
 * Never trust LLM-generated IDs blindly - validate or regenerate.
 */

import { nanoid } from 'nanoid';
import type { AssistantAction } from '../types';

// ============================================================================
// ID Validation
// ============================================================================

/**
 * Check if an actionId is valid.
 * Accepts:
 * - UUID v4 format
 * - nanoid format (21 URL-safe characters)
 */
export function isValidActionId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // UUID v4 format: 8-4-4-4-12 hex digits
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // nanoid format: 21 URL-safe characters (A-Za-z0-9_-)
  const nanoidPattern = /^[A-Za-z0-9_-]{21}$/;

  return uuidPattern.test(id) || nanoidPattern.test(id);
}

/**
 * Generate a new actionId using nanoid.
 */
export function generateActionId(): string {
  return nanoid();
}

// ============================================================================
// Action Normalization
// ============================================================================

/**
 * Normalize an action by ensuring it has a valid actionId.
 * If the actionId is missing or invalid, generates a new one.
 */
export function normalizeActionId(action: AssistantAction): string {
  if (isValidActionId(action.actionId)) {
    return action.actionId as string;
  }
  return generateActionId();
}

/**
 * Normalize an action, returning a copy with a valid actionId.
 */
export function normalizeAction<T extends AssistantAction>(action: T): T & { actionId: string } {
  const normalizedId = normalizeActionId(action);
  return {
    ...action,
    actionId: normalizedId,
  };
}

/**
 * Normalize an array of actions.
 */
export function normalizeActions(
  actions: AssistantAction[]
): Array<AssistantAction & { actionId: string }> {
  return actions.map(normalizeAction);
}

// ============================================================================
// Hash Generation for Staleness Detection
// ============================================================================

/**
 * Generate a simple hash of source code for staleness detection.
 * Uses a fast, non-cryptographic hash for comparison purposes only.
 */
export function hashSourceCode(code: string): string {
  // Simple djb2 hash - fast and sufficient for our purposes
  let hash = 5381;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 33) ^ code.charCodeAt(i);
  }
  // Convert to positive hex string
  return (hash >>> 0).toString(16);
}

/**
 * Check if source code has changed by comparing hashes.
 */
export function hasSourceCodeChanged(
  originalHash: string,
  currentCode: string
): boolean {
  const currentHash = hashSourceCode(currentCode);
  return originalHash !== currentHash;
}
