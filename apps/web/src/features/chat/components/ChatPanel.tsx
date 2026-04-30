/**
 * ChatPanel Component
 *
 * Sidebar chat surface. Messages and assistant turns arrive over the MCP
 * channel from a connected Claude Code session; the panel is a passive view
 * with an input that forwards user messages back over MCP. When MCP is not
 * connected the input is replaced by a setup CTA.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bot, X, Loader2, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { CodeDiffView } from './CodeDiffView';
import { ConfirmationModal } from './ConfirmationModal';
import { useChatStore } from '../stores/chat-store';
import { executeAction, applyDiff, buildConfirmationRequest, type ActionExecutionContext } from '../actions';
import { useSandboxContext } from '@simten/ui/sandbox';
import type { AssistantAction, ShowDiffAction } from '../types';
import type { ConfirmationRequest } from '../actions/confirmation-flow';

interface ChatPanelProps {
  /** Get current circuit code from editor */
  getCurrentCode: () => string;
  /** Set code in the editor */
  setCode: (code: string) => void;
  /** Set an input component's value (Switch, Button, Input) */
  setNode: (nodeName: string, value: number) => void;
  /** Run simulation */
  runSimulation: (cycles: number, stimuli?: Record<string, number>) => Promise<void>;
  /** Insert a node */
  insertNode: (componentRef: string, label?: string, connectFrom?: string, connectTo?: string) => void;
  /** Source code hash for staleness detection */
  sourceCodeHash: string;
  /** Highlight nodes on canvas */
  highlightNodes?: (nodeIds: string[]) => void;
  /** Send message via MCP channel. Provided only when MCP is connected. */
  onSendToChannel?: (text: string, meta?: Record<string, string>) => void;
  /** Whether Claude is thinking (driven by MCP channel) */
  channelThinking?: boolean;
  /** Set channel thinking state */
  setChannelThinking?: (v: boolean) => void;
  /** MCP connection status — drives the connect-to-Claude CTA when not connected. */
  mcpStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

const MCP_INSTALL_COMMAND = 'claude mcp add simten npx @simten/mcp';

function McpConnectCTA({ status }: { status: ChatPanelProps['mcpStatus'] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(MCP_INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-border/60 p-4 space-y-3 bg-muted/20">
      {status === 'reconnecting' ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Reconnecting to Claude Code…</span>
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">Connect Claude Code</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drive Simten from Claude Code via MCP. Run this once, then start a new Claude Code session.
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="w-full inline-flex items-center justify-between gap-3 bg-muted rounded-md border border-border px-3 py-2 hover:border-foreground/30 transition-colors group"
          >
            <code className="font-mono text-[12px] text-foreground/80 truncate">
              <span className="text-muted-foreground select-none">$ </span>
              {MCP_INSTALL_COMMAND}
            </code>
            <span className="shrink-0 text-muted-foreground/70 group-hover:text-muted-foreground">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </span>
          </button>
        </>
      )}
    </div>
  );
}

export function ChatPanel({
  getCurrentCode,
  setCode,
  setNode,
  runSimulation,
  insertNode,
  sourceCodeHash,
  highlightNodes,
  onSendToChannel,
  channelThinking,
  setChannelThinking,
  mcpStatus,
}: ChatPanelProps) {
  const isConnected = mcpStatus === 'connected';
  const {
    isOpen,
    setOpen,
    messages,
    sessionId,
    actionStatus,
    setActionStatus,
    sessionUsage,
    addUserMessage,
  } = useChatStore();

  const sandbox = useSandboxContext();

  const [showDiffAction, setShowDiffAction] = useState<ShowDiffAction | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const confirmationResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const handleSend = useCallback(
    async (content: string) => {
      if (!onSendToChannel) return;
      addUserMessage(content);
      setChannelThinking?.(true);
      onSendToChannel(content);
    },
    [onSendToChannel, addUserMessage, setChannelThinking]
  );

  // Manual action execution (clicked from ActionCard)
  const handleExecuteAction = useCallback(
    async (action: AssistantAction) => {
      const context: ActionExecutionContext = {
        sessionId,
        getCurrentCode,
        sourceCodeHash,
        setCode,
        setNode,
        runSimulation,
        insertNode,
        compile: sandbox.compile,
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
      setNode,
      runSimulation,
      insertNode,
      sandbox.compile,
      setActionStatus,
    ]
  );

  const handleShowDiff = useCallback((action: AssistantAction) => {
    if (action.type === 'SHOW_DIFF') {
      setShowDiffAction(action);
    }
  }, []);

  const handleApplyDiff = useCallback(() => {
    if (showDiffAction) {
      applyDiff(showDiffAction, setCode, getCurrentCode);
      setShowDiffAction(null);
    }
  }, [showDiffAction, setCode, getCurrentCode]);

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

  const handleNodeMention = useCallback(
    (nodeIds: string[]) => {
      highlightNodes?.(nodeIds);
    },
    [highlightNodes]
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[420px] p-0 flex flex-col"
          showCloseButton={false}
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <SheetTitle>Assistant</SheetTitle>
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

          <MessageList
            messages={messages}
            actionStatuses={actionStatus}
            onExecuteAction={handleExecuteAction}
            onShowDiff={handleShowDiff}
            onNodeMention={handleNodeMention}
            onSendStarter={isConnected ? handleSend : undefined}
            channelThinking={channelThinking}
          />

          {sessionUsage.inputTokens > 0 && (
            <div className="px-4 py-1.5 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {(sessionUsage.inputTokens + sessionUsage.outputTokens).toLocaleString()} tokens
              </span>
              <span>~${sessionUsage.estimatedCost.toFixed(4)}</span>
            </div>
          )}

          {isConnected ? (
            <ChatInput
              onSend={handleSend}
              disabled={!!channelThinking}
            />
          ) : (
            <McpConnectCTA status={mcpStatus} />
          )}
        </SheetContent>
      </Sheet>

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
