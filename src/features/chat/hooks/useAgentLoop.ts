/**
 * useAgentLoop Hook
 *
 * React hook for running the agentic loop from UI components.
 * Handles starting, monitoring, and cancelling agent execution.
 */

import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chat-store';
import type { ActionExecutionContext } from '../actions/action-executor';
import type { AgentState, AgentTurn, GoalState } from '../agent/types';
import { parseGoalFromMessage } from '../agent/goal-state';

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseAgentLoopOptions {
  /** Execution context for actions */
  executionContext: ActionExecutionContext;
  /** Function to get fresh narrative context (called after each action) */
  getNarrativeContext: () => string;
  /** Source code hash for staleness detection */
  sourceCodeHash: string;
}

export interface UseAgentLoopResult {
  /** Start the agent loop with a user message */
  startLoop: (userMessage: string) => Promise<AgentState>;
  /** Cancel the current agent loop */
  cancelLoop: () => void;
  /** Whether an agent loop is currently running */
  isRunning: boolean;
  /** Current agent state */
  agentState: AgentState | null;
  /** Whether agent mode is enabled */
  isAgentMode: boolean;
  /** Toggle agent mode */
  setAgentMode: (enabled: boolean) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAgentLoop(options: UseAgentLoopOptions): UseAgentLoopResult {
  const { executionContext, getNarrativeContext } = options;

  // Store state
  const isAgentMode = useChatStore((s) => s.isAgentMode);
  const isAgentRunning = useChatStore((s) => s.isAgentRunning);
  const agentState = useChatStore((s) => s.agentState);
  const setAgentMode = useChatStore((s) => s.setAgentMode);
  const startAgentLoop = useChatStore((s) => s.startAgentLoop);
  const addAgentTurn = useChatStore((s) => s.addAgentTurn);
  const finishAgentLoop = useChatStore((s) => s.finishAgentLoop);
  const cancelAgentLoop = useChatStore((s) => s.cancelAgentLoop);
  const addUserMessage = useChatStore((s) => s.addUserMessage);

  // Cancellation ref
  const cancelledRef = useRef(false);

  /**
   * Start or resume the agent loop.
   * If the agent is waiting for user input (after proposing a code change),
   * this resumes the loop. Otherwise, it starts a fresh loop.
   */
  const startLoop = useCallback(
    async (userMessage: string): Promise<AgentState> => {
      cancelledRef.current = false;

      // Check if we're resuming from a waiting state
      const isResuming = agentState?.status === 'waiting_for_user';
      const goalState = isResuming ? agentState.goalState : parseGoalFromMessage(userMessage);

      // Add user message to chat
      addUserMessage(userMessage);

      // Initialize or resume agent state
      if (!isResuming) {
        startAgentLoop(goalState);
      }

      // Run the agent loop
      try {
        const finalState = await runAgentLoopClient(
          userMessage,
          executionContext,
          getNarrativeContext,
          goalState,
          {
            onTurnComplete: (turn) => {
              if (!cancelledRef.current) {
                addAgentTurn(turn);
              }
            },
            isCancelled: () => cancelledRef.current,
          },
          // Pass existing turns if resuming
          isResuming ? agentState.turns : undefined
        );

        finishAgentLoop(finalState);
        return finalState;
      } catch (error) {
        const errorState: AgentState = {
          turns: agentState?.turns ?? [],
          totalTokensUsed: agentState?.totalTokensUsed ?? 0,
          status: 'error',
          goalState,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
        finishAgentLoop(errorState);
        return errorState;
      }
    },
    [
      executionContext,
      getNarrativeContext,
      addUserMessage,
      startAgentLoop,
      addAgentTurn,
      finishAgentLoop,
      agentState,
    ]
  );

  /**
   * Cancel the current agent loop.
   */
  const cancelLoop = useCallback(() => {
    cancelledRef.current = true;
    cancelAgentLoop();
  }, [cancelAgentLoop]);

  return {
    startLoop,
    cancelLoop,
    isRunning: isAgentRunning,
    agentState,
    isAgentMode,
    setAgentMode,
  };
}

// ============================================================================
// Client-Side Agent Runner
// ============================================================================

interface AgentRunnerCallbacks {
  onTurnComplete: (turn: AgentTurn) => void;
  isCancelled: () => boolean;
}

/**
 * Run the agent loop by calling the API for each turn.
 * This runs on the client and calls the server API for each LLM invocation.
 *
 * @param existingTurns - Pass existing turns when resuming from 'waiting_for_user' state
 */
async function runAgentLoopClient(
  userMessage: string,
  executionContext: ActionExecutionContext,
  getNarrativeContext: () => string,
  goalState: GoalState,
  callbacks: AgentRunnerCallbacks,
  existingTurns?: AgentTurn[]
): Promise<AgentState> {
  const MAX_TURNS = 10;

  const state: AgentState = {
    turns: existingTurns ? [...existingTurns] : [],
    totalTokensUsed: 0,
    status: 'running',
    goalState,
  };

  // Track last action result for semantic signals
  // If resuming, get info from the last turn
  let lastActionSuccess = true;
  let lastActionType = '';
  if (existingTurns && existingTurns.length > 0) {
    const lastTurn = existingTurns[existingTurns.length - 1];
    if (lastTurn.observation) {
      lastActionSuccess = lastTurn.observation.success;
      lastActionType = lastTurn.observation.action.type;
    } else if (lastTurn.response.action) {
      // Last turn was waiting for user - assume they executed successfully
      lastActionType = lastTurn.response.action.type;
      lastActionSuccess = true;
    }
  }

  while (state.status === 'running') {
    // Check cancellation
    if (callbacks.isCancelled()) {
      state.status = 'cancelled';
      break;
    }

    // Check max turns
    if (state.turns.length >= MAX_TURNS) {
      state.status = 'max_turns_reached';
      break;
    }

    // Get FRESH narrative context each turn (this includes updated validation state)
    const currentNarrativeContext = getNarrativeContext();

    // Build semantic signals summary from last turn
    const semanticSignals = buildSemanticSignalsSummary(state.turns, lastActionSuccess, lastActionType);

    // Call the agent API
    const response = await fetch('/api/chat/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        dslCode: executionContext.getCurrentCode(),
        narrativeContext: currentNarrativeContext,
        goalState: formatGoalStateForAPI(state.goalState),
        turnHistory: formatTurnHistory(state.turns),
        semanticSignals,
      }),
    });

    if (!response.ok) {
      state.status = 'error';
      state.errorMessage = `API error: ${response.status}`;
      break;
    }

    const agentResponse = await response.json() as AgentTurn['response'];

    // Create turn record
    const turn: AgentTurn = {
      turnNumber: state.turns.length + 1,
      response: agentResponse,
      observation: null,
    };

    // Execute action based on safety level:
    // - Safe actions (RUN_SIMULATION, SET_INPUT): auto-execute
    // - Code-modifying actions (SHOW_DIFF, INSERT_NODE): wait for user approval
    if (agentResponse.action) {
      const actionType = agentResponse.action.type;
      const isSafeAction = actionType === 'RUN_SIMULATION' || actionType === 'SET_INPUT';

      if (isSafeAction) {
        // Auto-execute safe actions
        // IMPORTANT: Don't pass sourceCodeHash - it becomes stale after SHOW_DIFF
        // In agent mode, code changes are intentional, so bypass staleness check
        try {
          const { executeAction } = await import('../actions/action-executor');
          const agentContext = { ...executionContext, sourceCodeHash: undefined };
          const result = await executeAction(agentResponse.action, agentContext);

          lastActionSuccess = result.success;
          lastActionType = actionType;

          turn.observation = {
            action: agentResponse.action,
            success: result.success,
            error: result.reason,
            validationBefore: { errors: 0, warnings: 0, canSimulate: true },
            validationAfter: { errors: 0, warnings: 0, canSimulate: true },
            signals: {
              regression: { isRegression: false, errorDelta: 0, blockingStatusChanged: false, severity: 'improvement' },
              structural: { changeType: 'minor', nodeCountDelta: 0, depthChange: 0, registersAdded: 0 },
              complexity: { score: 0, rating: 'simple' },
              behavioral: { verificationsRun: 0, passed: 0, failed: 0, mismatches: [] },
            },
          };

          // Wait for React to update
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          lastActionSuccess = false;
          lastActionType = actionType;
          turn.observation = {
            action: agentResponse.action,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            validationBefore: { errors: 0, warnings: 0, canSimulate: true },
            validationAfter: { errors: 0, warnings: 0, canSimulate: true },
            signals: {
              regression: { isRegression: false, errorDelta: 0, blockingStatusChanged: false, severity: 'improvement' },
              structural: { changeType: 'minor', nodeCountDelta: 0, depthChange: 0, registersAdded: 0 },
              complexity: { score: 0, rating: 'simple' },
              behavioral: { verificationsRun: 0, passed: 0, failed: 0, mismatches: [] },
            },
          };
        }
      } else {
        // Code-modifying actions (SHOW_DIFF, INSERT_NODE): pause for user approval
        // The action will be shown to the user via the message
        // User executes it manually, then sends "continue" or another message to proceed
        lastActionType = actionType;

        // Add this turn and pause the loop
        state.turns.push(turn);
        callbacks.onTurnComplete(turn);

        // Update plan before pausing
        if (agentResponse.plan) {
          state.currentPlan = agentResponse.plan;
        }

        // Set status to waiting and break out of loop
        state.status = 'waiting_for_user';
        break;
      }
    }

    // Update plan
    if (agentResponse.plan) {
      state.currentPlan = agentResponse.plan;
    }

    state.turns.push(turn);
    callbacks.onTurnComplete(turn);

    // Check completion - trust LLM's done signal since it has full context now
    if (agentResponse.done) {
      state.status = 'completed';
    }
  }

  return state;
}

/**
 * Build a summary of semantic signals from turn history.
 */
function buildSemanticSignalsSummary(turns: AgentTurn[], lastSuccess: boolean, lastAction: string): string {
  if (turns.length === 0) {
    return '(First turn - no previous actions)';
  }

  const lines: string[] = [];

  // Summary of all turns
  const successCount = turns.filter(t => t.observation?.success).length;
  const failCount = turns.filter(t => t.observation && !t.observation.success).length;
  const diffCount = turns.filter(t => t.observation?.action.type === 'SHOW_DIFF').length;
  const simCount = turns.filter(t => t.observation?.action.type === 'RUN_SIMULATION').length;

  lines.push(`## Turn Summary`);
  lines.push(`Total turns: ${turns.length}`);
  lines.push(`Successful actions: ${successCount}`);
  lines.push(`Failed actions: ${failCount}`);
  lines.push(`Code changes applied: ${diffCount}`);
  lines.push(`Simulations run: ${simCount}`);
  lines.push('');

  // Last action result with guidance
  if (lastAction) {
    lines.push(`## Last Action Result`);
    lines.push(`Type: ${lastAction}`);
    lines.push(`Result: ${lastSuccess ? 'SUCCESS' : 'FAILED'}`);

    if (lastAction === 'SHOW_DIFF' && lastSuccess) {
      lines.push(`→ Code was applied. Check "Circuit Status" in Context above for validation result.`);
    } else if (lastAction === 'RUN_SIMULATION' && lastSuccess) {
      lines.push(`→ Simulation complete. Check "Current Signal Values" in Context above to verify behavior.`);
    }
    lines.push('');
  }

  // Recent turn details
  lines.push(`## Recent Turns`);
  for (const turn of turns.slice(-3)) {
    const obs = turn.observation;
    if (obs) {
      const status = obs.success ? '✓' : '✗';
      lines.push(`Turn ${turn.turnNumber}: ${obs.action.type} ${status}${obs.error ? ` (${obs.error})` : ''}`);
    } else {
      lines.push(`Turn ${turn.turnNumber}: (reasoning only)`);
    }
  }

  // Guidance for completion check
  lines.push('');
  lines.push(`## Completion Check`);
  lines.push(`To verify if your goal is complete:`);
  lines.push(`1. Check "Circuit Status" - should say "valid and ready"`);
  lines.push(`2. Check "Current Signal Values" - verify behavior matches goal`);
  lines.push(`3. If both are satisfied, set done=true`);

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function formatGoalStateForAPI(goalState: GoalState): string {
  const lines = [
    `Goal: ${goalState.description}`,
    '',
    'Criteria:',
  ];

  for (const criterion of goalState.successCriteria) {
    const status = goalState.currentStatus.find((s) => s.criterionId === criterion.id);
    const mark = status?.satisfied ? '[x]' : '[ ]';
    lines.push(`  ${mark} ${criterion.description}`);
  }

  return lines.join('\n');
}

function formatTurnHistory(turns: AgentTurn[]): string {
  if (turns.length === 0) {
    return '(First turn)';
  }

  return turns
    .slice(-5) // Last 5 turns
    .map((t) => {
      const action = t.observation?.action.type ?? 'none';
      const result = t.observation?.success ? '✓' : '✗';
      return `Turn ${t.turnNumber}: ${action} ${result}`;
    })
    .join('\n');
}
