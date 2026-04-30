/**
 * Actions Module
 *
 * Exports for action execution and validation.
 */

export { executeAction, applyDiff, type ActionExecutionContext } from './action-executor';
export { validateAction, isKnownActionType, handleUnknownAction } from './action-validator';
export { validateShowDiff, countChangedLines, generateSimpleDiff, getDiffSummary } from './diff-validator';
export { normalizeAction, normalizeActions, isValidActionId, generateActionId, hashSourceCode, hasSourceCodeChanged } from './action-normalizer';
export { createActionLogger, logActionStart, logActionResult, logActionSkip, logActionValidationFailed } from './action-logger';
export { IdempotencyTracker, getIdempotencyTracker, resetIdempotencyTracker } from './idempotency-tracker';
export { checkStaleness, createStaleResult, createCannotSimulateResult, type StalenessCheckContext, type StalenessCheckResult } from './staleness-checker';
export { SimulationThrottle, getSimulationThrottle, resetSimulationThrottle, type SimulationContext } from './simulation-throttle';
export { requiresConfirmation, buildConfirmationRequest, getActionPreview, requestConfirmation, getPendingConfirmation, resolveConfirmation, cancelPendingConfirmation, type ConfirmationRequest } from './confirmation-flow';
