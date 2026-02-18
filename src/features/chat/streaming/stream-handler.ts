/**
 * Stream Handler
 *
 * Client-side streaming response handler.
 * Processes NDJSON stream from the API.
 */

import type { AssistantAction } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface StreamChunk {
  type: 'message' | 'done' | 'error';
  content?: string;
  response?: {
    schemaVersion: string;
    message: string;
    actions: AssistantAction[];
    suggestedFollowUps?: string[] | null;
  };
  error?: string;
}

export interface StreamResult {
  message: string;
  actions: AssistantAction[];
  suggestedFollowUps?: string[];
  streamingError: boolean;
  error?: string;
}

export interface StreamCallbacks {
  onMessageUpdate: (message: string) => void;
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

  try {
    while (true) {
      // Check for abort
      if (signal?.aborted) {
        reader.cancel();
        callbacks.onError('Request aborted');
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        // Stream ended without done chunk - treat as partial success
        if (buffer.trim()) {
          processRemainingBuffer(buffer, callbacks, lastMessage);
        }
        break;
      }

      // Decode and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (NDJSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

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

            case 'done':
              if (chunk.response) {
                callbacks.onComplete({
                  message: chunk.response.message,
                  actions: chunk.response.actions as AssistantAction[],
                  suggestedFollowUps: chunk.response.suggestedFollowUps ?? undefined,
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
          // Continue processing other chunks
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Stream] Error:', errorMessage);

    // Graceful degradation: return partial message with no actions
    if (lastMessage) {
      callbacks.onComplete({
        message: lastMessage,
        actions: [],
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
  lastMessage: string
): void {
  try {
    const chunk = JSON.parse(buffer.trim()) as StreamChunk;
    if (chunk.type === 'done' && chunk.response) {
      callbacks.onComplete({
        message: chunk.response.message,
        actions: chunk.response.actions as AssistantAction[],
        suggestedFollowUps: chunk.response.suggestedFollowUps ?? undefined,
        streamingError: false,
      });
      return;
    }
  } catch {
    // Not valid JSON - ignore
  }

  // Fallback: return partial message
  if (lastMessage) {
    callbacks.onComplete({
      message: lastMessage,
      actions: [],
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
  dslCode: string;
  compactContext: string;
  conversationHistory: string[];
  signal?: AbortSignal;
}

/**
 * Send a message to the chat API and process the streaming response.
 */
export async function sendMessage(
  options: SendMessageOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { userMessage, dslCode, compactContext, conversationHistory, signal } =
    options;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        dslCode,
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
