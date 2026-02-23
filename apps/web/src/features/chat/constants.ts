/**
 * Chat Feature Constants
 *
 * Guardrails, safety levels, and configuration constants.
 */

import type { ActionSafety, StreamingPolicy } from './types';

// ============================================================================
// Resource Guardrails
// ============================================================================

export const GUARDRAILS = {
  /** Maximum simulation cycles allowed per action */
  MAX_SIMULATION_CYCLES: 100,
  /** Maximum messages to keep in conversation history for LLM context */
  MAX_CONVERSATION_HISTORY: 10,
  /** Timeout for action execution in ms */
  ACTION_TIMEOUT_MS: 5000,
  /** Cooldown between simulations in ms */
  SIMULATION_COOLDOWN_MS: 2000,
  /** Maximum queued simulations (beyond currently running) */
  MAX_QUEUED_SIMULATIONS: 1,
} as const;

// ============================================================================
// SHOW_DIFF Guardrails
// ============================================================================

export const DIFF_GUARDRAILS = {
  /** Maximum number of changed lines in a diff */
  MAX_CHANGED_LINES: 200,
  /** Maximum diff size in bytes (15KB allows complex circuits like CORDIC) */
  MAX_DIFF_SIZE_BYTES: 15000,
  /** Require non-empty explanation */
  REQUIRE_EXPLANATION: true,
  /**
   * Require suggested code to parse without errors.
   * Disabled: Let the Monaco editor show errors on apply instead.
   * This allows partial diffs and is how most code assistants work.
   */
  REQUIRE_VALID_SYNTAX: false,
} as const;

// ============================================================================
// Action Safety Levels
// ============================================================================

/**
 * Safety levels for each action type.
 * - preview: Show what will happen, one-click to execute
 * - confirm: Show modal, require explicit confirmation
 */
export const ACTION_SAFETY: Record<string, ActionSafety> = {
  SET_INPUT: 'preview',      // Immediate, harmless, reversible
  RUN_SIMULATION: 'preview',
  SHOW_DIFF: 'preview',
  INSERT_NODE: 'confirm',
  GENERATE_HARNESS: 'preview', // Shows as diff, user clicks Apply
  VERIFY_ASSERTION: 'preview', // Read-only verification, auto-execute
} as const;

// ============================================================================
// Protocol Versioning
// ============================================================================

export const PROTOCOL_VERSION = '1.0' as const;

/**
 * Schema compatibility matrix.
 * Maps schema versions to supported action types.
 * - Minor versions add optional actions, never remove
 * - Major versions can have breaking changes
 */
export const SCHEMA_COMPAT: Record<string, string[]> = {
  '1.0': ['SET_INPUT', 'RUN_SIMULATION', 'SHOW_DIFF', 'INSERT_NODE', 'GENERATE_HARNESS', 'VERIFY_ASSERTION'],
} as const;

// ============================================================================
// Streaming Policy
// ============================================================================

export const STREAMING_POLICY: StreamingPolicy = {
  onDisconnect: 'partial',
  maxRetries: 2,
  retryDelayMs: 1000,
} as const;

// ============================================================================
// Token Budget
// ============================================================================

/**
 * Token budget for context compression.
 * Using approximately 75% of context window for context,
 * leaving room for the prompt and response.
 */
export const TOKEN_BUDGET = {
  /** Approximate model context window */
  MODEL_CONTEXT_WINDOW: 8000,
  /** Maximum tokens for context (75% of window) */
  MAX_CONTEXT_TOKENS: 6000,
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const CHAT_UI = {
  /** Keyboard shortcut to open chat panel */
  TOGGLE_SHORTCUT: 'k',
  /** Modifier key for shortcut */
  MODIFIER_KEY: 'meta', // Cmd on Mac, Ctrl on Windows
  /** Default panel width */
  PANEL_WIDTH: 420,
} as const;

// ============================================================================
// Agent Mode Constants
// ============================================================================

/**
 * Guardrails for agent mode execution.
 */
export const AGENT_MODE = {
  /** Maximum turns before stopping (standard tasks) */
  MAX_TURNS: 10,
  /** Maximum turns for verification tasks (build + assert + verify + fix + re-verify) */
  MAX_TURNS_VERIFICATION: 15,
  /** Maximum tokens per turn */
  MAX_TOKENS_PER_TURN: 2000,
  /** Total token budget across all turns */
  TOTAL_TOKEN_BUDGET: 20000,
  /** Whether to auto-apply diffs in agent mode */
  AUTO_APPLY_DIFFS: true,
} as const;
