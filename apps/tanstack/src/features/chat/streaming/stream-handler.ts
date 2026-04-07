/**
 * Stream Handler
 *
 * Client-side streaming response handler.
 * Processes NDJSON stream from the API.
 * Handles tool_call, message, done, and error chunks.
 */

import type { AssistantAction, ToolCallInfo } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface StreamChunk {
  type: 'tool_call' | 'message' | 'done' | 'error';
  content?: string;
  toolCall?: { name: string; input: Record<string, unknown> };
  response?: {
    message: string;
    actions: AssistantAction[];
    suggestedFollowUps?: string[] | null;
  };
  usage?: UsageInfo;
  error?: string;
}

export interface StreamResult {
  message: string;
  actions: AssistantAction[];
  suggestedFollowUps?: string[];
  toolCalls: ToolCallInfo[];
  usage?: UsageInfo;
  streamingError: boolean;
  error?: string;
}

export interface StreamCallbacks {
  onMessageUpdate: (message: string) => void;
  onToolCall: (toolCall: ToolCallInfo) => void;
  onComplete: (result: StreamResult) => void;
  onError: (error: string) => void;
}

// ============================================================================
// Stream Processing
// ============================================================================

/**
 * Process a streaming response from the chat API.
 */
export async function processStream(
  response: Response,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lastMessage = '';
  const toolCalls: ToolCallInfo[] = [];

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        callbacks.onError('Request aborted');
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        if (buffer.trim()) {
          processRemainingBuffer(buffer, callbacks, lastMessage, toolCalls);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const chunk = JSON.parse(line) as StreamChunk;

          switch (chunk.type) {
            case 'message':
              if (chunk.content) {
                lastMessage = chunk.content;
                callbacks.onMessageUpdate(chunk.content);
              }
              break;

            case 'tool_call':
              if (chunk.toolCall) {
                const tc: ToolCallInfo = {
                  id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: chunk.toolCall.name,
                  input: chunk.toolCall.input,
                  status: 'done',
                };
                toolCalls.push(tc);
                callbacks.onToolCall(tc);
              }
              break;

            case 'done':
              if (chunk.response) {
                callbacks.onComplete({
                  message: chunk.response.message,
                  actions: chunk.response.actions as AssistantAction[],
                  suggestedFollowUps: chunk.response.suggestedFollowUps ?? undefined,
                  toolCalls,
                  usage: chunk.usage,
                  streamingError: false,
                });
              }
              return;

            case 'error':
              callbacks.onError(chunk.error || 'Unknown error');
              return;
          }
        } catch (parseError) {
          console.warn('[Stream] Failed to parse chunk:', line, parseError);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Stream] Error:', errorMessage);

    if (lastMessage) {
      callbacks.onComplete({
        message: lastMessage,
        actions: [],
        toolCalls,
        streamingError: true,
        error: errorMessage,
      });
    } else {
      callbacks.onError(errorMessage);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process any remaining buffer when stream ends unexpectedly.
 */
function processRemainingBuffer(
  buffer: string,
  callbacks: StreamCallbacks,
  lastMessage: string,
  toolCalls: ToolCallInfo[]
): void {
  try {
    const chunk = JSON.parse(buffer.trim()) as StreamChunk;
    if (chunk.type === 'done' && chunk.response) {
      callbacks.onComplete({
        message: chunk.response.message,
        actions: chunk.response.actions as AssistantAction[],
        suggestedFollowUps: chunk.response.suggestedFollowUps ?? undefined,
        toolCalls,
        streamingError: false,
      });
      return;
    }
  } catch {
    // Not valid JSON
  }

  if (lastMessage) {
    callbacks.onComplete({
      message: lastMessage,
      actions: [],
      toolCalls,
      streamingError: true,
      error: 'Stream ended unexpectedly',
    });
  }
}

// ============================================================================
// API Call Helper
// ============================================================================

export interface SendMessageOptions {
  userMessage: string;
  code: string;
  compactContext: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}

/**
 * Send a message to the chat API and process the streaming response.
 */
export async function sendMessage(
  options: SendMessageOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { userMessage, code, compactContext, conversationHistory, signal } =
    options;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        code,
        compactContext,
        conversationHistory,
      }),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: string };
      callbacks.onError(errorBody.error || `HTTP ${response.status}`);
      return;
    }

    await processStream(response, callbacks, signal);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onError('Request aborted');
    } else {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }
  }
}
