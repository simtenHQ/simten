/**
 * Agent Module
 *
 * Exports for the goal-driven agentic loop architecture.
 */

// Types
export type {
  AgentState,
  AgentTurn,
  AgentResponse,
  AgentGuardrails,
  GoalState,
  SuccessCriterion,
  CriterionStatus,
  BehavioralExpectation,
  VerificationResult,
  BehavioralMismatch,
  SemanticSignal,
  RegressionSignal,
  StructuralSignal,
  ComplexitySignal,
  BehavioralSignal,
  ValidationSnapshot,
  ActionObservation,
  AgentStatus,
  CriterionType,
  VerificationTolerance,
  PlanValidation,
} from './types';

// Goal State
export {
  parseGoalFromMessage,
  updateGoalState,
  updateBehavioralCriterion,
  allCriteriaSatisfied,
  allStructuralCriteriaSatisfied,
  allBehavioralChecksPassed,
  hasBehavioralCriteria,
  getPendingBehavioralExpectations,
  countSatisfiedCriteria,
  getNextRecommendedAction,
  createGoal,
  addCriterion,
} from './goal-state';

// Semantic Signals
export {
  computeSemanticSignals,
  computeRegressionSignal,
  categorizeStructuralChange,
  computeComplexitySignal,
  computeBehavioralSignal,
  createDefaultSignals,
  createStructuralSignal,
  createSimpleComplexitySignal,
  createEmptyBehavioralSignal,
  formatSemanticSignals,
  formatSignalsCompact,
} from './semantic-signals';

// Behavioral Verification
export {
  verifyBehavior,
  aggregateResults,
  formatVerificationResult,
  formatVerificationForPrompt,
  buildSimulationInputs,
  portValuesToSimResult,
} from './behavioral-verification';

export type { SimulationResult } from './behavioral-verification';

// Expectation Generator
export {
  generateExpectationsFromGoal,
  createInverterExpectation,
  createCounterExpectation,
  createResetExpectation,
  createToggleExpectation,
  createAndGateExpectation,
  createOrGateExpectation,
  createXorGateExpectation,
  createCustomExpectation,
  createMappedInverterExpectation,
  extractPortHints,
  goalRequiresBehavioralVerification,
} from './expectation-generator';

// Agent Loop
export {
  runAgentLoop,
  AGENT_GUARDRAILS,
  validatePlanConsistency,
} from './agent-loop';

export type {
  AgentCallbacks,
  AgentCaller,
  AgentTurnContext,
} from './agent-loop';

// Turn Context
export {
  buildTurnContext,
  buildInitialContext,
  refreshContext,
} from './turn-context';

export type { TurnContextOptions } from './turn-context';

// Turn Summarizer
export {
  summarizeTurn,
  buildTurnHistory,
  summarizeTurnDetailed,
  getTurnStatistics,
} from './turn-summarizer';
