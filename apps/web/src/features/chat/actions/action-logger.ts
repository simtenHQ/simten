/**
 * Action Logger
 *
 * Audit logging for all action executions.
 * Logs action type, parameters, results, and timing.
 */

import type { AssistantAction, ActionResult } from '../types';

// ============================================================================
// Log Entry Types
// ============================================================================

export interface ActionLogEntry {
  type: string;
  actionId: string;
  timestamp: string;
  schemaVersion?: string;
  params: Record<string, unknown>;
}

export interface ActionResultLogEntry {
  type: string;
  actionId: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// ============================================================================
// Parameter Sanitization
// ============================================================================

/**
 * Sanitize action parameters for logging.
 * Truncates large strings (like code) to prevent log bloat.
 */
function sanitizeForLog(action: AssistantAction): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: action.type,
  };

  switch (action.type) {
    case 'RUN_SIMULATION':
      result.cycles = action.cycles;
      if (action.stimuli) {
        result.stimuliKeys = Object.keys(action.stimuli);
      }
      break;

    case 'SHOW_DIFF':
      result.originalCodeLength = action.originalCode?.length ?? 0;
      result.suggestedCodeLength = action.suggestedCode?.length ?? 0;
      result.explanationPreview = action.explanation?.substring(0, 100);
      break;

    case 'INSERT_NODE':
      result.componentRef = action.componentRef;
      result.suggestedLabel = action.suggestedLabel;
      result.connectFrom = action.connectFrom;
      result.connectTo = action.connectTo;
      break;
  }

  return result;
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log action start.
 */
export function logActionStart(action: AssistantAction & { actionId: string }): void {
  const entry: ActionLogEntry = {
    type: action.type,
    actionId: action.actionId,
    timestamp: new Date().toISOString(),
    params: sanitizeForLog(action),
  };

  console.log('[ActionAudit]', JSON.stringify(entry));
}

/**
 * Log action result.
 */
export function logActionResult(
  action: AssistantAction & { actionId: string },
  result: ActionResult,
  startTime: number
): void {
  const entry: ActionResultLogEntry = {
    type: action.type,
    actionId: action.actionId,
    success: result.success,
    durationMs: Date.now() - startTime,
  };

  if (!result.success && result.reason) {
    entry.error = result.reason;
  }

  console.log('[ActionAudit:Result]', JSON.stringify(entry));
}

/**
 * Log action skip (duplicate or unknown).
 */
export function logActionSkip(
  actionType: string,
  actionId: string,
  reason: string
): void {
  console.log('[ActionAudit:Skip]', JSON.stringify({
    type: actionType,
    actionId,
    timestamp: new Date().toISOString(),
    reason,
  }));
}

/**
 * Log action validation failure.
 */
export function logActionValidationFailed(
  action: AssistantAction,
  reason: string
): void {
  console.log('[ActionAudit:ValidationFailed]', JSON.stringify({
    type: action.type,
    actionId: action.actionId,
    timestamp: new Date().toISOString(),
    reason,
  }));
}

// ============================================================================
// Batch Logging
// ============================================================================

/**
 * Create an action logger that tracks execution time.
 */
export function createActionLogger(action: AssistantAction & { actionId: string }) {
  const startTime = Date.now();
  logActionStart(action);

  return {
    logResult(result: ActionResult) {
      logActionResult(action, result, startTime);
    },
    getElapsedMs() {
      return Date.now() - startTime;
    },
  };
}
