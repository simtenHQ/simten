/**
 * Agent Loop Types
 *
 * Type definitions for the goal-driven agentic loop architecture.
 * The agent iterates through actions, observes results, and reasons
 * against explicit success criteria until goals are met.
 */

import type { AssistantAction } from '../types';

// ============================================================================
// Goal State Types
// ============================================================================

/**
 * Types of success criteria the agent can track.
 */
export type CriterionType = 'validation' | 'structural' | 'behavioral' | 'custom';

/**
 * A single success criterion that must be satisfied.
 */
export interface SuccessCriterion {
  /** Unique identifier for this criterion */
  id: string;
  /** Human-readable description */
  description: string;
  /** Type of criterion for categorization */
  type: CriterionType;
  /** Whether this can be automatically verified */
  verifiable: boolean;
}

/**
 * Status of a single criterion.
 */
export interface CriterionStatus {
  /** Reference to the criterion */
  criterionId: string;
  /** Whether the criterion is satisfied */
  satisfied: boolean;
  /** Evidence or reason for the status */
  evidence?: string;
  /** When this status was last checked (turn number) */
  lastChecked: number;
}

/**
 * The complete goal state tracking what the agent is trying to achieve.
 */
export interface GoalState {
  /** High-level description of the user's goal */
  description: string;
  /** List of success criteria to satisfy */
  successCriteria: SuccessCriterion[];
  /** Current status of each criterion */
  currentStatus: CriterionStatus[];
}

// ============================================================================
// Behavioral Verification Types
// ============================================================================

/**
 * Tolerance mode for behavioral verification.
 * - exact: Output must match in the same cycle
 * - eventually: Output must match within some latency window
 */
export type VerificationTolerance = 'exact' | 'eventually';

/**
 * Defines expected behavior for verification.
 */
export interface BehavioralExpectation {
  /** Unique identifier */
  id: string;
  /** Human-readable description of expected behavior */
  description: string;
  /** Sequence of input values to apply */
  inputSequence: Record<string, number>[];
  /** Expected output values for each step */
  expectedOutputs: Record<string, number>[];
  /** How strictly to match timing */
  tolerance?: VerificationTolerance;
}

/**
 * A single mismatch between expected and actual behavior.
 */
export interface BehavioralMismatch {
  /** Which step in the sequence */
  step: number;
  /** Which port/signal */
  port: string;
  /** What we expected */
  expected: number;
  /** What we got */
  actual: number;
}

/**
 * Result of running behavioral verification.
 */
export interface VerificationResult {
  /** Whether all expectations were met */
  passed: boolean;
  /** Which expectation was tested */
  expectationId: string;
  /** List of any mismatches found */
  mismatches: BehavioralMismatch[];
}

// ============================================================================
// Semantic Signal Types
// ============================================================================

/**
 * Regression signal - tracks whether changes made things worse.
 */
export interface RegressionSignal {
  /** Whether this is a regression */
  isRegression: boolean;
  /** Change in error count (positive = more errors) */
  errorDelta: number;
  /** Whether simulation capability changed */
  blockingStatusChanged: boolean;
  /** Severity classification */
  severity: 'critical' | 'major' | 'minor' | 'improvement';
}

/**
 * Structural change signal - categorizes the magnitude of changes.
 */
export interface StructuralSignal {
  /** Category of change magnitude */
  changeType: 'minor' | 'moderate' | 'major';
  /** Change in node count */
  nodeCountDelta: number;
  /** Change in combinational depth */
  depthChange: number;
  /** Number of registers added */
  registersAdded: number;
}

/**
 * Circuit complexity signal.
 */
export interface ComplexitySignal {
  /** Complexity score 0-100 */
  score: number;
  /** Human-readable rating */
  rating: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

/**
 * Behavioral verification signal.
 */
export interface BehavioralSignal {
  /** Number of verifications run */
  verificationsRun: number;
  /** Number that passed */
  passed: number;
  /** Number that failed */
  failed: number;
  /** All mismatches across all verifications */
  mismatches: BehavioralMismatch[];
}

/**
 * Complete semantic signals from an action observation.
 */
export interface SemanticSignal {
  /** Regression detection */
  regression: RegressionSignal;
  /** Structural change categorization */
  structural: StructuralSignal;
  /** Circuit complexity */
  complexity: ComplexitySignal;
  /** Behavioral verification results */
  behavioral: BehavioralSignal;
}

// ============================================================================
// Validation State Types (for observation)
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
// Action Observation Types
// ============================================================================

/**
 * Complete observation from executing an action.
 */
export interface ActionObservation {
  /** The action that was executed */
  action: AssistantAction;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Validation state before action */
  validationBefore: ValidationSnapshot;
  /** Validation state after action */
  validationAfter: ValidationSnapshot;
  /** Computed semantic signals */
  signals: SemanticSignal;
  /** For SHOW_DIFF: the code after applying */
  appliedCode?: string;
  /** Parse errors if any were introduced */
  parseErrors?: string[];
  /** For RUN_SIMULATION: behavioral verification results */
  verificationResults?: VerificationResult[];
}

// ============================================================================
// Agent Turn Types
// ============================================================================

/**
 * The LLM's response for a single turn.
 */
export interface AgentResponse {
  /** Protocol version */
  schemaVersion: string;
  /** Message to show the user */
  message: string;
  /** Single action to execute (or null for reasoning-only) */
  action?: AssistantAction;
  /** Whether the agent believes the goal is achieved */
  done: boolean;
  /** Remaining steps in the current plan */
  plan?: string[];
  /** Reasoning for why this action was chosen */
  reasoning?: string;
}

/**
 * A complete turn in the agent loop.
 */
export interface AgentTurn {
  /** Turn number (1-indexed) */
  turnNumber: number;
  /** The LLM's response */
  response: AgentResponse;
  /** Observation from executing the action (if any) */
  observation: ActionObservation | null;
}

// ============================================================================
// Agent State Types
// ============================================================================

/**
 * Status of the agent loop.
 */
export type AgentStatus =
  | 'running'
  | 'completed'
  | 'max_turns_reached'
  | 'cancelled'
  | 'error'
  | 'waiting_for_user';

/**
 * Complete state of the agent loop.
 */
export interface AgentState {
  /** All turns executed so far */
  turns: AgentTurn[];
  /** Total tokens used across all turns */
  totalTokensUsed: number;
  /** Current status of the agent */
  status: AgentStatus;
  /** The goal being pursued */
  goalState: GoalState;
  /** Current plan (updated each turn) */
  currentPlan?: string[];
  /** Error message if status is 'error' */
  errorMessage?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Guardrails for agent execution.
 */
export interface AgentGuardrails {
  /** Maximum turns before stopping */
  MAX_TURNS: number;
  /** Maximum tokens per turn */
  MAX_TOKENS_PER_TURN: number;
  /** Total token budget across all turns */
  TOTAL_TOKEN_BUDGET: number;
  /** Whether to auto-apply diffs in agent mode */
  AUTO_APPLY_DIFFS: boolean;
}

/**
 * Plan validation result.
 */
export interface PlanValidation {
  /** Whether the plan is consistent */
  valid: boolean;
  /** Any detected conflicts */
  conflicts: string[];
}
