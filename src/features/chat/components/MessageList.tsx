/**
 * MessageList Component
 *
 * Scrollable list of chat messages with actions.
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ActionCard } from './ActionCard';
import type { ChatMessage, AssistantAction, ActionExecutionStatus } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  actionStatuses: Map<string, ActionExecutionStatus>;
  onExecuteAction: (action: AssistantAction) => void;
  onShowDiff: (action: AssistantAction) => void;
  onNodeMention?: (nodeIds: string[]) => void;
}

export function MessageList({
  messages,
  actionStatuses,
  onExecuteAction,
  onShowDiff,
  onNodeMention,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-gray-400 text-sm">
        Ask a question about your circuit
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="space-y-3">
          {/* Message bubble */}
          <MessageBubble message={message} onNodeMention={onNodeMention} />

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
    </div>
  );
}
