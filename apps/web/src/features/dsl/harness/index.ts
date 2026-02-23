/**
 * Harness Generator Module
 *
 * Deterministic test harness generation for circuits.
 */

export {
  generateHarness,
  generateHarnessDSL,
  generateHarnessAppended,
  analyzeForHarness,
  extractCircuitInterface,
  isHarnessName,
  type CircuitInterface,
  type PortInfo,
  type HarnessAnalysis,
} from './harness-generator';

export {
  evaluateAssertions,
  formatAssertionSummary,
  allAssertionsPassed,
  getFailedResults,
  type AssertionEvalResult,
  type AssertionSummary,
} from './assertion-evaluator';
