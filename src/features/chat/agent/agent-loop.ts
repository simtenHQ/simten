/**
 * Agent Loop
 *
 * Main orchestrator for the goal-driven agentic loop.
 * The agent iterates through actions, observes results, and
 * continues until all success criteria are met or limits reached.
 */

import type {
  AgentState,
  AgentTurn,
  AgentResponse,
  AgentGuardrails,
  GoalState,
  ActionObservation,
  BehavioralExpectation,
} from './types';
import type { ActionExecutionContext } from '../actions/action-executor';
import { parseGoalFromMessage, updateGoalState, allCriteriaSatisfied, allBehavioralChecksPassed, getPendingBehavioralExpectations } from './goal-state';
import { generateExpectationsFromGoal } from './expectation-generator';
import { computeSemanticSignals, createDefaultSignals } from './semantic-signals';
import { buildTurnContext } from './turn-context';

// ============================================================================
// Guardrails Configuration
// ============================================================================

export const AGENT_GUARDRAILS: AgentGuardrails = {
  MAX_TURNS: 10,
  MAX_TOKENS_PER_TURN: 2000,
  TOTAL_TOKEN_BUDGET: 20000,
  AUTO_APPLY_DIFFS: true,
};

// ============================================================================
// Agent Callback Types
// ============================================================================

/**
 * Callbacks for agent progress reporting.
 */
export interface AgentCallbacks {
  /** Called when a turn starts */
  onTurnStart?: (turnNumber: number, plan: string[] | undefined) => void;
  /** Called when a turn completes */
  onTurnComplete?: (turn: AgentTurn) => void;
  /** Called when an action is executed */
  onActionExecuted?: (observation: ActionObservation) => void;
  /** Called when goal state updates */
  onGoalStateUpdate?: (goalState: GoalState) => void;
  /** Called with current state for UI updates */
  onStateUpdate?: (state: AgentState) => void;
}

/**
 * Function to call the LLM agent.
 */
export type AgentCaller = (context: AgentTurnContext) => Promise<AgentResponse>;

/**
 * Context passed to the agent for each turn.
 */
export interface AgentTurnContext {
  userMessage: string;
  dslCode: string;
  context: string;
  goalState: string;
  turnHistory: string;
  semanticSignals: string;
}

// ============================================================================
// Main Agent Loop
// ============================================================================

/**
 * Run the agent loop until goal is achieved or limits reached.
 */
export async function runAgentLoop(
  userMessage: string,
  executionContext: ActionExecutionContext,
  callAgent: AgentCaller,
  callbacks?: AgentCallbacks,
  guardrails: AgentGuardrails = AGENT_GUARDRAILS
): Promise<AgentState> {
  // Initialize state
  const goalState = parseGoalFromMessage(userMessage);
  const expectations = generateExpectationsFromGoal(goalState);

  const state: AgentState = {
    turns: [],
    totalTokensUsed: 0,
    status: 'running',
    goalState,
  };

  // Initial semantic signals (neutral)
  let currentSignals = createDefaultSignals();
  let currentNarrative = '';

  // Main loop
  while (state.status === 'running') {
    // Guard: max turns
    if (state.turns.length >= guardrails.MAX_TURNS) {
      state.status = 'max_turns_reached';
      break;
    }

    const turnNumber = state.turns.length + 1;
    callbacks?.onTurnStart?.(turnNumber, state.currentPlan);

    // Build context for this turn
    const turnContext = buildTurnContext({
      userMessage,
      dslCode: executionContext.getCurrentCode(),
      narrativeContext: currentNarrative,
      goalState: state.goalState,
      turns: state.turns,
      signals: currentSignals,
    });

    // Call the agent
    let response: AgentResponse;
    try {
      response = await callAgent(turnContext);
    } catch (error) {
      state.status = 'error';
      state.errorMessage = error instanceof Error ? error.message : String(error);
      break;
    }

    // Estimate tokens (rough approximation)
    const tokenEstimate = estimateTokens(response);
    state.totalTokensUsed += tokenEstimate;

    // Create turn record
    const turn: AgentTurn = {
      turnNumber,
      response,
      observation: null,
    };

    // Execute action if present
    if (response.action) {
      const observation = await executeAndObserve(
        response.action,
        executionContext,
        state.goalState,
        expectations,
        turnNumber
      );

      turn.observation = observation;
      currentSignals = observation.signals;

      // Update goal state based on observation
      updateGoalState(state.goalState, observation, turnNumber);
      callbacks?.onGoalStateUpdate?.(state.goalState);
      callbacks?.onActionExecuted?.(observation);

      // Refresh narrative context for next turn
      currentNarrative = buildRefreshedNarrative(executionContext);
    }

    // Update plan from response
    if (response.plan) {
      state.currentPlan = response.plan;
    }

    state.turns.push(turn);
    callbacks?.onTurnComplete?.(turn);
    callbacks?.onStateUpdate?.(state);

    // Check termination conditions
    const structuralComplete = allCriteriaSatisfied(state.goalState);
    const behavioralComplete = allBehavioralChecksPassed(state.goalState);

    if (structuralComplete && behavioralComplete) {
      state.status = 'completed';
    } else if (response.done) {
      // LLM said done but we disagree
      if (!behavioralComplete) {
        // Inject correction - loop will continue with updated context
        injectCorrectionMessage(state, 'Behavioral verification still pending. Run simulation to verify.');
      } else if (!structuralComplete) {
        injectCorrectionMessage(state, 'Structural criteria not yet satisfied.');
      }
      // Don't set status to completed - let the loop continue
    }

    // Check token budget
    if (state.totalTokensUsed >= guardrails.TOTAL_TOKEN_BUDGET) {
      state.status = 'max_turns_reached';
      break;
    }
  }

  return state;
}

// ============================================================================
// Action Execution with Observation
// ============================================================================

import { executeAction, applyDiff } from '../actions/action-executor';
import type { AssistantAction } from '../types';
import type { ShowDiffAction } from '@/lib/baml_client/baml_client';

/**
 * Execute an action and capture observations.
 */
async function executeAndObserve(
  action: AssistantAction,
  context: ActionExecutionContext,
  goalState: GoalState,
  expectations: BehavioralExpectation[],
  _turnNumber: number
): Promise<ActionObservation> {
  // Capture validation state before
  const validationBefore = captureValidationState(context);

  // Execute the action
  const result = await executeAction(action, context);

  // For SHOW_DIFF in agent mode, auto-apply the diff
  if (action.type === 'SHOW_DIFF' && result.success && AGENT_GUARDRAILS.AUTO_APPLY_DIFFS) {
    applyDiff(action as ShowDiffAction, context.setCode, context.getCurrentCode);
  }

  // Capture validation state after
  const validationAfter = captureValidationState(context);

  // Compute semantic signals
  const signals = computeSemanticSignals({
    before: validationBefore,
    after: validationAfter,
  });

  // Build observation
  const observation: ActionObservation = {
    action,
    success: result.success,
    error: result.reason,
    validationBefore,
    validationAfter,
    signals,
    appliedCode: action.type === 'SHOW_DIFF' ? context.getCurrentCode() : undefined,
  };

  // For RUN_SIMULATION, run behavioral verification
  if (action.type === 'RUN_SIMULATION' && result.success) {
    const pendingExpectations = getPendingBehavioralExpectations(goalState, expectations);

    if (pendingExpectations.length > 0) {
      // Note: In a full implementation, we'd capture actual simulation outputs
      // For now, we'll create a placeholder - the real verification would
      // require integration with the simulation engine
      observation.verificationResults = [];

      // Update behavioral signal
      observation.signals.behavioral = {
        verificationsRun: pendingExpectations.length,
        passed: 0,
        failed: pendingExpectations.length,
        mismatches: [],
      };
    }
  }

  return observation;
}

/**
 * Capture current validation state from context.
 */
function captureValidationState(_context: ActionExecutionContext): {
  errors: number;
  warnings: number;
  canSimulate: boolean;
} {
  // This would integrate with the actual validation system
  // For now, return a placeholder
  return {
    errors: 0,
    warnings: 0,
    canSimulate: true,
  };
}

/**
 * Build refreshed narrative context after an action.
 */
function buildRefreshedNarrative(_context: ActionExecutionContext): string {
  // This would call the narrative builder with fresh validation state
  // For now, return empty - the actual implementation would integrate
  // with the useNarrativeContext hook or buildNarrativeContext function
  return '';
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Estimate tokens for a response (rough approximation).
 */
function estimateTokens(response: AgentResponse): number {
  const messageTokens = Math.ceil(response.message.length / 4);
  const planTokens = response.plan ? Math.ceil(response.plan.join(' ').length / 4) : 0;
  const reasoningTokens = response.reasoning ? Math.ceil(response.reasoning.length / 4) : 0;
  const actionTokens = response.action ? 50 : 0;

  return messageTokens + planTokens + reasoningTokens + actionTokens + 100; // Base overhead
}

/**
 * Inject a correction message into the state for the next turn.
 * This is used when the LLM claims done but criteria aren't met.
 */
function injectCorrectionMessage(state: AgentState, message: string): void {
  // Add a system-style correction to the last turn
  const lastTurn = state.turns[state.turns.length - 1];
  if (lastTurn) {
    lastTurn.response.message += `\n\n[SYSTEM: ${message}]`;
  }
}

// ============================================================================
// Plan Validation
// ============================================================================

import type { PlanValidation } from './types';

/**
 * Detect contradictory steps in a plan.
 */
export function validatePlanConsistency(plan: string[]): PlanValidation {
  const conflicts: string[] = [];

  // Detect insert-then-remove contradictions
  const insertsSet = new Set<string>();
  const removesSet = new Set<string>();

  for (const step of plan) {
    const insertMatch = step.match(/insert\s+(\w+)/i);
    const removeMatch = step.match(/remove\s+(\w+)/i);

    if (insertMatch) insertsSet.add(insertMatch[1]);
    if (removeMatch) removesSet.add(removeMatch[1]);
  }

  const contradictions = [...insertsSet].filter((n) => removesSet.has(n));
  if (contradictions.length > 0) {
    conflicts.push(`Contradictory plan: insert and remove ${contradictions.join(', ')}`);
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
