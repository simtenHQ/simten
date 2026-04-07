/**
 * Turn Context Builder
 *
 * Builds the context string for each agent turn.
 * Combines goal state, turn history, and semantic signals
 * into a format optimized for LLM reasoning.
 */

import type { AgentTurn, GoalState, SemanticSignal } from './types';
import type { AgentTurnContext } from './agent-loop';
import { formatGoalState } from '../context/goal-formatter';
import { formatSemanticSignals } from './semantic-signals';
import { buildTurnHistory } from './turn-summarizer';

// ============================================================================
// Turn Context Building
// ============================================================================

/**
 * Options for building turn context.
 */
export interface TurnContextOptions {
  /** Original user message */
  userMessage: string;
  /** Current DSL code */
  code: string;
  /** Narrative context from the analysis pipeline */
  narrativeContext: string;
  /** Current goal state */
  goalState: GoalState;
  /** Previous turns in the session */
  turns: AgentTurn[];
  /** Latest semantic signals */
  signals: SemanticSignal;
}

/**
 * Build context for an agent turn.
 */
export function buildTurnContext(options: TurnContextOptions): AgentTurnContext {
  const { userMessage, code, narrativeContext, goalState, turns, signals } = options;

  // Format goal state for prompt
  const goalStateStr = formatGoalState(goalState);

  // Format turn history (compressed for long sessions)
  const turnHistory = buildTurnHistory(turns, 2000);

  // Format semantic signals
  const signalsStr = formatSemanticSignals(signals);

  return {
    userMessage,
    code,
    context: narrativeContext,
    goalState: goalStateStr,
    turnHistory,
    semanticSignals: signalsStr,
  };
}

// ============================================================================
// Initial Context Building
// ============================================================================

/**
 * Build initial context for the first turn.
 */
export function buildInitialContext(
  userMessage: string,
  code: string,
  narrativeContext: string,
  goalState: GoalState
): AgentTurnContext {
  return {
    userMessage,
    code,
    context: narrativeContext,
    goalState: formatGoalState(goalState),
    turnHistory: '(First turn - no history)',
    semanticSignals: '(No signals yet - first turn)',
  };
}

// ============================================================================
// Context Refresh
// ============================================================================

/**
 * Refresh context after an action execution.
 * Updates the narrative context with fresh validation state.
 */
export function refreshContext(
  previousContext: AgentTurnContext,
  newCode: string,
  newNarrativeContext: string,
  goalState: GoalState,
  turns: AgentTurn[],
  signals: SemanticSignal
): AgentTurnContext {
  return buildTurnContext({
    userMessage: previousContext.userMessage,
    code: newCode,
    narrativeContext: newNarrativeContext,
    goalState,
    turns,
    signals,
  });
}
