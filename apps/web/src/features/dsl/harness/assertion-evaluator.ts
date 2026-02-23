/**
 * Assertion Evaluator
 *
 * Given a compiled testbench with assertions and a SimulationTrace,
 * evaluates each assertion against the signal values captured at the
 * specified cycles and produces structured pass/fail results.
 *
 * Design Principles:
 * - Pure function: trace in, results out — no side effects
 * - Every cycle in every assertion produces exactly one AssertionEvalResult
 * - Unknown signals produce a fail with a descriptive message
 * - Deterministic ordering: assertions sorted by cycle then insertion order
 */

import type { Testbench } from '../../visual-editor/types/testbench';
import type { SimulationTrace } from '../analysis/types';
import type { BitValue, BusValue } from '../../../core/simulator/types';

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of evaluating a single compiled assertion at a specific cycle.
 */
export interface AssertionEvalResult {
  /** Unique assertion ID from CompiledAssertion.id */
  assertionId: string;
  /** Cycle the assertion was checked at */
  cycle: number;
  /** Whether the condition held true */
  passed: boolean;
  /** Human-readable description of the outcome */
  message: string;
  /**
   * Actual signal values that were present at this cycle.
   * Maps signal name -> value for all signals referenced in the condition.
   */
  actualValues: Record<string, number | boolean>;
}

/**
 * Aggregate result of evaluating all assertions in a testbench against a trace.
 */
export interface AssertionSummary {
  /** Total assertions evaluated */
  total: number;
  /** Number that passed */
  passed: number;
  /** Number that failed */
  failed: number;
  /** Whether all assertions passed */
  allPassed: boolean;
  /** Individual results, sorted by cycle */
  results: AssertionEvalResult[];
  /** First failure (undefined if all passed) */
  firstFailure?: AssertionEvalResult;
}

// ============================================================================
// Main Evaluator
// ============================================================================

/**
 * Evaluate all assertions in a compiled testbench against a simulation trace.
 *
 * The trace provides the signal values at every sampled cycle.  Each compiled
 * assertion is a function `(state: TestbenchState) => boolean`; since we do
 * not have a live TestbenchState we reconstruct a minimal state from the
 * trace's signal values at the target cycle.
 *
 * @param testbench - Compiled testbench (must have assertions)
 * @param trace - Simulation trace produced by simulateCircuit
 * @returns Structured pass/fail summary with per-assertion results
 */
export function evaluateAssertions(
  testbench: Testbench,
  trace: SimulationTrace
): AssertionSummary {
  if (!testbench.assertions) {
    return buildSummary([]);
  }

  const results: AssertionEvalResult[] = [];

  // Process cycles in ascending order for deterministic output
  const sortedCycles = Array.from(testbench.assertions.assertions.keys()).sort(
    (a, b) => a - b
  );

  for (const cycle of sortedCycles) {
    const assertionsAtCycle = testbench.assertions.assertions.get(cycle)!;

    // Extract signal values at this cycle from the trace
    const portValues = extractPortValuesAtCycle(trace, cycle);

    // Build a minimal TestbenchState for the condition closures
    const minimalState = {
      cycle,
      portValues,
      assertionResults: [],
      status: 'running' as const,
    };

    for (const compiledAssertion of assertionsAtCycle) {
      let passed: boolean;
      let message: string;

      try {
        passed = compiledAssertion.condition(minimalState);
        message = passed
          ? compiledAssertion.message
          : `FAIL: ${compiledAssertion.message}`;
      } catch (err) {
        // If condition evaluation throws (e.g. unknown signal), treat as failure
        passed = false;
        message = `FAIL: ${compiledAssertion.message} — evaluation error: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }

      results.push({
        assertionId: compiledAssertion.id,
        cycle,
        passed,
        message,
        actualValues: portValuesToRecord(portValues),
      });
    }
  }

  return buildSummary(results);
}

// ============================================================================
// Trace Signal Extraction
// ============================================================================

/**
 * Extract all signal values at a specific cycle from a SimulationTrace.
 *
 * The trace may have been sampled at intervals (sampleRate > 1); in that case
 * we find the nearest sampled cycle at or before the requested cycle.
 *
 * @param trace - The simulation trace
 * @param cycle - The target cycle number
 * @returns Map of signal name -> value for all captured signals at that cycle
 */
function extractPortValuesAtCycle(
  trace: SimulationTrace,
  cycle: number
): Map<string, number | boolean> {
  const portValues = new Map<string, number | boolean>();

  // Resolve the closest sampled cycle index
  const traceIndex = resolveTraceIndex(trace, cycle);

  // Extract from signals
  for (const [signalName, values] of Object.entries(trace.signals)) {
    if (traceIndex < values.length) {
      portValues.set(signalName, normalizeValue(values[traceIndex]));
    }
  }

  // Extract from registers (make them accessible by name as well)
  for (const [registerName, values] of Object.entries(trace.registers)) {
    if (traceIndex < values.length) {
      portValues.set(registerName, normalizeValue(values[traceIndex]));
    }
  }

  return portValues;
}

/**
 * Resolve the trace array index for the given cycle.
 *
 * If sampleRate is 1 (every cycle sampled), index = cycle directly.
 * If the cycle was not sampled, we use the closest sampled cycle before it.
 */
function resolveTraceIndex(trace: SimulationTrace, cycle: number): number {
  const { sampledCycles } = trace;

  if (sampledCycles.length === 0) {
    return 0;
  }

  // Fast path: sampleRate 1 means sampledCycles[i] === i
  if (trace.sampleRate === 1) {
    return Math.min(cycle, sampledCycles.length - 1);
  }

  // Binary search for the largest sampled cycle <= requested cycle
  let lo = 0;
  let hi = sampledCycles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sampledCycles[mid] <= cycle) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Normalize a BitValue | BusValue to number | boolean for condition evaluation.
 *
 * BitValue is 0 | 1, BusValue is a number.  We convert:
 * - 0 -> false (BitValue low)
 * - 1 -> true  (BitValue high)
 * - number -> number (BusValue)
 *
 * In practice the condition compiler handles both numeric and boolean
 * comparisons, so returning numbers for everything is safe and consistent
 * with how the stimulus evaluator works.
 */
function normalizeValue(value: BitValue | BusValue): number | boolean {
  if (typeof value === 'number') {
    return value;
  }
  // boolean BitValue
  return value ? 1 : 0;
}

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Convert a portValues Map to a plain Record for JSON-serializable output.
 */
function portValuesToRecord(
  portValues: Map<string, number | boolean>
): Record<string, number | boolean> {
  const record: Record<string, number | boolean> = {};
  for (const [key, value] of portValues) {
    record[key] = value;
  }
  return record;
}

/**
 * Build an AssertionSummary from an array of individual results.
 */
function buildSummary(results: AssertionEvalResult[]): AssertionSummary {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const firstFailure = results.find(r => !r.passed);

  return {
    total: results.length,
    passed,
    failed,
    allPassed: failed === 0,
    results,
    firstFailure,
  };
}

// ============================================================================
// Convenience: Evaluate from DSL AST (without a pre-compiled testbench)
// ============================================================================

/**
 * Format an AssertionSummary as a human-readable string for LLM consumption
 * or CLI output.
 *
 * Example output:
 * ```
 * Assertion Results: 3/4 passed
 *   PASS cycle=5  assert_0_cycle_5
 *   PASS cycle=10 assert_1_cycle_10
 *   FAIL cycle=15 assert_2_cycle_15 — FAIL: Output should be stable after reset
 *   PASS cycle=20 assert_3_cycle_20
 * ```
 */
export function formatAssertionSummary(summary: AssertionSummary): string {
  const lines: string[] = [];
  lines.push(
    `Assertion Results: ${summary.passed}/${summary.total} passed` +
      (summary.allPassed ? ' — ALL PASSED' : ` — ${summary.failed} FAILED`)
  );

  for (const result of summary.results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const paddedCycle = String(result.cycle).padStart(4, ' ');
    lines.push(`  ${status} cycle=${paddedCycle}  ${result.assertionId}: ${result.message}`);
  }

  return lines.join('\n');
}

/**
 * Check whether all assertions in a summary passed.
 * Convenience re-export for consumers that only need a boolean.
 */
export function allAssertionsPassed(summary: AssertionSummary): boolean {
  return summary.allPassed;
}

/**
 * Get all failed assertion results from a summary.
 */
export function getFailedResults(summary: AssertionSummary): AssertionEvalResult[] {
  return summary.results.filter(r => !r.passed);
}
