/**
 * Chat Feature Types
 *
 * Type definitions for the LLM-powered hardware design assistant.
 * Domain-only actions - NO UI gestures in the protocol.
 */

// Re-export BAML generated types
export type {
  AssistantResponse,
  SetInputAction,
  RunSimulationAction,
  ShowDiffAction,
  InsertNodeAction,
  ActionType,
} from '@/lib/baml_client/baml_client';

// ============================================================================
// Chat Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** Actions suggested by assistant (only for assistant messages) */
  actions?: AssistantAction[];
  /** Follow-up suggestions (only for assistant messages) */
  suggestedFollowUps?: string[];
  /** Whether the message is currently streaming */
  isStreaming?: boolean;
  /** Error that occurred during processing */
  error?: string;
}

// ============================================================================
// Action Types (Union)
// ============================================================================

import type {
  SetInputAction as BAMLSetInputAction,
  RunSimulationAction as BAMLRunSimAction,
  ShowDiffAction as BAMLShowDiffAction,
  InsertNodeAction as BAMLInsertNodeAction,
} from '@/lib/baml_client/baml_client';

export type AssistantAction =
  | BAMLSetInputAction
  | BAMLRunSimAction
  | BAMLShowDiffAction
  | BAMLInsertNodeAction;

// ============================================================================
// Action Safety Levels
// ============================================================================

export type ActionSafety = 'preview' | 'confirm';

export type ActionExecutionStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'stale';

export interface ActionResult {
  success: boolean;
  actionId: string;
  type: string;
  /** Present if action was skipped (e.g., duplicate) */
  skipped?: boolean;
  /** Present if action is stale (circuit modified) */
  stale?: boolean;
  /** Present if action was queued (e.g., simulation throttled) */
  queued?: boolean;
  /** Reason for failure/skip/stale */
  reason?: string;
  /** Duration of execution in ms */
  durationMs?: number;
  /** Any errors from validation */
  errors?: Array<{ message: string; line?: number }>;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamingState {
  isStreaming: boolean;
  currentMessageId: string | null;
  partialMessage: string;
  error: string | null;
}

export interface StreamingPolicy {
  /** What to do if stream disconnects mid-response */
  onDisconnect: 'discard' | 'retry' | 'partial';
  /** Max retry attempts */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  errors?: Array<{ message: string; line?: number }>;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ChatContext {
  dslCode: string;
  compactContext: string;
  conversationHistory: string[];
  sourceCodeHash: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface ChatSession {
  id: string;
  startedAt: number;
  messages: ChatMessage[];
}
