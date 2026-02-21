/**
 * ChatPanel Component
 *
 * Main chat container with Sheet integration.
 * Orchestrates tutor flow: messages, streaming, actions, auto-continuation.
 */

'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bot, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CodeDiffView } from './CodeDiffView';
import { ConfirmationModal } from './ConfirmationModal';
import { useChatStore } from '../stores/chat-store';
import { executeAction, applyDiff, buildConfirmationRequest, type ActionExecutionContext } from '../actions';
import { useTutorFlow } from '../hooks/useTutorFlow';
import { generateHarnessAppended } from '@/features/dsl';
import type { AssistantAction } from '../types';
import type { ShowDiffAction, GenerateHarnessAction } from '@/lib/baml_client/baml_client';
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
    setActionStatus,
    getConversationHistory,
  } = useChatStore();

  // Local state
  const [showDiffAction, setShowDiffAction] = useState<ShowDiffAction | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const confirmationResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  // Create getter for narrative context (called fresh each turn)
  // Uses a ref to always get the latest prop value without stale closures
  const narrativeContextRef = useRef(narrativeContext);
  narrativeContextRef.current = narrativeContext;
  const getNarrativeContext = useCallback(() => narrativeContextRef.current, []);

  // Build execution context for tutor flow
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

  // Tutor flow hook
  const {
    sendMessage: tutorSendMessage,
    cancelContinuation,
    onDiffApplied,
    isContinuing,
    continuationCount,
  } = useTutorFlow({
    executionContext,
    getNarrativeContext,
    getCurrentCode,
    getConversationHistory,
  });

  // Handle sending a message
  const handleSend = useCallback(
    async (content: string) => {
      await tutorSendMessage(content);
    },
    [tutorSendMessage]
  );

  // Handle action execution (manual click from ActionCard)
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

  // Handle showing diff (also handles GENERATE_HARNESS)
  const handleShowDiff = useCallback((action: AssistantAction) => {
    if (action.type === 'SHOW_DIFF') {
      setShowDiffAction(action);
    } else if (action.type === 'GENERATE_HARNESS') {
      // Generate harness deterministically and show as diff
      const currentCode = getCurrentCode();
      const combinedCode = generateHarnessAppended(currentCode);

      if (combinedCode === currentCode) {
        console.warn('[ChatPanel] No harness generated - circuit may already have interactive components');
        return;
      }

      // Create a synthetic SHOW_DIFF action
      const syntheticDiff: ShowDiffAction = {
        type: 'SHOW_DIFF',
        actionId: action.actionId ?? `harness-${Date.now()}`,
        originalCode: currentCode,
        suggestedCode: combinedCode,
        explanation: `Generated test harness for ${(action as GenerateHarnessAction).circuitName ?? 'circuit'}. Adds interactive controls (Switch/Input) for inputs and displays (LED/Display) for outputs.`,
      };

      setShowDiffAction(syntheticDiff);
    }
  }, [getCurrentCode]);

  // Handle applying diff
  const handleApplyDiff = useCallback(() => {
    if (showDiffAction) {
      applyDiff(showDiffAction, setCode, getCurrentCode);
      setShowDiffAction(null);

      // Signal the tutor flow that a diff was applied
      onDiffApplied();
    }
  }, [showDiffAction, setCode, getCurrentCode, onDiffApplied]);

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
              <SheetTitle>Hardware Tutor</SheetTitle>
            </div>
            <div className="flex items-center gap-2">
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

          {/* Continuation indicator */}
          {isContinuing && (
            <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Continuing... ({continuationCount}/3)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={cancelContinuation}
              >
                Stop
              </Button>
            </div>
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
            disabled={streaming.isStreaming || isContinuing}
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
