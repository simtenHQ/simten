/**
 * ChatPanel Component
 *
 * Main chat container with Sheet integration.
 * Orchestrates chat flow: messages, streaming, actions.
 */

'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bot, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CodeDiffView } from './CodeDiffView';
import { ConfirmationModal } from './ConfirmationModal';
import { AgentProgress } from './AgentProgress';
import { AgentStatusLine } from './AgentStatusLine';
import { useChatStore } from '../stores/chat-store';
import { sendMessage } from '../streaming';
import { executeAction, applyDiff, buildConfirmationRequest, type ActionExecutionContext } from '../actions';
import { useAgentLoop } from '../hooks/useAgentLoop';
import type { AssistantAction } from '../types';
import type { ShowDiffAction } from '@/lib/baml_client/baml_client';
import type { ConfirmationRequest } from '../actions/confirmation-flow';

interface ChatPanelProps {
  /** Get current DSL code from editor */
  getCurrentCode: () => string;
  /** Set code in the editor */
  setCode: (code: string) => void;
  /** Set an input component's value (Switch, Button, Input) */
  setInput: (nodeName: string, value: number) => void;
  /** Run simulation */
  runSimulation: (cycles: number, stimuli?: Record<string, number>) => Promise<void>;
  /** Insert a node */
  insertNode: (componentRef: string, label?: string, connectFrom?: string, connectTo?: string) => void;
  /** Narrative context for LLM */
  narrativeContext: string;
  /** Source code hash for staleness detection */
  sourceCodeHash: string;
  /** Highlight nodes on canvas */
  highlightNodes?: (nodeIds: string[]) => void;
}

export function ChatPanel({
  getCurrentCode,
  setCode,
  setInput,
  runSimulation,
  insertNode,
  narrativeContext,
  sourceCodeHash,
  highlightNodes,
}: ChatPanelProps) {
  const {
    isOpen,
    setOpen,
    messages,
    streaming,
    sessionId,
    actionStatus,
    addUserMessage,
    startStreaming,
    updateStreamingMessage,
    finishStreaming,
    setStreamingError,
    setActionStatus,
    getConversationHistory,
  } = useChatStore();

  // Local state
  const [showDiffAction, setShowDiffAction] = useState<ShowDiffAction | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const confirmationResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  // Build execution context for agent loop
  const executionContext: ActionExecutionContext = useMemo(() => ({
    sessionId,
    getCurrentCode,
    sourceCodeHash,
    setCode,
    setInput,
    runSimulation,
    insertNode,
    onStatusChange: setActionStatus,
    requestConfirmation: async (confirmAction: AssistantAction) => {
      return new Promise((resolve) => {
        const request = buildConfirmationRequest(confirmAction);
        setConfirmationRequest(request);
        confirmationResolveRef.current = resolve;
      });
    },
  }), [sessionId, getCurrentCode, sourceCodeHash, setCode, setInput, runSimulation, insertNode, setActionStatus]);

  // Create getter for narrative context (called fresh each turn)
  // Uses a ref to always get the latest prop value without stale closures
  const narrativeContextRef = useRef(narrativeContext);
  narrativeContextRef.current = narrativeContext;
  const getNarrativeContext = useCallback(() => narrativeContextRef.current, []);

  // Agent loop hook
  const {
    startLoop,
    cancelLoop,
    isRunning: isAgentRunning,
    agentState,
    isAgentMode,
    setAgentMode,
  } = useAgentLoop({
    executionContext,
    getNarrativeContext,
    sourceCodeHash,
  });

  // Handle sending a message
  const handleSend = useCallback(
    async (content: string) => {
      // If agent mode is enabled, use the agent loop
      if (isAgentMode) {
        await startLoop(content);
        return;
      }

      // Standard one-shot mode
      // Add user message
      addUserMessage(content);

      // Start streaming assistant response
      const messageId = `msg-${Date.now()}`;
      startStreaming(messageId);

      // Get current context
      const dslCode = getCurrentCode();
      const history = getConversationHistory();

      // Send to API
      await sendMessage(
        {
          userMessage: content,
          dslCode,
          compactContext: narrativeContext,
          conversationHistory: history,
        },
        {
          onMessageUpdate: (partial) => {
            updateStreamingMessage(partial);
          },
          onComplete: (result) => {
            finishStreaming(
              result.message,
              result.actions,
              result.suggestedFollowUps
            );

            if (result.streamingError && result.error) {
              console.warn('[Chat] Streaming completed with error:', result.error);
            }
          },
          onError: (error) => {
            setStreamingError(error);
          },
        }
      );
    },
    [
      isAgentMode,
      startLoop,
      addUserMessage,
      startStreaming,
      updateStreamingMessage,
      finishStreaming,
      setStreamingError,
      getCurrentCode,
      getConversationHistory,
      narrativeContext,
    ]
  );

  // Handle action execution
  const handleExecuteAction = useCallback(
    async (action: AssistantAction) => {
      const context: ActionExecutionContext = {
        sessionId,
        getCurrentCode,
        sourceCodeHash,
        setCode,
        setInput,
        runSimulation,
        insertNode,
        onStatusChange: setActionStatus,
        requestConfirmation: async (confirmAction: AssistantAction) => {
          return new Promise((resolve) => {
            const request = buildConfirmationRequest(confirmAction);
            setConfirmationRequest(request);
            confirmationResolveRef.current = resolve;
          });
        },
      };

      await executeAction(action, context);

      // Auto-continue agent loop if waiting for user
      if (agentState?.status === 'waiting_for_user') {
        // Small delay to let the action effects propagate
        setTimeout(() => {
          startLoop('continue');
        }, 200);
      }
    },
    [
      sessionId,
      getCurrentCode,
      sourceCodeHash,
      setCode,
      setInput,
      runSimulation,
      insertNode,
      setActionStatus,
      agentState,
      startLoop,
    ]
  );

  // Handle showing diff
  const handleShowDiff = useCallback((action: AssistantAction) => {
    if (action.type === 'SHOW_DIFF') {
      setShowDiffAction(action);
    }
  }, []);

  // Handle applying diff
  const handleApplyDiff = useCallback(() => {
    if (showDiffAction) {
      applyDiff(showDiffAction, setCode, getCurrentCode);
      setShowDiffAction(null);

      // Auto-continue agent loop if waiting for user
      if (agentState?.status === 'waiting_for_user') {
        // Small delay to let the code change propagate
        setTimeout(() => {
          startLoop('continue');
        }, 200);
      }
    }
  }, [showDiffAction, setCode, getCurrentCode, agentState, startLoop]);

  // Handle confirmation response
  const handleConfirm = useCallback(() => {
    confirmationResolveRef.current?.(true);
    confirmationResolveRef.current = null;
    setConfirmationRequest(null);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    confirmationResolveRef.current?.(false);
    confirmationResolveRef.current = null;
    setConfirmationRequest(null);
  }, []);

  // Handle node mentions for highlighting
  const handleNodeMention = useCallback(
    (nodeIds: string[]) => {
      highlightNodes?.(nodeIds);
    },
    [highlightNodes]
  );

  return (
    <>
      {/* Chat Sheet */}
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[420px] p-0 flex flex-col"
          showCloseButton={false}
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <SheetTitle>Hardware Assistant</SheetTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Agent Mode Toggle */}
              <Button
                variant={isAgentMode ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAgentMode(!isAgentMode)}
                disabled={isAgentRunning}
              >
                <Zap className={`h-3 w-3 ${isAgentMode ? 'text-yellow-300' : ''}`} />
                Agent
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Agent Status Line (compact Claude Code-style indicator) */}
          {agentState && (isAgentRunning || agentState.status === 'waiting_for_user') && (
            <AgentStatusLine
              state={agentState}
              isRunning={isAgentRunning}
              onCancel={cancelLoop}
            />
          )}

          {/* Messages */}
          <MessageList
            messages={messages}
            actionStatuses={actionStatus}
            onExecuteAction={handleExecuteAction}
            onShowDiff={handleShowDiff}
            onNodeMention={handleNodeMention}
          />

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            disabled={streaming.isStreaming || isAgentRunning}
            placeholder={isAgentMode ? 'Describe your goal (agent will iterate)...' : undefined}
          />
        </SheetContent>
      </Sheet>

      {/* Diff View Modal */}
      {showDiffAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl">
            <CodeDiffView
              action={showDiffAction}
              onApply={handleApplyDiff}
              onDismiss={() => setShowDiffAction(null)}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationRequest && (
        <ConfirmationModal
          request={confirmationRequest}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
}
