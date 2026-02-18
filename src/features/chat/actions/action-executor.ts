/**
 * Action Executor
 *
 * Maps LLM actions to store mutations.
 * Handles safety levels, staleness checks, and idempotency.
 */

import type { AssistantAction, ActionResult, ActionExecutionStatus } from '../types';
import { ACTION_SAFETY } from '../constants';
import { validateAction, isKnownActionType } from './action-validator';
import { validateShowDiff } from './diff-validator';
import { normalizeAction } from './action-normalizer';
import { createActionLogger, logActionSkip, logActionValidationFailed } from './action-logger';
import { getIdempotencyTracker } from './idempotency-tracker';
import { checkStaleness, createStaleResult, createCannotSimulateResult } from './staleness-checker';
import { getSimulationThrottle, type SimulationContext } from './simulation-throttle';
import type { SetInputAction, RunSimulationAction, ShowDiffAction, InsertNodeAction } from '@/lib/baml_client/baml_client';

// ============================================================================
// Execution Context
// ============================================================================

export interface ActionExecutionContext {
  /** Session ID for idempotency tracking */
  sessionId: string;
  /** Get current DSL code */
  getCurrentCode: () => string;
  /** Code hash when action was created */
  sourceCodeHash?: string;
  /** Set code in the editor */
  setCode: (code: string) => void;
  /** Set an input component's value (Switch, Button, Input) */
  setInput: (nodeName: string, value: number) => void;
  /** Run simulation */
  runSimulation: (cycles: number, stimuli?: Record<string, number>) => Promise<void>;
  /** Insert a node into the circuit */
  insertNode: (
    componentRef: string,
    label?: string,
    connectFrom?: string,
    connectTo?: string
  ) => void;
  /** Update action status in UI */
  onStatusChange?: (actionId: string, status: ActionExecutionStatus) => void;
  /** Request user confirmation */
  requestConfirmation?: (action: AssistantAction) => Promise<boolean>;
  /** Component library for validation */
  componentLibrary?: {
    resolveComponent: (name: string) => unknown;
    getAllPrimitiveNames: () => string[];
  };
}

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute an assistant action.
 *
 * This is the main entry point for action execution.
 * It handles:
 * 1. Unknown action type graceful ignore
 * 2. Action ID normalization
 * 3. Idempotency checking
 * 4. Validation
 * 5. Staleness checking
 * 6. Safety level handling
 * 7. Action-specific execution
 */
export async function executeAction(
  rawAction: AssistantAction,
  context: ActionExecutionContext
): Promise<ActionResult> {
  // 1. Check if action type is known
  if (!isKnownActionType(rawAction.type)) {
    logActionSkip(rawAction.type, rawAction.actionId ?? 'unknown', 'Unknown action type');
    return {
      success: true,
      actionId: rawAction.actionId ?? 'unknown',
      type: rawAction.type,
      skipped: true,
      reason: `Unknown action type: ${rawAction.type}`,
    };
  }

  // 2. Normalize action (ensure valid actionId)
  const action = normalizeAction(rawAction);

  // 3. Check idempotency
  const tracker = getIdempotencyTracker(context.sessionId);
  if (tracker.hasExecuted(action.actionId)) {
    logActionSkip(action.type, action.actionId, 'Duplicate action');
    return {
      success: true,
      actionId: action.actionId,
      type: action.type,
      skipped: true,
      reason: 'Action already executed',
    };
  }

  // 4. Validate action
  const validation = validateAction(action);
  if (!validation.valid) {
    logActionValidationFailed(action, validation.reason ?? 'Unknown');
    return {
      success: false,
      actionId: action.actionId,
      type: action.type,
      reason: validation.reason,
    };
  }

  // 5. Additional validation for SHOW_DIFF
  if (action.type === 'SHOW_DIFF') {
    const diffValidation = validateShowDiff(action);
    if (!diffValidation.valid) {
      logActionValidationFailed(action, diffValidation.reason ?? 'Unknown');
      return {
        success: false,
        actionId: action.actionId,
        type: action.type,
        reason: diffValidation.reason,
        errors: diffValidation.errors,
      };
    }
  }

  // 6. Check staleness
  const staleness = checkStaleness(action, {
    getCurrentCode: context.getCurrentCode,
    sourceCodeHash: context.sourceCodeHash,
  });

  if (staleness.isStale) {
    return createStaleResult(action.actionId, action.type, staleness.reason ?? 'Stale');
  }

  // 7. Check safety level
  const safetyLevel = ACTION_SAFETY[action.type] ?? 'confirm';

  if (safetyLevel === 'confirm' && context.requestConfirmation) {
    const confirmed = await context.requestConfirmation(action);
    if (!confirmed) {
      return {
        success: true,
        actionId: action.actionId,
        type: action.type,
        skipped: true,
        reason: 'User cancelled',
      };
    }
  }

  // 8. Update status and execute
  context.onStatusChange?.(action.actionId, 'executing');

  const logger = createActionLogger(action);
  let result: ActionResult;

  try {
    result = await executeActionByType(action, context, staleness.canSimulate);
    tracker.markExecuted(action.actionId);
  } catch (error) {
    result = {
      success: false,
      actionId: action.actionId,
      type: action.type,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  logger.logResult(result);
  context.onStatusChange?.(action.actionId, result.success ? 'completed' : 'failed');

  return result;
}

// ============================================================================
// Action-Specific Execution
// ============================================================================

async function executeActionByType(
  action: AssistantAction & { actionId: string },
  context: ActionExecutionContext,
  canSimulate: boolean
): Promise<ActionResult> {
  switch (action.type) {
    case 'SET_INPUT':
      return executeSetInput(action, context);

    case 'RUN_SIMULATION':
      return executeRunSimulation(action, context, canSimulate);

    case 'SHOW_DIFF':
      return executeShowDiff(action, context);

    case 'INSERT_NODE':
      return executeInsertNode(action, context);

    default: {
      // Exhaustive check - this should never happen
      const exhaustiveCheck: never = action;
      return {
        success: false,
        actionId: (exhaustiveCheck as AssistantAction & { actionId: string }).actionId,
        type: (exhaustiveCheck as AssistantAction).type,
        reason: `Unhandled action type: ${(exhaustiveCheck as AssistantAction).type}`,
      };
    }
  }
}

/**
 * Execute SET_INPUT action.
 * Sets an input component's value (Switch, Button, Input).
 * For combinational circuits, this immediately propagates.
 */
async function executeSetInput(
  action: SetInputAction & { actionId: string },
  context: ActionExecutionContext
): Promise<ActionResult> {
  try {
    context.setInput(action.node, action.value);

    return {
      success: true,
      actionId: action.actionId,
      type: action.type,
    };
  } catch (error) {
    return {
      success: false,
      actionId: action.actionId,
      type: action.type,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute RUN_SIMULATION action.
 */
async function executeRunSimulation(
  action: RunSimulationAction & { actionId: string },
  context: ActionExecutionContext,
  canSimulate: boolean
): Promise<ActionResult> {
  if (!canSimulate) {
    return createCannotSimulateResult(
      action.actionId,
      'Circuit has errors and cannot be simulated'
    );
  }

  const throttle = getSimulationThrottle();
  const simContext: SimulationContext = {
    runSimulation: context.runSimulation,
  };

  return throttle.execute(action, simContext);
}

/**
 * Execute SHOW_DIFF action.
 * Note: This only prepares the diff for display.
 * The actual code mutation happens when user clicks "Apply".
 */
async function executeShowDiff(
  action: ShowDiffAction & { actionId: string },
  _context: ActionExecutionContext
): Promise<ActionResult> {
  // SHOW_DIFF doesn't actually apply the diff
  // It just returns success so the UI can display the diff
  // The "Apply" button in the UI calls setCode directly
  return {
    success: true,
    actionId: action.actionId,
    type: action.type,
  };
}

/**
 * Execute INSERT_NODE action.
 */
async function executeInsertNode(
  action: InsertNodeAction & { actionId: string },
  context: ActionExecutionContext
): Promise<ActionResult> {
  try {
    context.insertNode(
      action.componentRef,
      action.suggestedLabel ?? undefined,
      action.connectFrom ?? undefined,
      action.connectTo ?? undefined
    );

    return {
      success: true,
      actionId: action.actionId,
      type: action.type,
    };
  } catch (error) {
    return {
      success: false,
      actionId: action.actionId,
      type: action.type,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Apply Diff Helper
// ============================================================================

/**
 * Apply a SHOW_DIFF action to the editor.
 * Called when user clicks "Apply" button.
 */
export function applyDiff(
  action: ShowDiffAction,
  setCode: (code: string) => void
): void {
  setCode(action.suggestedCode);
}
