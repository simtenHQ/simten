/**
 * Goal State Management
 *
 * Parses user messages into structured GoalState and tracks
 * criterion satisfaction as the agent executes actions.
 *
 * Key insight: Explicit goals prevent the LLM from prematurely
 * claiming completion based on "vibes" - it must satisfy a checklist.
 */

import type {
  GoalState,
  SuccessCriterion,
  CriterionStatus,
  ActionObservation,
  BehavioralExpectation,
} from './types';

// ============================================================================
// Goal Parsing
// ============================================================================

/**
 * Common patterns for inferring goals from user messages.
 */
const GOAL_PATTERNS = {
  add: /\b(add|insert|create|put)\b.*\b(inverter|buffer|gate|register|mux|and|or|xor|not|nand|nor)\b/i,
  fix: /\b(fix|repair|resolve|debug|correct)\b/i,
  connect: /\b(connect|wire|link|join)\b.*\b(to|with|between)\b/i,
  remove: /\b(remove|delete|drop)\b/i,
  optimize: /\b(optimize|improve|speed|faster|reduce)\b/i,
  invert: /\b(invert|opposite|negate|flip)\b/i,
  behavior: /\b(should|when|if|toggle|output)\b.*\b(show|display|be|equal|invert)\b/i,
  verify: /\b(verify|test|assert|prove|check|count|counter)\b/i,
};

/**
 * Parse a user message into structured GoalState.
 * Infers success criteria from the message content.
 */
export function parseGoalFromMessage(userMessage: string): GoalState {
  const criteria: SuccessCriterion[] = [];
  const lowerMessage = userMessage.toLowerCase();

  // Always add: no validation errors
  criteria.push({
    id: 'no-errors',
    description: 'No validation errors',
    type: 'validation',
    verifiable: true,
  });

  // Detect add/insert patterns
  if (GOAL_PATTERNS.add.test(lowerMessage)) {
    const match = lowerMessage.match(GOAL_PATTERNS.add);
    const componentType = match?.[2] ?? 'component';

    criteria.push({
      id: 'has-component',
      description: `Circuit contains ${componentType}`,
      type: 'structural',
      verifiable: true,
    });
  }

  // Detect inverter-specific pattern
  if (lowerMessage.includes('inverter') || GOAL_PATTERNS.invert.test(lowerMessage)) {
    criteria.push({
      id: 'inverter-connected',
      description: 'Inverter is properly connected',
      type: 'structural',
      verifiable: true,
    });
  }

  // Detect behavioral requirements
  if (GOAL_PATTERNS.behavior.test(lowerMessage) || GOAL_PATTERNS.invert.test(lowerMessage)) {
    criteria.push({
      id: 'behavior-verified',
      description: 'Behavioral expectations pass',
      type: 'behavioral',
      verifiable: true,
    });
  }

  // Detect verification/assertion patterns
  if (GOAL_PATTERNS.verify.test(lowerMessage)) {
    criteria.push({
      id: 'assertion-coverage',
      description: 'All testbench assertions pass',
      type: 'behavioral',
      verifiable: true,
    });
  }

  // Detect fix/debug patterns
  if (GOAL_PATTERNS.fix.test(lowerMessage)) {
    criteria.push({
      id: 'errors-resolved',
      description: 'All errors have been resolved',
      type: 'validation',
      verifiable: true,
    });
  }

  // Detect connection patterns
  if (GOAL_PATTERNS.connect.test(lowerMessage)) {
    criteria.push({
      id: 'connection-made',
      description: 'Components are connected as specified',
      type: 'structural',
      verifiable: true,
    });
  }

  // Initialize all criteria as unsatisfied
  const currentStatus: CriterionStatus[] = criteria.map((c) => ({
    criterionId: c.id,
    satisfied: false,
    lastChecked: 0,
  }));

  return {
    description: userMessage,
    successCriteria: criteria,
    currentStatus,
  };
}

// ============================================================================
// Goal State Updates
// ============================================================================

/**
 * Update goal state based on an action observation.
 */
export function updateGoalState(
  goalState: GoalState,
  observation: ActionObservation,
  turnNumber: number
): void {
  const { validationAfter, verificationResults } = observation;

  // Update no-errors criterion
  updateCriterion(goalState, 'no-errors', {
    satisfied: validationAfter.errors === 0,
    evidence: validationAfter.errors === 0
      ? 'No validation errors'
      : `${validationAfter.errors} error(s) remaining`,
    lastChecked: turnNumber,
  });

  // Update errors-resolved criterion (same as no-errors for now)
  updateCriterion(goalState, 'errors-resolved', {
    satisfied: validationAfter.errors === 0,
    evidence: validationAfter.errors === 0
      ? 'All errors resolved'
      : `${validationAfter.errors} error(s) remaining`,
    lastChecked: turnNumber,
  });

  // Update behavioral criterion if we have verification results
  if (verificationResults && verificationResults.length > 0) {
    const allPassed = verificationResults.every((r) => r.passed);
    const failedCount = verificationResults.filter((r) => !r.passed).length;

    updateCriterion(goalState, 'behavior-verified', {
      satisfied: allPassed,
      evidence: allPassed
        ? 'All behavioral expectations pass'
        : `${failedCount} behavioral check(s) failed`,
      lastChecked: turnNumber,
    });
  }

  // Update assertion-coverage criterion from VERIFY_ASSERTION results
  if (observation.assertionResults) {
    const { allPassed, passed, total } = observation.assertionResults;
    updateCriterion(goalState, 'assertion-coverage', {
      satisfied: allPassed,
      evidence: allPassed
        ? `All ${total} assertions pass`
        : `${passed}/${total} assertions pass`,
      lastChecked: turnNumber,
    });
  }

  // Update structural criteria from applied code (after SHOW_DIFF / INSERT_NODE)
  const code = observation.appliedCode;
  if (code) {
    // has-component: check if the expected component type exists in code
    const hasComponentCriterion = goalState.successCriteria.find(c => c.id === 'has-component');
    if (hasComponentCriterion) {
      // Extract component name from description (e.g., "Circuit contains inverter")
      const descMatch = hasComponentCriterion.description.match(/contains?\s+(.+)/i);
      const componentName = descMatch?.[1]?.trim() ?? '';
      // Check for the component in DSL code (component instantiation or type reference)
      const nameVariants = [componentName, componentName.toUpperCase(), componentName.charAt(0).toUpperCase() + componentName.slice(1)];
      const found = nameVariants.some(name => code.includes(name));
      updateCriterion(goalState, 'has-component', {
        satisfied: found,
        evidence: found ? `Code contains ${componentName}` : `${componentName} not found in code`,
        lastChecked: turnNumber,
      });
    }

    // inverter-connected: check for connection statements involving NOT/inverter
    const inverterCriterion = goalState.successCriteria.find(c => c.id === 'inverter-connected');
    if (inverterCriterion) {
      // Look for NOT/Inverter component AND a connection wiring it
      const hasInverter = /\bNot\b|\bNOT\b|\binverter\b/i.test(code);
      const hasConnection = /->/.test(code);
      const connected = hasInverter && hasConnection;
      updateCriterion(goalState, 'inverter-connected', {
        satisfied: connected,
        evidence: connected ? 'Inverter is wired in the circuit' : 'Inverter not yet connected',
        lastChecked: turnNumber,
      });
    }

    // connection-made: check for any connection statements
    const connectionCriterion = goalState.successCriteria.find(c => c.id === 'connection-made');
    if (connectionCriterion) {
      const hasConnections = /->/.test(code);
      updateCriterion(goalState, 'connection-made', {
        satisfied: hasConnections,
        evidence: hasConnections ? 'Connections found in code' : 'No connections in code',
        lastChecked: turnNumber,
      });
    }
  }
}

/**
 * Update a specific criterion in the goal state.
 */
function updateCriterion(
  goalState: GoalState,
  criterionId: string,
  update: Partial<CriterionStatus>
): void {
  const status = goalState.currentStatus.find((s) => s.criterionId === criterionId);
  if (status) {
    Object.assign(status, update);
  }
}

/**
 * Update behavioral criterion based on verification results.
 */
export function updateBehavioralCriterion(
  goalState: GoalState,
  expectationId: string,
  passed: boolean
): void {
  const status = goalState.currentStatus.find(
    (s) => s.criterionId === 'behavior-verified'
  );
  if (status) {
    // Only mark as satisfied if passed, otherwise keep current state
    // This handles multiple behavioral checks
    if (passed && !status.satisfied) {
      status.satisfied = true;
      status.evidence = `Behavioral check ${expectationId} passed`;
    } else if (!passed) {
      status.satisfied = false;
      status.evidence = `Behavioral check ${expectationId} failed`;
    }
  }
}

// ============================================================================
// Criterion Checking
// ============================================================================

/**
 * Check if all success criteria are satisfied.
 */
export function allCriteriaSatisfied(goalState: GoalState): boolean {
  return goalState.currentStatus.every((s) => s.satisfied);
}

/**
 * Check if all structural criteria are satisfied.
 */
export function allStructuralCriteriaSatisfied(goalState: GoalState): boolean {
  const structuralIds = new Set(
    goalState.successCriteria
      .filter((c) => c.type === 'structural' || c.type === 'validation')
      .map((c) => c.id)
  );

  return goalState.currentStatus
    .filter((s) => structuralIds.has(s.criterionId))
    .every((s) => s.satisfied);
}

/**
 * Check if all behavioral checks have passed.
 */
export function allBehavioralChecksPassed(goalState: GoalState): boolean {
  const behavioralCriteria = goalState.currentStatus.filter(
    (s) => s.criterionId === 'behavior-verified' || s.criterionId === 'assertion-coverage'
  );

  // If no behavioral criteria exist, consider them passed
  if (behavioralCriteria.length === 0) {
    return true;
  }

  return behavioralCriteria.every((s) => s.satisfied);
}

/**
 * Check if any behavioral criteria exist.
 */
export function hasBehavioralCriteria(goalState: GoalState): boolean {
  return goalState.successCriteria.some((c) => c.type === 'behavioral');
}

/**
 * Get pending behavioral expectations that need verification.
 */
export function getPendingBehavioralExpectations(
  goalState: GoalState,
  allExpectations: BehavioralExpectation[]
): BehavioralExpectation[] {
  // If behavioral criterion is already satisfied, no pending expectations
  const behavioralStatus = goalState.currentStatus.find(
    (s) => s.criterionId === 'behavior-verified'
  );

  if (!behavioralStatus || behavioralStatus.satisfied) {
    return [];
  }

  // Return all expectations (in a more sophisticated implementation,
  // we'd track which specific expectations have been verified)
  return allExpectations;
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Count satisfied criteria.
 */
export function countSatisfiedCriteria(goalState: GoalState): {
  satisfied: number;
  total: number;
} {
  const satisfied = goalState.currentStatus.filter((s) => s.satisfied).length;
  return { satisfied, total: goalState.currentStatus.length };
}

/**
 * Get the next recommended action based on unsatisfied criteria.
 */
export function getNextRecommendedAction(goalState: GoalState): string {
  // Find first unsatisfied criterion
  for (const status of goalState.currentStatus) {
    if (!status.satisfied) {
      const criterion = goalState.successCriteria.find(
        (c) => c.id === status.criterionId
      );

      if (criterion) {
        switch (criterion.type) {
          case 'validation':
            return 'Fix validation errors using SHOW_DIFF';
          case 'structural':
            return 'Make structural changes using SHOW_DIFF';
          case 'behavioral':
            return 'Run simulation to verify behavior';
          default:
            return 'Continue working on the goal';
        }
      }
    }
  }

  return 'All criteria satisfied';
}

// ============================================================================
// Goal Creation Helpers
// ============================================================================

/**
 * Create a goal with pre-defined criteria (for testing).
 */
export function createGoal(criteria: Array<{
  id: string;
  description: string;
  type?: 'validation' | 'structural' | 'behavioral' | 'custom';
  satisfied?: boolean;
}>): GoalState {
  const successCriteria: SuccessCriterion[] = criteria.map((c) => ({
    id: c.id,
    description: c.description,
    type: c.type ?? 'custom',
    verifiable: true,
  }));

  const currentStatus: CriterionStatus[] = criteria.map((c) => ({
    criterionId: c.id,
    satisfied: c.satisfied ?? false,
    lastChecked: 0,
  }));

  return {
    description: 'Test goal',
    successCriteria,
    currentStatus,
  };
}

/**
 * Add a criterion to an existing goal state.
 */
export function addCriterion(
  goalState: GoalState,
  criterion: SuccessCriterion,
  initialSatisfied = false
): void {
  goalState.successCriteria.push(criterion);
  goalState.currentStatus.push({
    criterionId: criterion.id,
    satisfied: initialSatisfied,
    lastChecked: 0,
  });
}
