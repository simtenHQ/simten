/**
 * ChatPanel Component
 *
 * Main chat container with Sheet integration.
 * Orchestrates chat flow: messages, streaming, actions.
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CodeDiffView } from './CodeDiffView';
import { ConfirmationModal } from './ConfirmationModal';
import { useChatStore } from '../stores/chat-store';
import { sendMessage } from '../streaming';
import { executeAction, applyDiff, buildConfirmationRequest, type ActionExecutionContext } from '../actions';
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

  // Handle sending a message
  const handleSend = useCallback(
    async (content: string) => {
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
      applyDiff(showDiffAction, setCode);
      setShowDiffAction(null);
    }
  }, [showDiffAction, setCode]);

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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

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
            disabled={streaming.isStreaming}
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
