/**
 * Behavioral Verification
 *
 * Verifies circuit behavior against expected outputs.
 * Supports exact matching and eventually-consistent matching
 * for pipelined/sequential circuits.
 */

import type {
  BehavioralExpectation,
  VerificationResult,
  BehavioralMismatch,
} from './types';

// ============================================================================
// Simulation Result Interface
// ============================================================================

/**
 * Result from running a simulation.
 * Maps port names to arrays of values (one per cycle).
 */
export interface SimulationResult {
  /** Number of cycles run */
  cycles: number;
  /** Output values per port per cycle */
  outputs: Record<string, number[]>;
  /** Input values per port per cycle (for reference) */
  inputs?: Record<string, number[]>;
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Maximum latency cycles to check for "eventually" tolerance.
 */
const MAX_LATENCY = 5;

/**
 * Verify behavior against an expectation.
 */
export function verifyBehavior(
  expectation: BehavioralExpectation,
  simResult: SimulationResult
): VerificationResult {
  const tolerance = expectation.tolerance ?? 'exact';

  if (tolerance === 'eventually') {
    return verifyEventually(expectation, simResult);
  } else {
    return verifyExact(expectation, simResult);
  }
}

/**
 * Verify with exact cycle matching.
 */
function verifyExact(
  expectation: BehavioralExpectation,
  simResult: SimulationResult
): VerificationResult {
  const mismatches: BehavioralMismatch[] = [];

  for (let step = 0; step < expectation.expectedOutputs.length; step++) {
    const expected = expectation.expectedOutputs[step];

    for (const [port, expectedValue] of Object.entries(expected)) {
      const actualValues = simResult.outputs[port];
      if (!actualValues || actualValues.length <= step) {
        mismatches.push({
          step,
          port,
          expected: expectedValue,
          actual: -1, // Indicate missing
        });
        continue;
      }

      const actualValue = actualValues[step];
      if (actualValue !== expectedValue) {
        mismatches.push({
          step,
          port,
          expected: expectedValue,
          actual: actualValue,
        });
      }
    }
  }

  return {
    passed: mismatches.length === 0,
    expectationId: expectation.id,
    mismatches,
  };
}

/**
 * Verify with eventually-consistent matching.
 * Allows output to appear within MAX_LATENCY cycles.
 */
function verifyEventually(
  expectation: BehavioralExpectation,
  simResult: SimulationResult
): VerificationResult {
  // Try different offsets
  for (let offset = 0; offset <= MAX_LATENCY; offset++) {
    const result = verifyWithOffset(expectation, simResult, offset);
    if (result.passed) {
      return result;
    }
  }

  // If no offset worked, return the offset=0 result for error reporting
  return verifyWithOffset(expectation, simResult, 0);
}

/**
 * Verify with a specific cycle offset.
 */
function verifyWithOffset(
  expectation: BehavioralExpectation,
  simResult: SimulationResult,
  offset: number
): VerificationResult {
  const mismatches: BehavioralMismatch[] = [];

  for (let step = 0; step < expectation.expectedOutputs.length; step++) {
    const expected = expectation.expectedOutputs[step];
    const actualStep = step + offset;

    for (const [port, expectedValue] of Object.entries(expected)) {
      const actualValues = simResult.outputs[port];
      if (!actualValues || actualValues.length <= actualStep) {
        mismatches.push({
          step,
          port,
          expected: expectedValue,
          actual: -1,
        });
        continue;
      }

      const actualValue = actualValues[actualStep];
      if (actualValue !== expectedValue) {
        mismatches.push({
          step,
          port,
          expected: expectedValue,
          actual: actualValue,
        });
      }
    }
  }

  return {
    passed: mismatches.length === 0,
    expectationId: expectation.id,
    mismatches,
  };
}

// ============================================================================
// Result Aggregation
// ============================================================================

/**
 * Aggregate multiple verification results.
 */
export function aggregateResults(results: VerificationResult[]): {
  allPassed: boolean;
  totalPassed: number;
  totalFailed: number;
  allMismatches: BehavioralMismatch[];
} {
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const allMismatches = results.flatMap((r) => r.mismatches);

  return {
    allPassed: totalFailed === 0,
    totalPassed,
    totalFailed,
    allMismatches,
  };
}

// ============================================================================
// Result Formatting
// ============================================================================

/**
 * Format verification result for display.
 */
export function formatVerificationResult(result: VerificationResult): string {
  if (result.passed) {
    return `Expectation '${result.expectationId}': PASSED`;
  }

  const lines = [`Expectation '${result.expectationId}': FAILED`];
  for (const m of result.mismatches.slice(0, 5)) {
    lines.push(`  Step ${m.step}: ${m.port} expected=${m.expected}, actual=${m.actual}`);
  }
  if (result.mismatches.length > 5) {
    lines.push(`  (+${result.mismatches.length - 5} more mismatches)`);
  }

  return lines.join('\n');
}

/**
 * Format verification results for LLM context.
 */
export function formatVerificationForPrompt(results: VerificationResult[]): string {
  if (results.length === 0) {
    return '## Behavioral Verification\nNo verifications run yet.';
  }

  const lines = ['## Behavioral Verification', ''];
  const { allPassed, totalPassed, totalFailed, allMismatches } = aggregateResults(results);

  if (allPassed) {
    lines.push(`Status: ALL PASSED (${totalPassed} verification(s))`);
  } else {
    lines.push(`Status: FAILED (${totalPassed} passed, ${totalFailed} failed)`);
    lines.push('');
    lines.push('Mismatches:');
    for (const m of allMismatches.slice(0, 5)) {
      lines.push(`  - Step ${m.step}: ${m.port} expected=${m.expected}, actual=${m.actual}`);
    }
    if (allMismatches.length > 5) {
      lines.push(`  (+${allMismatches.length - 5} more)`);
    }
    lines.push('');
    lines.push('Action needed: Fix circuit logic or connections');
  }

  return lines.join('\n');
}

// ============================================================================
// Simulation Helpers
// ============================================================================

/**
 * Apply input sequence and collect outputs.
 * This is a helper for when we need to drive simulation manually.
 */
export function buildSimulationInputs(
  expectation: BehavioralExpectation
): Record<string, number>[] {
  return expectation.inputSequence;
}

/**
 * Convert port values map to simulation result format.
 */
export function portValuesToSimResult(
  portValues: Map<string, number | boolean>,
  cycles: number
): SimulationResult {
  const outputs: Record<string, number[]> = {};

  for (const [key, value] of portValues) {
    // Convert boolean to number
    const numValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;

    // Initialize array if needed
    if (!outputs[key]) {
      outputs[key] = [];
    }

    // For single-cycle simulation, we just have one value
    outputs[key].push(numValue);
  }

  return {
    cycles,
    outputs,
  };
}
