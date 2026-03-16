/**
 * MessageBubble Component
 *
 * Individual message display with role-based styling.
 * Triggers auto-highlighting for assistant messages.
 */

'use client';

import React, { useEffect, useMemo } from 'react';
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
            : 'bg-gray-100 text-gray-900',
          role === 'system' && 'bg-yellow-50 text-yellow-800 italic',
          error && 'bg-red-50 text-red-800 border border-red-200'
        )}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {content || (isStreaming ? '...' : '')}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mt-1 flex items-center gap-1 text-gray-500">
            <span className="h-1 w-1 animate-pulse rounded-full bg-gray-400" />
            <span
              className="h-1 w-1 animate-pulse rounded-full bg-gray-400"
              style={{ animationDelay: '0.2s' }}
            />
            <span
              className="h-1 w-1 animate-pulse rounded-full bg-gray-400"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-2 text-xs text-red-600">Error: {error}</div>
        )}
      </div>
    </div>
  );
}
