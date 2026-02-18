/**
 * Chat Feature Module
 *
 * LLM-powered hardware design assistant.
 * Domain-only protocol - UI gestures inferred from message text.
 */

// Types
export type {
  ChatMessage,
  AssistantAction,
  ActionSafety,
  ActionExecutionStatus,
  ActionResult,
  StreamingState,
  StreamingPolicy,
  ValidationResult,
  ChatContext,
  ChatSession,
} from './types';

// Constants
export {
  GUARDRAILS,
  DIFF_GUARDRAILS,
  ACTION_SAFETY,
  PROTOCOL_VERSION,
  SCHEMA_COMPAT,
  STREAMING_POLICY,
  TOKEN_BUDGET,
  CHAT_UI,
} from './constants';

// Store
export { useChatStore, selectIsStreaming, selectMessages, selectIsOpen, selectLastMessage } from './stores/chat-store';

// Components
export { ChatPanel, ChatInput, MessageList, MessageBubble, ActionCard, CodeDiffView, ConfirmationModal, StaleActionNotice } from './components';

// Actions
export { executeAction, applyDiff, validateAction, validateShowDiff, normalizeAction, type ActionExecutionContext } from './actions';

// Hooks
export { useNarrativeContext, buildNarrativeContext, type NarrativeContextResult } from './hooks';

// Context
export { buildNarrativeSummary, buildMinimalNarrative, enforceTokenBudget, countTokens } from './context';

// Streaming
export { sendMessage, processStream, type StreamResult, type StreamCallbacks } from './streaming';

// UI Utilities
export { extractNodeReferences, highlightNodesFromMessage, createCircuitChecker } from './ui';

// Versioning
export { isVersionSupported, getSupportedActions, getCurrentVersion, isKnownActionType } from './versioning/schema-compat';
