/**
 * MessageBubble Component
 *
 * Individual message display with role-based styling.
 * Triggers auto-highlighting for assistant messages.
 */

'use client';

import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../types';
import { extractPotentialNodeRefs } from '../ui/node-reference-parser';

interface MessageBubbleProps {
  message: ChatMessage;
  onNodeMention?: (nodeIds: string[]) => void;
}

export function MessageBubble({ message, onNodeMention }: MessageBubbleProps) {
  const { role, content, isStreaming, error } = message;

  // Extract potential node references for assistant messages
  const nodeRefs = useMemo(() => {
    if (role === 'assistant' && !isStreaming) {
      return extractPotentialNodeRefs(content);
    }
    return [];
  }, [role, content, isStreaming]);

  // Notify parent of node mentions
  useEffect(() => {
    if (nodeRefs.length > 0 && onNodeMention) {
      onNodeMention(nodeRefs);
    }
  }, [nodeRefs, onNodeMention]);

  return (
    <div
      className={cn(
        'flex w-full',
        role === 'user' ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-muted text-foreground',
          role === 'system' && 'bg-yellow-100 text-yellow-900 italic dark:bg-yellow-950/40 dark:text-yellow-200',
          error && 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900'
        )}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {content || (isStreaming ? '...' : '')}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mt-1 flex items-center gap-1 text-muted-foreground">
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70" />
            <span
              className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70"
              style={{ animationDelay: '0.2s' }}
            />
            <span
              className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-2 text-xs text-red-700 dark:text-red-300">Error: {error}</div>
        )}
      </div>
    </div>
  );
}
