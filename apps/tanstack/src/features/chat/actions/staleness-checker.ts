/**
 * Staleness Checker
 *
 * Re-validate circuit before action execution.
 * Prevents acting on outdated circuit code if user typed during streaming.
 */

import { executeCircuitCode } from '@simten/core';
import { hashSourceCode, hasSourceCodeChanged } from './action-normalizer';
import type { AssistantAction, ActionResult } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface StalenessCheckContext {
  /** Get the current code from the editor */
  getCurrentCode: () => string;
  /** The hash of code when the action was created */
  sourceCodeHash?: string;
}

export interface StalenessCheckResult {
  /** Whether the action is stale */
  isStale: boolean;
  /** Whether the circuit can be simulated (for RUN_SIMULATION) */
  canSimulate: boolean;
  /** Reason for staleness */
  reason?: string;
  /** Current code hash */
  currentHash: string;
}

// ============================================================================
// Staleness Checking
// ============================================================================

/**
 * Check if an action is stale due to circuit modifications.
 */
export function checkStaleness(
  action: AssistantAction,
  context: StalenessCheckContext
): StalenessCheckResult {
  const currentCode = context.getCurrentCode();
  const currentHash = hashSourceCode(currentCode);

  // Check if code changed since action was created
  if (
    context.sourceCodeHash &&
    hasSourceCodeChanged(context.sourceCodeHash, currentCode)
  ) {
    return {
      isStale: true,
      canSimulate: false,
      reason: 'Circuit modified since suggestion was made. Please re-ask.',
      currentHash,
    };
  }

  // For SHOW_DIFF: verify originalCode matches current
  if (action.type === 'SHOW_DIFF') {
    if (action.originalCode !== currentCode) {
      return {
        isStale: true,
        canSimulate: false,
        reason: 'Code has changed. Diff may not apply cleanly.',
        currentHash,
      };
    }
  }

  // For RUN_SIMULATION: verify circuit is simulatable
  if (action.type === 'RUN_SIMULATION') {
    const result = executeCircuitCode(currentCode);

    if (result.error || !result.circuit) {
      return {
        isStale: false,
        canSimulate: false,
        reason: 'Circuit has errors and cannot be simulated.',
        currentHash,
      };
    }
  }

  return {
    isStale: false,
    canSimulate: true,
    currentHash,
  };
}

/**
 * Create a stale action result.
 */
export function createStaleResult(
  actionId: string,
  type: string,
  reason: string
): ActionResult {
  return {
    success: false,
    actionId,
    type,
    stale: true,
    reason,
  };
}

/**
 * Create a cannot-simulate result.
 */
export function createCannotSimulateResult(
  actionId: string,
  reason: string
): ActionResult {
  return {
    success: false,
    actionId,
    type: 'RUN_SIMULATION',
    reason,
  };
}
