/**
 * Narrative Builder
 *
 * Builds semantic narrative summaries from HardwareLLMEnvelope.
 * Key insight: LLMs reason better over semantic summaries than raw JSON dumps.
 *
 * Narrative format compresses meaning better than JSON:
 * - JSON is token-heavy (~2-3x more tokens than prose)
 * - JSON is semantically flat (all structure, no emphasis)
 * - Narrative allows emphasis (e.g., "Critical: cycle between xor1 and and1")
 */

import type {
  HardwareLLMEnvelope,
  EnvelopeDiagnostic,
  CircuitMetrics,
  SimulationTrace,
} from '@/features/dsl';
import type { BitValue, BusValue } from '@/features/visual-editor/types/circuit';

// ============================================================================
// Severity Ordering
// ============================================================================

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  suggestion: 3,
};

function bySeverity(a: EnvelopeDiagnostic, b: EnvelopeDiagnostic): number {
  const aOrder = SEVERITY_ORDER[a.severity] ?? 99;
  const bOrder = SEVERITY_ORDER[b.severity] ?? 99;
  return aOrder - bOrder;
}

// ============================================================================
// Value Formatting
// ============================================================================

function formatValue(value: BitValue | BusValue): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return String(value);
}

function formatCycleCompact(
  cycle: Record<string, BitValue | BusValue>
): string {
  const entries = Object.entries(cycle)
    .slice(0, 6) // Limit to first 6 signals
    .map(([name, value]) => `${name}=${formatValue(value)}`)
    .join(', ');

  const remaining = Object.keys(cycle).length - 6;
  if (remaining > 0) {
    return `${entries}, +${remaining} more`;
  }
  return entries;
}

// ============================================================================
// Narrative Builder
// ============================================================================

/**
 * Build a semantic narrative summary from HardwareLLMEnvelope.
 * This is NOT JSON - it's prose optimized for LLM reasoning.
 */
export function buildNarrativeSummary(envelope: HardwareLLMEnvelope): string {
  const lines: string[] = [];

  // Validation status
  lines.push(`## Circuit Status`);
  if (envelope.validation.valid) {
    lines.push(`Circuit is valid and ready for simulation.`);
  } else {
    lines.push(
      `Circuit has ${envelope.validation.errorCount} error(s) and ${envelope.validation.warningCount} warning(s).`
    );
  }
  lines.push('');

  // Circuit metrics as prose
  if (envelope.metrics) {
    lines.push(...formatMetricsNarrative(envelope.metrics));
    lines.push('');
  }

  // Validation findings (sorted by severity, limited)
  if (envelope.validation.diagnostics.length > 0) {
    lines.push(`## Validation Findings`);
    const sorted = [...envelope.validation.diagnostics].sort(bySeverity);
    const top = sorted.slice(0, 5);

    for (const d of top) {
      const location = d.line ? ` (line ${d.line})` : '';
      lines.push(`- [${d.severity.toUpperCase()}] ${d.message}${location}`);
      if (d.suggestions.length > 0) {
        lines.push(`  Suggestion: ${d.suggestions[0]}`);
      }
    }

    const remaining = sorted.length - 5;
    if (remaining > 0) {
      lines.push(`  (+${remaining} more diagnostics)`);
    }
    lines.push('');
  }

  // Behavioral diagnostics
  if (envelope.behavioralDiagnostics.length > 0) {
    lines.push(`## Behavioral Insights`);
    for (const d of envelope.behavioralDiagnostics.slice(0, 3)) {
      lines.push(`- ${d.message}`);
      if (d.suggestion) {
        lines.push(`  Suggestion: ${d.suggestion}`);
      }
    }
    lines.push('');
  }

  // Simulation timeline (last N cycles)
  if (envelope.simulation && envelope.simulation.cycles > 0) {
    lines.push(...formatSimulationNarrative(envelope.simulation));
    lines.push('');
  }

  // Components in use
  const used = envelope.validation.analysis?.componentsUsed ?? [];
  if (used.length > 0) {
    lines.push(`## Components Used`);
    lines.push(used.join(', '));
    lines.push('');
  }

  // Circuits defined
  const defined = envelope.validation.analysis?.circuitsDefined ?? [];
  if (defined.length > 0) {
    lines.push(`## Circuits Defined`);
    lines.push(defined.join(', '));
    lines.push('');
  }

  // Unresolved references (if any)
  const unresolved = envelope.validation.analysis?.unresolvedReferences ?? [];
  if (unresolved.length > 0) {
    lines.push(`## Unresolved References`);
    lines.push(
      `The following components are referenced but not defined: ${unresolved.join(', ')}`
    );
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format circuit metrics as narrative prose.
 */
function formatMetricsNarrative(metrics: CircuitMetrics): string[] {
  const lines: string[] = [];
  lines.push(`## Circuit Metrics`);
  lines.push(`- Total nodes: ${metrics.nodeCount}`);
  lines.push(`- Combinational depth: ${metrics.combinationalDepth} gates`);
  lines.push(`- Sequential elements: ${metrics.registerCount} registers`);
  lines.push(`- Maximum fan-out: ${metrics.maxFanOut}`);
  lines.push(`- Maximum fan-in: ${metrics.maxFanIn}`);
  lines.push(
    `- Type: ${metrics.isPurelyCombinational ? 'Purely combinational' : 'Sequential'}`
  );

  // Component breakdown
  if (
    metrics.componentBreakdown &&
    Object.keys(metrics.componentBreakdown).length > 0
  ) {
    const breakdown = Object.entries(metrics.componentBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}: ${count}`)
      .join(', ');
    lines.push(`- Component breakdown: ${breakdown}`);
  }

  return lines;
}

/**
 * Format simulation trace as narrative.
 */
function formatSimulationNarrative(trace: SimulationTrace): string[] {
  const lines: string[] = [];
  lines.push(`## Recent Simulation (${trace.cycles} cycles)`);

  // Show last 10 cycles
  const signalNames = Object.keys(trace.signals).slice(0, 5);
  if (signalNames.length === 0) {
    lines.push('No signals captured.');
    return lines;
  }

  const startCycle = Math.max(0, trace.cycles - 10);
  for (let i = startCycle; i < trace.cycles; i++) {
    const cycleValues: Record<string, BitValue | BusValue> = {};
    for (const name of signalNames) {
      const values = trace.signals[name];
      if (values && values[i] !== undefined) {
        cycleValues[name] = values[i];
      }
    }
    lines.push(`  Cycle ${i}: ${formatCycleCompact(cycleValues)}`);
  }

  if (signalNames.length < Object.keys(trace.signals).length) {
    const remaining = Object.keys(trace.signals).length - signalNames.length;
    lines.push(`  (+${remaining} more signals)`);
  }

  return lines;
}

/**
 * Build a minimal narrative for quick responses.
 * Use when full context is not needed.
 */
export function buildMinimalNarrative(envelope: HardwareLLMEnvelope): string {
  const lines: string[] = [];

  // Just validation status and top errors
  if (envelope.validation.valid) {
    lines.push('Circuit is valid.');
  } else {
    lines.push(
      `Circuit has ${envelope.validation.errorCount} error(s).`
    );
    const topError = envelope.validation.diagnostics.find(
      (d) => d.severity === 'error'
    );
    if (topError) {
      lines.push(`First error: ${topError.message}`);
    }
  }

  return lines.join('\n');
}
