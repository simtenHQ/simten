/**
 * MessageList Component
 *
 * Scrollable list of chat messages with actions and tool call cards.
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ActionCard } from './ActionCard';
import { ToolCallCard } from './ToolCallCard';
import type { ChatMessage, AssistantAction, ActionExecutionStatus } from '../types';

const STARTER_PROMPTS = [
  'Build me a 4-bit counter',
  'Create an SR latch and show me how it works',
  'Make a 2-to-1 multiplexer',
];

interface MessageListProps {
  messages: ChatMessage[];
  actionStatuses: Map<string, ActionExecutionStatus>;
  onExecuteAction: (action: AssistantAction) => void;
  onShowDiff: (action: AssistantAction) => void;
  onNodeMention?: (nodeIds: string[]) => void;
  onSendStarter?: (message: string) => void;
  channelThinking?: boolean;
}

export function MessageList({
  messages,
  actionStatuses,
  onExecuteAction,
  onShowDiff,
  onNodeMention,
  onSendStarter,
  channelThinking,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or thinking state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, channelThinking]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <Bot className="h-10 w-10 text-blue-500" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Describe a circuit and I&apos;ll build it</p>
          {onSendStarter && (
            <p className="text-xs text-gray-400 mt-1">Or try one of these:</p>
          )}
        </div>
        {onSendStarter && (
          <div className="flex flex-col gap-2 w-full max-w-[280px]">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSendStarter(prompt)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="space-y-3">
          {/* Message bubble */}
          <MessageBubble message={message} onNodeMention={onNodeMention} />

          {/* Tool calls (only for assistant messages) */}
          {message.role === 'assistant' &&
            message.toolCalls &&
            message.toolCalls.length > 0 && (
              <div className="ml-0 space-y-1">
                {message.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}

          {/* Actions (only for assistant messages) */}
          {message.role === 'assistant' &&
            message.actions &&
            message.actions.length > 0 && (
              <div className="ml-0 space-y-2">
                {message.actions.map((action, i) => (
                  <ActionCard
                    key={action.actionId ?? i}
                    action={action}
                    status={actionStatuses.get(action.actionId ?? '')}
                    onExecute={onExecuteAction}
                    onShowDiff={onShowDiff}
                  />
                ))}
              </div>
            )}

          {/* Suggested follow-ups */}
          {message.role === 'assistant' &&
            message.suggestedFollowUps &&
            message.suggestedFollowUps.length > 0 && (
              <div className="ml-0 flex flex-wrap gap-2">
                {message.suggestedFollowUps.map((followUp, i) => (
                  <button
                    key={i}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}
        </div>
      ))}

      {/* Channel thinking indicator — inline after last message */}
      {channelThinking && (
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
