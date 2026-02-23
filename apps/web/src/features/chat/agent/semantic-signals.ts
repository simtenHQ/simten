/**
 * Semantic Signals
 *
 * Computes structured signals from action observations.
 * LLMs reason better over "Regression: YES" than parsing raw validation diffs.
 *
 * Signals include:
 * - Regression detection (did changes make things worse?)
 * - Structural categorization (minor/moderate/major change)
 * - Complexity rating
 * - Behavioral verification status
 */

import type {
  SemanticSignal,
  RegressionSignal,
  StructuralSignal,
  ComplexitySignal,
  BehavioralSignal,
  ValidationSnapshot,
  VerificationResult,
  BehavioralMismatch,
} from './types';

// ============================================================================
// Default Signals
// ============================================================================

/**
 * Create default (neutral) semantic signals.
 */
export function createDefaultSignals(): SemanticSignal {
  return {
    regression: {
      isRegression: false,
      errorDelta: 0,
      blockingStatusChanged: false,
      severity: 'improvement',
    },
    structural: {
      changeType: 'minor',
      nodeCountDelta: 0,
      depthChange: 0,
      registersAdded: 0,
    },
    complexity: {
      score: 0,
      rating: 'simple',
    },
    behavioral: {
      verificationsRun: 0,
      passed: 0,
      failed: 0,
      mismatches: [],
    },
  };
}

// ============================================================================
// Regression Signal
// ============================================================================

/**
 * Compute regression signal from validation state changes.
 */
export function computeRegressionSignal(
  before: ValidationSnapshot,
  after: ValidationSnapshot
): RegressionSignal {
  const errorDelta = after.errors - before.errors;
  const blockingStatusChanged = before.canSimulate && !after.canSimulate;

  // Determine if this is a regression
  const isRegression = errorDelta > 0 || blockingStatusChanged;

  // Determine severity
  let severity: RegressionSignal['severity'];
  if (blockingStatusChanged) {
    severity = 'critical';
  } else if (errorDelta > 2) {
    severity = 'major';
  } else if (errorDelta > 0) {
    severity = 'minor';
  } else {
    severity = 'improvement';
  }

  return {
    isRegression,
    errorDelta,
    blockingStatusChanged,
    severity,
  };
}

// ============================================================================
// Structural Signal
// ============================================================================

/**
 * Structural change metrics from circuit delta.
 */
export interface StructuralDelta {
  nodeCountChange: number;
  combinationalDepthChange: number;
  registerCountChange: number;
  originalNodeCount?: number;
}

/**
 * Categorize structural change magnitude.
 */
export function categorizeStructuralChange(delta: StructuralDelta): StructuralSignal {
  const originalNodeCount = delta.originalNodeCount ?? 10;
  const nodeRatio = Math.abs(delta.nodeCountChange) / Math.max(originalNodeCount, 1);

  let changeType: StructuralSignal['changeType'];

  if (nodeRatio < 0.1 && delta.combinationalDepthChange === 0) {
    changeType = 'minor';
  } else if (nodeRatio < 0.5 || Math.abs(delta.combinationalDepthChange) < 5) {
    changeType = 'moderate';
  } else {
    changeType = 'major';
  }

  return {
    changeType,
    nodeCountDelta: delta.nodeCountChange,
    depthChange: delta.combinationalDepthChange,
    registersAdded: Math.max(0, delta.registerCountChange),
  };
}

/**
 * Create structural signal from simple node count change.
 */
export function createStructuralSignal(
  nodeCountDelta: number,
  depthChange = 0,
  registersAdded = 0
): StructuralSignal {
  return categorizeStructuralChange({
    nodeCountChange: nodeCountDelta,
    combinationalDepthChange: depthChange,
    registerCountChange: registersAdded,
  });
}

// ============================================================================
// Complexity Signal
// ============================================================================

/**
 * Metrics for complexity calculation.
 */
export interface ComplexityMetrics {
  nodeCount: number;
  combinationalDepth: number;
  registerCount: number;
  maxFanOut: number;
}

/**
 * Compute complexity signal from circuit metrics.
 */
export function computeComplexitySignal(metrics: ComplexityMetrics): ComplexitySignal {
  // Simple heuristic: weighted sum normalized to 0-100
  const nodeScore = Math.min(metrics.nodeCount * 2, 40);
  const depthScore = Math.min(metrics.combinationalDepth * 5, 30);
  const registerScore = Math.min(metrics.registerCount * 3, 20);
  const fanOutScore = Math.min(metrics.maxFanOut * 2, 10);

  const score = Math.min(100, nodeScore + depthScore + registerScore + fanOutScore);

  let rating: ComplexitySignal['rating'];
  if (score < 20) {
    rating = 'simple';
  } else if (score < 50) {
    rating = 'moderate';
  } else if (score < 80) {
    rating = 'complex';
  } else {
    rating = 'very_complex';
  }

  return { score, rating };
}

/**
 * Create a simple complexity signal from node count.
 */
export function createSimpleComplexitySignal(nodeCount: number): ComplexitySignal {
  return computeComplexitySignal({
    nodeCount,
    combinationalDepth: Math.ceil(Math.log2(nodeCount + 1)),
    registerCount: 0,
    maxFanOut: 2,
  });
}

// ============================================================================
// Behavioral Signal
// ============================================================================

/**
 * Compute behavioral signal from verification results.
 */
export function computeBehavioralSignal(
  results: VerificationResult[]
): BehavioralSignal {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const mismatches: BehavioralMismatch[] = results.flatMap((r) => r.mismatches);

  return {
    verificationsRun: results.length,
    passed,
    failed,
    mismatches,
  };
}

/**
 * Create an empty behavioral signal.
 */
export function createEmptyBehavioralSignal(): BehavioralSignal {
  return {
    verificationsRun: 0,
    passed: 0,
    failed: 0,
    mismatches: [],
  };
}

// ============================================================================
// Complete Signal Computation
// ============================================================================

/**
 * Options for computing semantic signals.
 */
export interface SignalComputationOptions {
  before: ValidationSnapshot;
  after: ValidationSnapshot;
  verificationResults?: VerificationResult[];
  structuralDelta?: StructuralDelta;
  complexityMetrics?: ComplexityMetrics;
}

/**
 * Compute complete semantic signals from observation data.
 */
export function computeSemanticSignals(
  options: SignalComputationOptions
): SemanticSignal {
  const { before, after, verificationResults, structuralDelta, complexityMetrics } =
    options;

  // Regression signal
  const regression = computeRegressionSignal(before, after);

  // Structural signal
  const structural = structuralDelta
    ? categorizeStructuralChange(structuralDelta)
    : createStructuralSignal(0);

  // Complexity signal
  const complexity = complexityMetrics
    ? computeComplexitySignal(complexityMetrics)
    : createSimpleComplexitySignal(0);

  // Behavioral signal
  const behavioral = verificationResults
    ? computeBehavioralSignal(verificationResults)
    : createEmptyBehavioralSignal();

  return {
    regression,
    structural,
    complexity,
    behavioral,
  };
}

// ============================================================================
// Signal Formatting (for prompt injection)
// ============================================================================

/**
 * Format semantic signals as markdown for LLM prompt.
 */
export function formatSemanticSignals(signals: SemanticSignal): string {
  const lines: string[] = [];

  lines.push('## Semantic Signals');
  lines.push('');

  // Regression
  const reg = signals.regression;
  if (reg.isRegression) {
    lines.push(`Regression: YES (${reg.severity.toUpperCase()})`);
    lines.push(`  - Error delta: ${reg.errorDelta > 0 ? '+' : ''}${reg.errorDelta}`);
    if (reg.blockingStatusChanged) {
      lines.push('  - BLOCKING: Circuit can no longer simulate!');
    }
  } else {
    lines.push('Regression: NO');
    if (reg.errorDelta < 0) {
      lines.push(`  - Errors reduced by ${Math.abs(reg.errorDelta)}`);
    }
  }
  lines.push('');

  // Structural
  const str = signals.structural;
  lines.push(`Structural Change: ${str.changeType.toUpperCase()}`);
  if (str.nodeCountDelta !== 0) {
    lines.push(`  - Nodes: ${str.nodeCountDelta > 0 ? '+' : ''}${str.nodeCountDelta}`);
  }
  if (str.depthChange !== 0) {
    lines.push(`  - Depth: ${str.depthChange > 0 ? '+' : ''}${str.depthChange}`);
  }
  if (str.registersAdded > 0) {
    lines.push(`  - Registers added: ${str.registersAdded}`);
  }
  lines.push('');

  // Complexity
  const cmp = signals.complexity;
  lines.push(`Complexity: ${cmp.score}/100 (${cmp.rating.toUpperCase()})`);
  lines.push('');

  // Behavioral
  const beh = signals.behavioral;
  if (beh.verificationsRun > 0) {
    lines.push('Behavioral Verification:');
    if (beh.failed === 0) {
      lines.push(`  Status: PASSED (${beh.passed}/${beh.verificationsRun})`);
    } else {
      lines.push(`  Status: FAILED (${beh.passed}/${beh.verificationsRun} passed)`);
      for (const m of beh.mismatches.slice(0, 3)) {
        lines.push(`  - Step ${m.step}: ${m.port} expected=${m.expected}, actual=${m.actual}`);
      }
      if (beh.mismatches.length > 3) {
        lines.push(`  (+${beh.mismatches.length - 3} more mismatches)`);
      }
    }
  } else {
    lines.push('Behavioral Verification: NOT YET RUN');
  }

  return lines.join('\n');
}

/**
 * Format signals in compact single-line format.
 */
export function formatSignalsCompact(signals: SemanticSignal): string {
  const parts: string[] = [];

  // Regression
  if (signals.regression.isRegression) {
    parts.push(`REGRESS(${signals.regression.severity})`);
  } else if (signals.regression.errorDelta < 0) {
    parts.push(`IMPROVED(${Math.abs(signals.regression.errorDelta)} fewer errors)`);
  }

  // Structural
  if (signals.structural.changeType !== 'minor') {
    parts.push(`STRUCT(${signals.structural.changeType})`);
  }

  // Behavioral
  if (signals.behavioral.failed > 0) {
    parts.push(`BEHAVIOR_FAIL(${signals.behavioral.failed})`);
  } else if (signals.behavioral.passed > 0) {
    parts.push(`BEHAVIOR_PASS(${signals.behavioral.passed})`);
  }

  return parts.length > 0 ? parts.join(' ') : 'OK';
}
