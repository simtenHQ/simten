/**
 * Chat API Route
 *
 * Streaming endpoint for hardware assistant chat.
 * Uses BAML to call the LLM and stream responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { b } from '@/lib/baml_client/baml_client';
import { PROTOCOL_VERSION, STREAMING_POLICY } from '@/features/chat/constants';
import { normalizeActions } from '@/features/chat/actions/action-normalizer';
import { validateAction } from '@/features/chat/actions/action-validator';
import { validateShowDiff } from '@/features/chat/actions/diff-validator';
import { isKnownActionType } from '@/features/chat/versioning/schema-compat';

// ============================================================================
// Request/Response Types
// ============================================================================

interface ChatRequest {
  userMessage: string;
  dslCode: string;
  compactContext: string;
  conversationHistory: string[];
}

interface StreamChunk {
  type: 'message' | 'done' | 'error';
  content?: string;
  response?: {
    schemaVersion: string;
    message: string;
    actions: unknown[];
    suggestedFollowUps?: string[] | null;
  };
  error?: string;
}

// ============================================================================
// Stream Helpers
// ============================================================================

function encodeChunk(chunk: StreamChunk): string {
  return JSON.stringify(chunk) + '\n';
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const { userMessage, dslCode, compactContext, conversationHistory } = body;

    // Validate request
    if (!userMessage?.trim()) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let attempts = 0;
        let lastError: Error | null = null;

        while (attempts <= STREAMING_POLICY.maxRetries) {
          try {
            // Use BAML streaming
            const bamlStream = b.stream.HardwareAssistant(
              userMessage,
              dslCode || '',
              compactContext || '',
              conversationHistory || []
            );

            let partialMessage = '';

            // Stream partial responses
            for await (const partial of bamlStream) {
              if (partial?.message) {
                // Only send message updates, not partial action parsing
                partialMessage = partial.message;
                controller.enqueue(
                  new TextEncoder().encode(
                    encodeChunk({
                      type: 'message',
                      content: partialMessage,
                    })
                  )
                );
              }
            }

            // Get final response
            const finalResponse = await bamlStream.getFinalResponse();

            // Validate schema version
            if (finalResponse.schemaVersion !== PROTOCOL_VERSION) {
              console.warn(
                `[Chat] Schema version mismatch: expected ${PROTOCOL_VERSION}, got ${finalResponse.schemaVersion}`
              );
            }

            // Normalize and validate actions
            const rawActions = finalResponse.actions || [];
            const normalizedActions = normalizeActions(rawActions);

            // Filter and validate actions
            const validActions = normalizedActions.filter((action) => {
              // Skip unknown action types (graceful ignore)
              if (!isKnownActionType(action.type)) {
                console.warn(`[Chat] Unknown action type ignored: ${action.type}`);
                return false;
              }

              // Validate action
              const validation = validateAction(action);
              if (!validation.valid) {
                console.warn(
                  `[Chat] Action validation failed: ${validation.reason}`
                );
                return false;
              }

              // Additional validation for SHOW_DIFF
              if (action.type === 'SHOW_DIFF') {
                const diffValidation = validateShowDiff(action);
                if (!diffValidation.valid) {
                  console.warn(
                    `[Chat] Diff validation failed: ${diffValidation.reason}`
                  );
                  // Log detailed parse errors if available
                  if (diffValidation.errors) {
                    console.warn('[Chat] Parse errors:', diffValidation.errors);
                  }
                  return false;
                }
              }

              return true;
            });

            // Send final response
            controller.enqueue(
              new TextEncoder().encode(
                encodeChunk({
                  type: 'done',
                  response: {
                    schemaVersion: finalResponse.schemaVersion,
                    message: finalResponse.message,
                    actions: validActions,
                    suggestedFollowUps: finalResponse.suggestedFollowUps,
                  },
                })
              )
            );

            controller.close();
            return;
          } catch (error) {
            attempts++;
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempts <= STREAMING_POLICY.maxRetries) {
              console.warn(
                `[Chat] Streaming attempt ${attempts} failed, retrying...`,
                lastError.message
              );
              await new Promise((resolve) =>
                setTimeout(resolve, STREAMING_POLICY.retryDelayMs)
              );
            }
          }
        }

        // All retries failed
        console.error('[Chat] All streaming attempts failed:', lastError);
        controller.enqueue(
          new TextEncoder().encode(
            encodeChunk({
              type: 'error',
              error: lastError?.message || 'Failed to get response from assistant',
            })
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat] Request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
