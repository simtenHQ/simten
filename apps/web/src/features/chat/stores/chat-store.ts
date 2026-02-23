/**
 * Chat Store
 *
 * Zustand store for chat state management.
 * Handles messages, streaming state, and action tracking.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  ChatMessage,
  AssistantAction,
  StreamingState,
  ActionExecutionStatus,
} from '../types';
import type { AgentState, GoalState, AgentTurn } from '../agent/types';
import { GUARDRAILS } from '../constants';

// ============================================================================
// State Interface
// ============================================================================

interface ChatState {
  /** All messages in the conversation */
  messages: ChatMessage[];
  /** Current streaming state */
  streaming: StreamingState;
  /** Whether the chat panel is open */
  isOpen: boolean;
  /** Session ID for idempotency tracking */
  sessionId: string;
  /** Action execution status by actionId */
  actionStatus: Map<string, ActionExecutionStatus>;
  /** Executed action IDs for idempotency */
  executedActions: Set<string>;
  /** Whether agent mode is enabled */
  isAgentMode: boolean;
  /** Current agent state (when in agent mode) */
  agentState: AgentState | null;
  /** Whether an agent loop is currently running */
  isAgentRunning: boolean;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface ChatActions {
  // Panel control
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;

  // Message management
  addUserMessage: (content: string) => string;
  addAssistantMessage: (
    content: string,
    actions?: AssistantAction[],
    suggestedFollowUps?: string[]
  ) => string;
  addSystemMessage: (content: string) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;

  // Streaming
  startStreaming: (messageId: string) => void;
  updateStreamingMessage: (content: string) => void;
  finishStreaming: (
    content: string,
    actions?: AssistantAction[],
    suggestedFollowUps?: string[]
  ) => void;
  setStreamingError: (error: string) => void;

  // Action tracking
  setActionStatus: (actionId: string, status: ActionExecutionStatus) => void;
  markActionExecuted: (actionId: string) => void;
  hasExecuted: (actionId: string) => boolean;

  // Session management
  resetSession: () => void;
  getConversationHistory: () => string[];

  // Agent mode
  setAgentMode: (enabled: boolean) => void;
  startAgentLoop: (goalState: GoalState) => void;
  updateAgentState: (state: AgentState) => void;
  addAgentTurn: (turn: AgentTurn) => void;
  finishAgentLoop: (state: AgentState) => void;
  cancelAgentLoop: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialStreamingState: StreamingState = {
  isStreaming: false,
  currentMessageId: null,
  partialMessage: '',
  error: null,
};

function createInitialState(): ChatState {
  return {
    messages: [],
    streaming: initialStreamingState,
    isOpen: false,
    sessionId: nanoid(),
    actionStatus: new Map(),
    executedActions: new Set(),
    isAgentMode: false,
    agentState: null,
    isAgentRunning: false,
  };
}

// ============================================================================
// Store
// ============================================================================

export interface ChatStore extends ChatState, ChatActions {}

export const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    ...createInitialState(),

    // Panel control
    setOpen: (isOpen) => {
      set((state) => {
        state.isOpen = isOpen;
      });
    },

    toggle: () => {
      set((state) => {
        state.isOpen = !state.isOpen;
      });
    },

    // Message management
    addUserMessage: (content) => {
      const id = nanoid();
      set((state) => {
        state.messages.push({
          id,
          role: 'user',
          content,
          timestamp: Date.now(),
        });
        // Trim conversation to max history
        if (state.messages.length > GUARDRAILS.MAX_CONVERSATION_HISTORY * 2) {
          // Keep recent messages (user + assistant pairs)
          state.messages = state.messages.slice(-GUARDRAILS.MAX_CONVERSATION_HISTORY * 2);
        }
      });
      return id;
    },

    addAssistantMessage: (content, actions, suggestedFollowUps) => {
      const id = nanoid();
      set((state) => {
        state.messages.push({
          id,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          actions,
          suggestedFollowUps,
        });
      });
      return id;
    },

    addSystemMessage: (content) => {
      const id = nanoid();
      set((state) => {
        state.messages.push({
          id,
          role: 'system',
          content,
          timestamp: Date.now(),
        });
      });
      return id;
    },

    updateMessage: (id, updates) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === id);
        if (message) {
          Object.assign(message, updates);
        }
      });
    },

    deleteMessage: (id) => {
      set((state) => {
        state.messages = state.messages.filter((m) => m.id !== id);
      });
    },

    clearMessages: () => {
      set((state) => {
        state.messages = [];
      });
    },

    // Streaming
    startStreaming: (messageId) => {
      set((state) => {
        state.streaming = {
          isStreaming: true,
          currentMessageId: messageId,
          partialMessage: '',
          error: null,
        };
        // Add placeholder message
        state.messages.push({
          id: messageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        });
      });
    },

    updateStreamingMessage: (content) => {
      set((state) => {
        state.streaming.partialMessage = content;
        const message = state.messages.find(
          (m) => m.id === state.streaming.currentMessageId
        );
        if (message) {
          message.content = content;
        }
      });
    },

    finishStreaming: (content, actions, suggestedFollowUps) => {
      set((state) => {
        const message = state.messages.find(
          (m) => m.id === state.streaming.currentMessageId
        );
        if (message) {
          message.content = content;
          message.actions = actions;
          message.suggestedFollowUps = suggestedFollowUps;
          message.isStreaming = false;
        }
        state.streaming = initialStreamingState;
      });
    },

    setStreamingError: (error) => {
      set((state) => {
        state.streaming.error = error;
        state.streaming.isStreaming = false;
        const message = state.messages.find(
          (m) => m.id === state.streaming.currentMessageId
        );
        if (message) {
          message.isStreaming = false;
          message.error = error;
        }
      });
    },

    // Action tracking
    setActionStatus: (actionId, status) => {
      set((state) => {
        state.actionStatus.set(actionId, status);
      });
    },

    markActionExecuted: (actionId) => {
      set((state) => {
        state.executedActions.add(actionId);
        state.actionStatus.set(actionId, 'completed');
      });
    },

    hasExecuted: (actionId) => {
      return get().executedActions.has(actionId);
    },

    // Session management
    resetSession: () => {
      set(() => createInitialState());
    },

    getConversationHistory: () => {
      const messages = get().messages;
      return messages
        .filter((m) => m.role !== 'system')
        .slice(-GUARDRAILS.MAX_CONVERSATION_HISTORY)
        .map((m) => `${m.role}: ${m.content}`);
    },

    // Agent mode
    setAgentMode: (enabled) => {
      set((state) => {
        state.isAgentMode = enabled;
        if (!enabled) {
          state.agentState = null;
          state.isAgentRunning = false;
        }
      });
    },

    startAgentLoop: (goalState) => {
      set((state) => {
        state.isAgentRunning = true;
        state.agentState = {
          turns: [],
          totalTokensUsed: 0,
          status: 'running',
          goalState,
        };
      });
    },

    updateAgentState: (agentState) => {
      set((state) => {
        state.agentState = agentState;
      });
    },

    addAgentTurn: (turn) => {
      set((state) => {
        if (state.agentState) {
          state.agentState.turns.push(turn);
        }
        // Add message with action for user to execute
        // In agent mode, we show actions and wait for user to execute them
        // This gives the user control while still being agentic
        state.messages.push({
          id: nanoid(),
          role: 'assistant',
          content: turn.response.message,
          timestamp: Date.now(),
          actions: turn.response.action ? [turn.response.action] : undefined,
        });
      });
    },

    finishAgentLoop: (agentState) => {
      set((state) => {
        state.agentState = agentState;
        state.isAgentRunning = false;
      });
    },

    cancelAgentLoop: () => {
      set((state) => {
        if (state.agentState) {
          state.agentState.status = 'cancelled';
        }
        state.isAgentRunning = false;
      });
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsStreaming = (state: ChatStore) => state.streaming.isStreaming;
export const selectMessages = (state: ChatStore) => state.messages;
export const selectIsOpen = (state: ChatStore) => state.isOpen;
export const selectLastMessage = (state: ChatStore) =>
  state.messages[state.messages.length - 1];
