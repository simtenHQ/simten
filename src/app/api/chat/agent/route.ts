/**
 * Agent API Route
 *
 * Endpoint for single agent turn execution.
 * The client runs the loop, calling this endpoint for each LLM turn.
 */

import { NextRequest, NextResponse } from 'next/server';
import { b } from '@/lib/baml_client/baml_client';
import { PROTOCOL_VERSION } from '@/features/chat/constants';
import { normalizeAction } from '@/features/chat/actions/action-normalizer';
import { validateAction } from '@/features/chat/actions/action-validator';
import { validateShowDiff } from '@/features/chat/actions/diff-validator';
import { isKnownActionType } from '@/features/chat/versioning/schema-compat';

// ============================================================================
// Request/Response Types
// ============================================================================

interface AgentRequest {
  userMessage: string;
  dslCode: string;
  narrativeContext: string;
  goalState: string;
  turnHistory: string;
  semanticSignals?: string;
}

interface AgentResponse {
  schemaVersion: string;
  message: string;
  action?: unknown;
  done: boolean;
  plan?: string[];
  reasoning?: string;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequest;
    const {
      userMessage,
      dslCode,
      narrativeContext,
      goalState,
      turnHistory,
      semanticSignals = '(No signals yet)',
    } = body;

    // Validate request
    if (!userMessage?.trim()) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    // Call the BAML agent function
    const response = await b.HardwareAgent(
      userMessage,
      dslCode || '',
      narrativeContext || '',
      goalState || '',
      turnHistory || '',
      semanticSignals
    );

    // Validate schema version
    if (response.schemaVersion !== PROTOCOL_VERSION) {
      console.warn(
        `[Agent] Schema version mismatch: expected ${PROTOCOL_VERSION}, got ${response.schemaVersion}`
      );
    }

    // Normalize and validate action if present
    let validatedAction = response.action;
    if (response.action) {
      // Check if action type is known
      if (!isKnownActionType(response.action.type)) {
        console.warn(`[Agent] Unknown action type: ${response.action.type}`);
        validatedAction = undefined;
      } else {
        // Normalize and validate
        const normalized = normalizeAction(response.action);
        const validation = validateAction(normalized);

        if (!validation.valid) {
          console.warn(`[Agent] Action validation failed: ${validation.reason}`);
          validatedAction = undefined;
        } else {
          // Additional validation for SHOW_DIFF
          if (normalized.type === 'SHOW_DIFF') {
            const diffValidation = validateShowDiff(normalized);
            if (!diffValidation.valid) {
              console.warn(`[Agent] Diff validation failed: ${diffValidation.reason}`);
              validatedAction = undefined;
            } else {
              validatedAction = normalized;
            }
          } else {
            validatedAction = normalized;
          }
        }
      }
    }

    // Build response
    const agentResponse: AgentResponse = {
      schemaVersion: response.schemaVersion,
      message: response.message,
      action: validatedAction,
      done: response.done,
      plan: response.plan ?? undefined,
      reasoning: response.reasoning ?? undefined,
    };

    return NextResponse.json(agentResponse);
  } catch (error) {
    console.error('[Agent] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
