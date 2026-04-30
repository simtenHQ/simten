/**
 * Chat Feature Types
 *
 * Type definitions for the LLM-powered hardware design assistant.
 * Domain-only actions - NO UI gestures in the protocol.
 */

// ============================================================================
// Action Type Enum
// ============================================================================

export enum ActionType {
  SET_INPUT = 'SET_INPUT',
  RUN_SIMULATION = 'RUN_SIMULATION',
  SHOW_DIFF = 'SHOW_DIFF',
  WRITE_CIRCUIT = 'WRITE_CIRCUIT',
  INSERT_NODE = 'INSERT_NODE',
  GENERATE_HARNESS = 'GENERATE_HARNESS',
  VERIFY_ASSERTION = 'VERIFY_ASSERTION',
}

// ============================================================================
// Action Interfaces
// ============================================================================

export interface SetInputAction {
  actionId?: string | null;
  type: 'SET_INPUT';
  node: string;
  value: number;
}

export interface RunSimulationAction {
  actionId?: string | null;
  type: 'RUN_SIMULATION';
  cycles: number;
  stimuli?: Record<string, number> | null;
}

export interface ShowDiffAction {
  actionId?: string | null;
  type: 'SHOW_DIFF';
  originalCode: string;
  suggestedCode: string;
  explanation: string;
}

export interface WriteCircuitAction {
  actionId?: string | null;
  type: 'WRITE_CIRCUIT';
  code: string;
  explanation: string;
}

export interface InsertNodeAction {
  actionId?: string | null;
  type: 'INSERT_NODE';
  componentRef: string;
  suggestedLabel?: string | null;
  connectFrom?: string | null;
  connectTo?: string | null;
}

export interface GenerateHarnessAction {
  actionId?: string | null;
  type: 'GENERATE_HARNESS';
  circuitName?: string | null;
}

export interface VerifyAssertionAction {
  actionId?: string | null;
  type: 'VERIFY_ASSERTION';
  targetCircuit?: string | null;
  maxCycles?: number | null;
}

// ============================================================================
// Response Types
// ============================================================================

export interface AssistantResponse {
  schemaVersion: '1.0';
  message: string;
  actions: (SetInputAction | RunSimulationAction | ShowDiffAction | InsertNodeAction | GenerateHarnessAction)[];
  suggestedFollowUps?: string[] | null;
  shouldContinue: boolean;
}

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
  /** Tool calls made during this message (for display) */
  toolCalls?: ToolCallInfo[];
  /** Token usage for this message */
  usage?: UsageInfo;
}

/** Info about a tool call for UI rendering */
export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
}

/** Token usage info for a message */
export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

// ============================================================================
// Action Types (Union)
// ============================================================================

export type AssistantAction =
  | SetInputAction
  | RunSimulationAction
  | ShowDiffAction
  | WriteCircuitAction
  | InsertNodeAction
  | GenerateHarnessAction
  | VerifyAssertionAction;

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
// Validation State Types
// ============================================================================

/**
 * Snapshot of validation state.
 */
export interface ValidationSnapshot {
  /** Number of errors */
  errors: number;
  /** Number of warnings */
  warnings: number;
  /** Whether simulation is possible */
  canSimulate: boolean;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ChatContext {
  code: string;
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
