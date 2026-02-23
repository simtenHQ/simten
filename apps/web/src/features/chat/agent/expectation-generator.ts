/**
 * Expectation Generator
 *
 * Auto-generates behavioral expectations from user goals.
 * Uses pattern matching to infer expected circuit behavior.
 */

import type { BehavioralExpectation } from './types';
import type { GoalState } from './types';

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Patterns for recognizing behavioral goals.
 */
const BEHAVIOR_PATTERNS = {
  // Inverter patterns
  invert: /\b(invert|opposite|negate|flip)\b.*\b(switch|input|sw|in)\b/i,
  invertLED: /\b(led|light|output)\b.*\b(invert|opposite|flip)\b.*\b(switch|input|sw)\b/i,
  switchToLED: /\b(switch|sw)\b.*\bto\b.*\b(led|light)\b/i,

  // Counter patterns
  counter: /\b(counter|count|increment)\b/i,
  decrement: /\b(decrement|count down)\b/i,

  // Register patterns
  register: /\b(register|store|latch|hold)\b/i,
  reset: /\b(reset|clear|zero)\b/i,

  // Logic patterns
  andGate: /\b(and)\b.*\b(gate|logic)\b/i,
  orGate: /\b(or)\b.*\b(gate|logic)\b/i,
  xorGate: /\b(xor)\b.*\b(gate|logic)\b/i,

  // Toggle/flip-flop
  toggle: /\b(toggle|flip)\b.*\b(each|every|on)\b.*\b(clock|cycle|press)\b/i,
};

// ============================================================================
// Expectation Generation
// ============================================================================

/**
 * Generate behavioral expectations from a goal state.
 */
export function generateExpectationsFromGoal(
  goalState: GoalState
): BehavioralExpectation[] {
  const expectations: BehavioralExpectation[] = [];
  const description = goalState.description.toLowerCase();

  // Check for inverter behavior
  if (
    BEHAVIOR_PATTERNS.invert.test(description) ||
    BEHAVIOR_PATTERNS.invertLED.test(description) ||
    description.includes('inverter')
  ) {
    expectations.push(createInverterExpectation());
  }

  // Check for counter behavior
  if (BEHAVIOR_PATTERNS.counter.test(description)) {
    expectations.push(createCounterExpectation());
  }

  // Check for reset behavior
  if (BEHAVIOR_PATTERNS.reset.test(description)) {
    expectations.push(createResetExpectation());
  }

  // Check for toggle behavior
  if (BEHAVIOR_PATTERNS.toggle.test(description)) {
    expectations.push(createToggleExpectation());
  }

  // Check for basic logic gate tests
  if (BEHAVIOR_PATTERNS.andGate.test(description)) {
    expectations.push(createAndGateExpectation());
  }

  if (BEHAVIOR_PATTERNS.orGate.test(description)) {
    expectations.push(createOrGateExpectation());
  }

  if (BEHAVIOR_PATTERNS.xorGate.test(description)) {
    expectations.push(createXorGateExpectation());
  }

  return expectations;
}

// ============================================================================
// Pre-defined Expectations
// ============================================================================

/**
 * Create expectation for inverter behavior.
 * Input 0 -> Output 1, Input 1 -> Output 0
 */
export function createInverterExpectation(): BehavioralExpectation {
  return {
    id: 'inverter-behavior',
    description: 'Output inverts input state',
    inputSequence: [{ sw: 0 }, { sw: 1 }],
    expectedOutputs: [{ led: 1 }, { led: 0 }],
    tolerance: 'exact',
  };
}

/**
 * Create expectation for counter behavior.
 * Output increments each clock cycle.
 */
export function createCounterExpectation(): BehavioralExpectation {
  return {
    id: 'counter-behavior',
    description: 'Counter increments each cycle',
    inputSequence: [{}, {}, {}, {}], // 4 clock cycles
    expectedOutputs: [
      { count: 0 },
      { count: 1 },
      { count: 2 },
      { count: 3 },
    ],
    tolerance: 'eventually',
  };
}

/**
 * Create expectation for reset behavior.
 * Reset signal clears output to zero.
 */
export function createResetExpectation(): BehavioralExpectation {
  return {
    id: 'reset-behavior',
    description: 'Reset clears output to zero',
    inputSequence: [{ rst: 0, en: 1 }, { rst: 1, en: 1 }, { rst: 0, en: 1 }],
    expectedOutputs: [{ out: 1 }, { out: 0 }, { out: 0 }],
    tolerance: 'eventually',
  };
}

/**
 * Create expectation for toggle behavior.
 * Output toggles on each clock edge.
 */
export function createToggleExpectation(): BehavioralExpectation {
  return {
    id: 'toggle-behavior',
    description: 'Output toggles each clock cycle',
    inputSequence: [{}, {}, {}, {}],
    expectedOutputs: [
      { out: 0 },
      { out: 1 },
      { out: 0 },
      { out: 1 },
    ],
    tolerance: 'eventually',
  };
}

/**
 * Create expectation for AND gate truth table.
 */
export function createAndGateExpectation(): BehavioralExpectation {
  return {
    id: 'and-gate-behavior',
    description: 'AND gate truth table',
    inputSequence: [
      { a: 0, b: 0 },
      { a: 0, b: 1 },
      { a: 1, b: 0 },
      { a: 1, b: 1 },
    ],
    expectedOutputs: [
      { out: 0 },
      { out: 0 },
      { out: 0 },
      { out: 1 },
    ],
    tolerance: 'exact',
  };
}

/**
 * Create expectation for OR gate truth table.
 */
export function createOrGateExpectation(): BehavioralExpectation {
  return {
    id: 'or-gate-behavior',
    description: 'OR gate truth table',
    inputSequence: [
      { a: 0, b: 0 },
      { a: 0, b: 1 },
      { a: 1, b: 0 },
      { a: 1, b: 1 },
    ],
    expectedOutputs: [
      { out: 0 },
      { out: 1 },
      { out: 1 },
      { out: 1 },
    ],
    tolerance: 'exact',
  };
}

/**
 * Create expectation for XOR gate truth table.
 */
export function createXorGateExpectation(): BehavioralExpectation {
  return {
    id: 'xor-gate-behavior',
    description: 'XOR gate truth table',
    inputSequence: [
      { a: 0, b: 0 },
      { a: 0, b: 1 },
      { a: 1, b: 0 },
      { a: 1, b: 1 },
    ],
    expectedOutputs: [
      { out: 0 },
      { out: 1 },
      { out: 1 },
      { out: 0 },
    ],
    tolerance: 'exact',
  };
}

// ============================================================================
// Custom Expectation Builders
// ============================================================================

/**
 * Create a custom expectation with specific inputs and outputs.
 */
export function createCustomExpectation(
  id: string,
  description: string,
  inputSequence: Record<string, number>[],
  expectedOutputs: Record<string, number>[],
  tolerance: 'exact' | 'eventually' = 'exact'
): BehavioralExpectation {
  return {
    id,
    description,
    inputSequence,
    expectedOutputs,
    tolerance,
  };
}

/**
 * Create expectations for a specific port mapping.
 * Useful when port names differ from defaults.
 */
export function createMappedInverterExpectation(
  inputPort: string,
  outputPort: string
): BehavioralExpectation {
  return {
    id: 'mapped-inverter-behavior',
    description: `${outputPort} inverts ${inputPort} state`,
    inputSequence: [
      { [inputPort]: 0 },
      { [inputPort]: 1 },
    ],
    expectedOutputs: [
      { [outputPort]: 1 },
      { [outputPort]: 0 },
    ],
    tolerance: 'exact',
  };
}

// ============================================================================
// Goal Analysis Helpers
// ============================================================================

/**
 * Extract likely port names from goal description.
 */
export function extractPortHints(goalDescription: string): {
  inputs: string[];
  outputs: string[];
} {
  const inputs: string[] = [];
  const outputs: string[] = [];

  const desc = goalDescription.toLowerCase();

  // Common input names
  if (desc.includes('switch') || desc.includes('sw')) {
    inputs.push('sw');
  }
  if (desc.includes('button') || desc.includes('btn')) {
    inputs.push('btn');
  }
  if (desc.includes('input') || desc.includes('in')) {
    inputs.push('in');
  }
  if (desc.includes('clock') || desc.includes('clk')) {
    inputs.push('clk');
  }

  // Common output names
  if (desc.includes('led') || desc.includes('light')) {
    outputs.push('led');
  }
  if (desc.includes('output') || desc.includes('out')) {
    outputs.push('out');
  }
  if (desc.includes('display')) {
    outputs.push('display');
  }

  return { inputs, outputs };
}

/**
 * Check if goal has behavioral component.
 */
export function goalRequiresBehavioralVerification(goalDescription: string): boolean {
  const desc = goalDescription.toLowerCase();

  // Check for behavioral keywords
  const behavioralKeywords = [
    'should',
    'when',
    'if',
    'output',
    'invert',
    'toggle',
    'increment',
    'reset',
    'show',
    'display',
  ];

  return behavioralKeywords.some((kw) => desc.includes(kw));
}
