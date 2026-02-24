/**
 * useAgentLoop Hook
 *
 * Simplified: the server-side tool_use loop now handles multi-turn
 * agent behavior. This hook provides backward-compatible interface
 * for agent mode state management.
 */

import { useCallback } from 'react';
import { useChatStore } from '../stores/chat-store';
import type { ActionExecutionContext } from '../actions/action-executor';
import type { AgentState } from '../agent/types';

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseAgentLoopOptions {
  executionContext: ActionExecutionContext;
  getNarrativeContext: () => string;
  sourceCodeHash: string;
}

export interface UseAgentLoopResult {
  startLoop: (userMessage: string) => Promise<AgentState>;
  cancelLoop: () => void;
  isRunning: boolean;
  agentState: AgentState | null;
  isAgentMode: boolean;
  setAgentMode: (enabled: boolean) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAgentLoop(options: UseAgentLoopOptions): UseAgentLoopResult {
  const _options = options; // eslint-disable-line @typescript-eslint/no-unused-vars

  const isAgentMode = useChatStore((s) => s.isAgentMode);
  const isAgentRunning = useChatStore((s) => s.isAgentRunning);
  const agentState = useChatStore((s) => s.agentState);
  const setAgentMode = useChatStore((s) => s.setAgentMode);

  // With the server-side tool_use loop, the agent loop is handled
  // entirely on the server. This stub returns a no-op.
  const startLoop = useCallback(
    async (_userMessage: string): Promise<AgentState> => {
      return {
        turns: [],
        totalTokensUsed: 0,
        status: 'completed',
        goalState: {
          description: '',
          successCriteria: [],
          currentStatus: [],
        },
      };
    },
    []
  );

  const cancelLoop = useCallback(() => {
    // No-op since server handles the loop
  }, []);

  return {
    startLoop,
    cancelLoop,
    isRunning: isAgentRunning,
    agentState,
    isAgentMode,
    setAgentMode,
  };
}
