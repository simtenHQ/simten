/**
 * useTutorFlow Hook
 *
 * Lightweight continuation hook for the tutor interaction model.
 * Wraps sendMessage with auto-continuation: after each LLM response,
 * safe actions auto-execute, and if shouldContinue is true (up to 3 times),
 * a follow-up message is sent automatically.
 *
 * NOT an agent loop. No goal state, no semantic signals, no plan tracking.
 */

import { useCallback, useRef, useState } from 'react';
import { useChatStore } from '../stores/chat-store';
import { sendMessage } from '../streaming';
import { executeAction } from '../actions/action-executor';
import type { ActionExecutionContext } from '../actions/action-executor';
import type { AssistantAction } from '../types';
import type { StreamResult } from '../streaming';

// ============================================================================
// Constants
// ============================================================================

const MAX_CONTINUATIONS = 3;

// Safe actions that auto-execute without student intervention
const SAFE_ACTIONS = new Set(['SET_INPUT', 'RUN_SIMULATION', 'VERIFY_ASSERTION']);

/** Check if the editor has only the default example or is empty */
function isFreshEditor(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return true;
  return trimmed.startsWith('// Example: NOT Gate');
}

// ============================================================================
// Types
// ============================================================================

export interface UseTutorFlowOptions {
  executionContext: ActionExecutionContext;
  getNarrativeContext: () => string;
  getCurrentCode: () => string;
  getConversationHistory: () => string[];
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

  const [isContinuing, setIsContinuing] = useState(false);
  const [continuationCount, setContinuationCount] = useState(0);

  const cancelledRef = useRef(false);
  const diffAppliedResolverRef = useRef<(() => void) | null>(null);

  const {
    addUserMessage,
    startStreaming,
    updateStreamingMessage,
    finishStreaming,
    setStreamingError,
  } = useChatStore();

  /**
   * Wait for the student to apply a pending SHOW_DIFF.
   * Returns a promise that resolves when onDiffApplied() is called.
   */
  const waitForDiffApplied = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      diffAppliedResolverRef.current = resolve;
    });
  }, []);

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
   * Execute safe actions from a response. Returns true if any SHOW_DIFF
   * was present (meaning we need to wait for student to apply it).
   */
  const executeSafeActions = useCallback(
    async (actions: AssistantAction[]): Promise<boolean> => {
      let hasDiff = false;

      for (const action of actions) {
        if (SAFE_ACTIONS.has(action.type)) {
          await executeAction(action, { ...executionContext, sourceCodeHash: undefined });
          // Small delay to let React propagate state changes
          await new Promise((r) => setTimeout(r, 150));
        } else if (action.type === 'SHOW_DIFF' || action.type === 'GENERATE_HARNESS') {
          if (action.type === 'SHOW_DIFF' && isFreshEditor(getCurrentCode())) {
            // Auto-apply: skip diff review for fresh/default editor
            const showDiff = action as { suggestedCode: string };
            executionContext.setCode(showDiff.suggestedCode);
            await new Promise((r) => setTimeout(r, 300)); // Let compile propagate
          } else {
            hasDiff = true;
          }
        }
      }

      return hasDiff;
    },
    [executionContext, getCurrentCode]
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
            onComplete: (result) => {
              finishStreaming(result.message, result.actions, result.suggestedFollowUps);
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
    [startStreaming, updateStreamingMessage, finishStreaming, setStreamingError, getCurrentCode, getNarrativeContext, getConversationHistory]
  );

  /**
   * Main entry point: send a student message and handle auto-continuation.
   */
  const send = useCallback(
    async (content: string) => {
      cancelledRef.current = false;
      setContinuationCount(0);

      // Add the student's message
      addUserMessage(content);

      // First LLM call
      let result: StreamResult;
      try {
        result = await callLLM(content);
      } catch {
        return;
      }

      // Auto-execute safe actions
      const hasDiff = await executeSafeActions(result.actions);

      // Continuation loop
      let count = 0;
      while (
        result.shouldContinue &&
        count < MAX_CONTINUATIONS &&
        !cancelledRef.current
      ) {
        // If there's a diff, wait for student to apply it before continuing
        if (hasDiff) {
          setIsContinuing(true);
          await waitForDiffApplied();
          if (cancelledRef.current) break;
          // Small delay for code to propagate after apply
          await new Promise((r) => setTimeout(r, 200));
        }

        count++;
        setContinuationCount(count);
        setIsContinuing(true);

        // Follow-up LLM call with continuation context
        try {
          result = await callLLM('(auto-continue)');
        } catch {
          break;
        }

        // Auto-execute safe actions from continuation
        const contHasDiff = await executeSafeActions(result.actions);

        // If this continuation has a diff and we want to continue further,
        // we'll wait at the top of the next iteration
        if (contHasDiff && result.shouldContinue && count < MAX_CONTINUATIONS) {
          setIsContinuing(true);
          await waitForDiffApplied();
          if (cancelledRef.current) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      setIsContinuing(false);
      setContinuationCount(0);
    },
    [addUserMessage, callLLM, executeSafeActions, waitForDiffApplied]
  );

  const cancelContinuation = useCallback(() => {
    cancelledRef.current = true;
    setIsContinuing(false);
    setContinuationCount(0);
    // Resolve any pending diff wait so the loop exits
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
