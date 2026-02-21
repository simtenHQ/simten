/**
 * Context Module
 *
 * Exports for context building and token management.
 */

export {
  buildNarrativeSummary,
  buildMinimalNarrative,
  formatCurrentPortValues,
} from './narrative-builder';

export {
  countTokens,
  isUnderBudget,
  remainingBudget,
  enforceTokenBudget,
  truncateConversationHistory,
} from './token-counter';

export {
  formatGoalState,
  formatGoalStateCompact,
  formatStatusChange,
  getRecentChanges,
} from './goal-formatter';
