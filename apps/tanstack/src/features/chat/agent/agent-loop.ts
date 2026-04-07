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
  ValidationSnapshot,
  ObservationRequest,
} from './types';
import type { ActionExecutionContext } from '../actions/action-executor';
import { parseGoalFromMessage, updateGoalState, allCriteriaSatisfied, allBehavioralChecksPassed, getPendingBehavioralExpectations, hasBehavioralCriteria } from './goal-state';
import { generateExpectationsFromGoal } from './expectation-generator';
import { computeSemanticSignals, computeBehavioralSignal, createDefaultSignals } from './semantic-signals';
import { verifyBehavior, portValuesToSimResult } from './behavioral-verification';
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
  code: string;
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

  // Raise turn limit for verification tasks (behavioral or assertion criteria)
  const hasVerificationGoals = hasBehavioralCriteria(goalState) ||
    goalState.successCriteria.some(c => c.id === 'assertion-coverage');
  const effectiveGuardrails = hasVerificationGoals
    ? { ...guardrails, MAX_TURNS: Math.max(guardrails.MAX_TURNS, 15) }
    : guardrails;

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
    if (state.turns.length >= effectiveGuardrails.MAX_TURNS) {
      state.status = 'max_turns_reached';
      break;
    }

    const turnNumber = state.turns.length + 1;
    callbacks?.onTurnStart?.(turnNumber, state.currentPlan);

    // Build context for this turn
    const turnContext = buildTurnContext({
      userMessage,
      code: executionContext.getCurrentCode(),
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

    // Handle observation request (gathers data without consuming an action)
    if (response.observationRequest) {
      const obsResult = await fulfillObservationRequest(response.observationRequest, executionContext);
      if (obsResult) {
        currentNarrative = (currentNarrative ? currentNarrative + '\n\n' : '') + obsResult;
      }
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
    if (state.totalTokensUsed >= effectiveGuardrails.TOTAL_TOKEN_BUDGET) {
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
import type { ShowDiffAction } from '../types';

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

  // For VERIFY_ASSERTION, the result.reason contains the formatted summary
  // Parse it to populate structured assertion results on the observation
  if (action.type === 'VERIFY_ASSERTION' && result.success && result.reason) {
    // The reason string is from formatAssertionSummary — extract pass/fail counts
    const passMatch = result.reason.match(/(\d+)\/(\d+) passed/);
    if (passMatch) {
      const passed = parseInt(passMatch[1], 10);
      const total = parseInt(passMatch[2], 10);
      observation.assertionResults = {
        total,
        passed,
        failed: total - passed,
        allPassed: passed === total,
        results: [],
      };
    }
  }

  // For RUN_SIMULATION, run behavioral verification
  if (action.type === 'RUN_SIMULATION' && result.success) {
    const pendingExpectations = getPendingBehavioralExpectations(goalState, expectations);

    if (pendingExpectations.length > 0 && context.getPortValues) {
      const portValues = context.getPortValues();
      const simResult = portValuesToSimResult(portValues, 1);

      const verificationResults = pendingExpectations.map(exp =>
        verifyBehavior(exp, simResult)
      );

      observation.verificationResults = verificationResults;
      observation.signals.behavioral = computeBehavioralSignal(verificationResults);
    }
  }

  return observation;
}

/**
 * Capture current validation state from context.
 */
function captureValidationState(context: ActionExecutionContext): ValidationSnapshot {
  if (context.getValidationSnapshot) {
    return context.getValidationSnapshot();
  }
  // Fallback if callback not wired
  return { errors: 0, warnings: 0, canSimulate: true };
}

/**
 * Build refreshed narrative context after an action.
 */
function buildRefreshedNarrative(context: ActionExecutionContext): string {
  if (context.getNarrativeContext) {
    return context.getNarrativeContext();
  }
  return '';
}

// ============================================================================
// Observation Request Fulfillment
// ============================================================================

/**
 * Fulfill an observation request from the agent.
 * Returns a string to inject into the narrative context for the next turn.
 */
async function fulfillObservationRequest(
  request: ObservationRequest,
  context: ActionExecutionContext
): Promise<string | null> {
  switch (request.type) {
    case 'validate': {
      const snapshot = captureValidationState(context);
      return `[Observation: Validation] Errors: ${snapshot.errors}, Warnings: ${snapshot.warnings}, Can simulate: ${snapshot.canSimulate}`;
    }

    case 'simulate': {
      // Run a quick simulation and report port values
      const cycles = request.cycles ?? 1;
      try {
        const result = await executeAction(
          { type: 'RUN_SIMULATION', cycles } as AssistantAction,
          context
        );
        if (result.success && context.getPortValues) {
          const portValues = context.getPortValues();
          const entries = Array.from(portValues.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          return `[Observation: Simulation ${cycles} cycles] Port values: ${entries}`;
        }
        return `[Observation: Simulation failed] ${result.reason ?? 'Unknown error'}`;
      } catch {
        return '[Observation: Simulation error]';
      }
    }

    case 'inspect_signal': {
      if (!request.signalName || !context.getPortValues) return null;
      const portValues = context.getPortValues();
      const value = portValues.get(request.signalName);
      if (value !== undefined) {
        return `[Observation: Signal ${request.signalName}] Current value: ${value}`;
      }
      return `[Observation: Signal ${request.signalName}] Not found in current port values`;
    }

    default:
      return null;
  }
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
