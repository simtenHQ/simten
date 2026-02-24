/**
 * useTutorFlow Hook
 *
 * Wraps sendMessage with auto-execution of safe actions from tool_use responses.
 * The server-side tool_use loop handles multi-turn analysis (check, simulate, etc.).
 * Client-side we just execute the deferred editor actions.
 */

import { useCallback, useRef, useState } from 'react';
import { useChatStore } from '../stores/chat-store';
import { sendMessage } from '../streaming';
import { executeAction } from '../actions/action-executor';
import { SAFE_ACTION_TYPES } from '../constants';
import type { ActionExecutionContext } from '../actions/action-executor';
import type { AssistantAction, ToolCallInfo } from '../types';
import type { StreamResult } from '../streaming';

// ============================================================================
// Types
// ============================================================================

export interface UseTutorFlowOptions {
  executionContext: ActionExecutionContext;
  getNarrativeContext: () => string;
  getCurrentCode: () => string;
  getConversationHistory: () => Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface UseTutorFlowResult {
  sendMessage: (content: string) => Promise<void>;
  cancelContinuation: () => void;
  onDiffApplied: () => void;
  isContinuing: boolean;
  continuationCount: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useTutorFlow(options: UseTutorFlowOptions): UseTutorFlowResult {
  const { executionContext, getNarrativeContext, getCurrentCode, getConversationHistory } = options;

  const executionContextRef = useRef(executionContext);
  executionContextRef.current = executionContext;

  const [isContinuing, setIsContinuing] = useState(false);
  const [continuationCount] = useState(0);

  const cancelledRef = useRef(false);
  const diffAppliedResolverRef = useRef<(() => void) | null>(null);

  const {
    addUserMessage,
    startStreaming,
    updateStreamingMessage,
    finishStreaming,
    setStreamingError,
    addToolCall,
  } = useChatStore();

  /**
   * Called by ChatPanel when the student clicks Apply on a diff.
   */
  const onDiffApplied = useCallback(() => {
    const resolver = diffAppliedResolverRef.current;
    if (resolver) {
      diffAppliedResolverRef.current = null;
      resolver();
    }
  }, []);

  /**
   * Execute deferred editor actions from the server response.
   */
  const executeEditorActions = useCallback(
    async (actions: AssistantAction[]): Promise<void> => {
      for (const action of actions) {
        if (SAFE_ACTION_TYPES.has(action.type)) {
          await executeAction(action, { ...executionContextRef.current, sourceCodeHash: undefined });
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    },
    [getCurrentCode]
  );

  /**
   * Send a single LLM call and return the result.
   */
  const callLLM = useCallback(
    (userMessage: string): Promise<StreamResult> => {
      return new Promise((resolve, reject) => {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        startStreaming(messageId);

        sendMessage(
          {
            userMessage,
            dslCode: getCurrentCode(),
            compactContext: getNarrativeContext(),
            conversationHistory: getConversationHistory(),
          },
          {
            onMessageUpdate: (partial) => {
              updateStreamingMessage(partial);
            },
            onToolCall: (toolCall: ToolCallInfo) => {
              addToolCall(messageId, toolCall);
            },
            onComplete: (result) => {
              finishStreaming(result.message, result.actions, result.suggestedFollowUps, result.toolCalls, result.usage);
              resolve(result);
            },
            onError: (error) => {
              setStreamingError(error);
              reject(new Error(error));
            },
          }
        );
      });
    },
    [startStreaming, updateStreamingMessage, finishStreaming, setStreamingError, addToolCall, getCurrentCode, getNarrativeContext, getConversationHistory]
  );

  /**
   * Main entry point: send a student message.
   */
  const send = useCallback(
    async (content: string) => {
      cancelledRef.current = false;

      addUserMessage(content);

      let result: StreamResult;
      try {
        result = await callLLM(content);
      } catch {
        return;
      }

      // Execute deferred editor actions from the server
      await executeEditorActions(result.actions);

      setIsContinuing(false);
    },
    [addUserMessage, callLLM, executeEditorActions]
  );

  const cancelContinuation = useCallback(() => {
    cancelledRef.current = true;
    setIsContinuing(false);
    const resolver = diffAppliedResolverRef.current;
    if (resolver) {
      diffAppliedResolverRef.current = null;
      resolver();
    }
  }, []);

  return {
    sendMessage: send,
    cancelContinuation,
    onDiffApplied,
    isContinuing,
    continuationCount,
  };
}
