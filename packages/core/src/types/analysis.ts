/**
 * Analysis Types
 *
 * Type definitions extracted from the former DSL analysis module.
 * These are pure interfaces with no parser dependency.
 */

import type { BitValue, BusValue, ComponentLibrary } from './circuit.js';

// ============================================================================
// Circuit Metrics
// ============================================================================

/**
 * Structural metrics - static analysis of elaborated circuit.
 */
export interface CircuitMetrics {
  nodeCount: number;
  registerCount: number;
  combinationalDepth: number;
  maxFanOut: number;
  maxFanIn: number;
  isPurelyCombinational: boolean;
  componentBreakdown?: Record<string, number>;
}

// ============================================================================
// Simulation Traces
// ============================================================================

export interface SimulationTrace {
  cycles: number;
  signals: Record<string, (BitValue | BusValue)[]>;
  registers: Record<string, (BitValue | BusValue)[]>;
  sampleRate: number;
  sampledCycles: number[];
  steadyStateAt?: number;
  signalMetrics?: Record<string, SignalMetrics>;
}

export interface SignalMetrics {
  transitions: number;
  dutyCycle?: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationPhase = 'syntax' | 'semantic' | 'type' | 'structural' | 'runtime';

export type DiagnosticCode =
  | 'SYNTAX_ERROR' | 'UNEXPECTED_TOKEN' | 'MISSING_TOKEN'
  | 'UNKNOWN_COMPONENT' | 'SELF_REFERENCE' | 'DUPLICATE_NAME'
  | 'UNDEFINED_REFERENCE' | 'UNDEFINED_PORT' | 'UNDEFINED_NODE'
  | 'UNDEFINED_PARAMETER' | 'UNDEFINED_CLOCK' | 'UNDEFINED_VARIABLE'
  | 'MULTIPLE_DRIVERS'
  | 'WIDTH_MISMATCH' | 'TYPE_MISMATCH' | 'PARAMETER_TYPE_ERROR' | 'INVALID_WIDTH'
  | 'COMBINATIONAL_CYCLE' | 'FLOATING_INPUT' | 'FLOATING_OUTPUT' | 'ELABORATION_ERROR'
  | 'CLOCK_UNDEFINED' | 'ASSERTION_FAILED'
  | 'UNSUPPORTED_FEATURE'
  | 'INTERNAL_ERROR';

export interface Diagnostic {
  phase: ValidationPhase;
  code: DiagnosticCode;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: { start: { line: number; column: number }; end?: { line: number; column: number } };
  suggestions?: string[];
  involvedNodes?: string[];
}

export interface ValidationSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  phasesWithDiagnostics: ValidationPhase[];
}

export interface AnalysisContext {
  circuitsDefined: string[];
  componentsUsed: string[];
  unresolvedReferences: string[];
}

export interface ValidationResult {
  valid: boolean;
  canSimulate: boolean;
  diagnostics: Diagnostic[];
  circuits?: import('./circuit.js').Circuit[];
  availableComponents: ComponentInterface[];
  summary: ValidationSummary;
  analysis: AnalysisContext;
}

// ============================================================================
// Component Interface
// ============================================================================

export interface ComponentInterface {
  name: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  clocks: Array<{ name: string }>;
  parameters?: Array<{ name: string; type: string; defaultValue?: string; options?: (number | string | boolean)[] }>;
  kind?: 'combinational' | 'sequential' | 'sink';
  description?: string;
}

// ============================================================================
// Envelope Types
// ============================================================================

export interface HardwareLLMEnvelope {
  version: string;
  validation: EnvelopeValidation;
  metrics: CircuitMetrics | null;
  behavioralDiagnostics: BehavioralDiagnostic[];
  simulation: SimulationTrace | null;
  delta: CircuitDelta | null;
  components: ComponentInterface[];
  grammarSummary: string;
}

export interface EnvelopeValidation {
  valid: boolean;
  canSimulate: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: EnvelopeDiagnostic[];
  analysis: {
    circuitsDefined: string[];
    componentsUsed: string[];
    unresolvedReferences: string[];
  };
}

export interface EnvelopeDiagnostic {
  phase: string;
  code: string;
  severity: string;
  message: string;
  line?: number;
  column?: number;
  suggestions: string[];
}

export interface BehavioralDiagnostic {
  code: string;
  severity: 'info' | 'suggestion';
  message: string;
  node?: string;
  suggestion?: string;
}

// ============================================================================
// Design Delta
// ============================================================================

export interface CircuitDelta {
  combinationalDepthChange: number;
  registerCountChange: number;
  cycleResolved: boolean;
  latencyChange: number;
  nodesAdded: string[];
  nodesRemoved: string[];
  nodeCountChange: number;
}

// ============================================================================
// Build Envelope Options & Builder
// ============================================================================

export interface BuildEnvelopeOptions {
  validation: ValidationResult;
  metrics?: CircuitMetrics;
  simulation?: SimulationTrace;
  delta?: CircuitDelta;
  library: ComponentLibrary;
}

/**
 * Build a HardwareLLMEnvelope from validation/analysis results.
 */
export function buildEnvelope(options: BuildEnvelopeOptions): HardwareLLMEnvelope {
  const { validation, metrics, simulation, delta, library } = options;

  const envelopeValidation: EnvelopeValidation = {
    valid: validation.valid,
    canSimulate: validation.canSimulate,
    errorCount: validation.summary.errorCount,
    warningCount: validation.summary.warningCount,
    diagnostics: validation.diagnostics.map((d) => ({
      phase: d.phase,
      code: d.code,
      severity: d.severity,
      message: d.message,
      line: d.location?.start.line,
      column: d.location?.start.column,
      suggestions: d.suggestions ?? [],
    })),
    analysis: {
      circuitsDefined: validation.analysis.circuitsDefined,
      componentsUsed: validation.analysis.componentsUsed,
      unresolvedReferences: validation.analysis.unresolvedReferences,
    },
  };

  // Build component catalog
  const components: ComponentInterface[] = [];
  const primitiveNames = library.getAllPrimitiveNames?.() ?? [];
  for (const name of primitiveNames) {
    const circuit = library.resolveComponent(name);
    if (circuit) {
      components.push({
        name: circuit.name,
        inputs: circuit.inputs.map((p) => ({
          name: p.name,
          type: p.portType.kind === 'bit' ? 'Bit' : `Bus[${(p.portType as any).width ?? '?'}]`,
        })),
        outputs: circuit.outputs.map((p) => ({
          name: p.name,
          type: p.portType.kind === 'bit' ? 'Bit' : `Bus[${(p.portType as any).width ?? '?'}]`,
        })),
        clocks: circuit.clocks.map((c) => ({ name: c.name })),
        parameters: circuit.parameters.length > 0
          ? circuit.parameters.map((p) => ({
              name: p.name,
              type: p.paramType,
              defaultValue: p.defaultValue?.toString(),
              options: p.options,
            }))
          : undefined,
        kind: circuit.metadata?.kind,
        description: circuit.metadata?.description,
      });
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));

  // Grammar summary for TS builder API
  const grammarSummary = getBuilderAPISummary();

  return {
    version: '1.0',
    validation: envelopeValidation,
    metrics: metrics ?? null,
    behavioralDiagnostics: [],
    simulation: simulation ?? null,
    delta: delta ?? null,
    components,
    grammarSummary,
  };
}

// ============================================================================
// Trace Utilities
// ============================================================================

/**
 * Compress unchanged runs in a trace for efficiency (RLE encoding).
 */
export function compressTrace(
  trace: SimulationTrace
): Record<string, Array<{ value: BitValue | BusValue; count: number }>> {
  const compressed: Record<string, Array<{ value: BitValue | BusValue; count: number }>> = {};

  for (const [signal, values] of Object.entries(trace.signals)) {
    compressed[signal] = compressRuns(values);
  }

  for (const [reg, values] of Object.entries(trace.registers)) {
    compressed[reg] = compressRuns(values);
  }

  return compressed;
}

function compressRuns<T>(values: T[]): Array<{ value: T; count: number }> {
  if (values.length === 0) return [];
  const runs: Array<{ value: T; count: number }> = [];
  let currentRun = { value: values[0], count: 1 };
  for (let i = 1; i < values.length; i++) {
    if (values[i] === currentRun.value) {
      currentRun.count++;
    } else {
      runs.push(currentRun);
      currentRun = { value: values[i], count: 1 };
    }
  }
  runs.push(currentRun);
  return runs;
}

/**
 * Detect steady state: the earliest cycle at which all signals become constant.
 */
export function detectSteadyState(trace: SimulationTrace): number | undefined {
  const STEADY_STATE_WINDOW = 5;
  const allSeries = [
    ...Object.values(trace.signals),
    ...Object.values(trace.registers),
  ];
  const totalSamples = trace.sampledCycles.length;
  if (totalSamples < STEADY_STATE_WINDOW) return undefined;

  for (let startIdx = 0; startIdx <= totalSamples - STEADY_STATE_WINDOW; startIdx++) {
    let allConstant = true;
    for (const series of allSeries) {
      if (series.length === 0) continue;
      const ref = series[startIdx];
      for (let i = startIdx + 1; i < series.length; i++) {
        if (series[i] !== ref) { allConstant = false; break; }
      }
      if (!allConstant) break;
    }
    if (allConstant) return trace.sampledCycles[startIdx];
  }
  return undefined;
}

// ============================================================================
// Builder API Summary (replaces DSL grammar summary)
// ============================================================================

export function getBuilderAPISummary(): string {
  return `// TypeScript Builder API — use component() to define circuits

import { component, bit, bus } from '@turing-incomplete/core';

// Basic example:
const SwitchToLed = component('SwitchToLed')
  .node('sw', 'Switch')
  .node('led', 'Led')
  .wire('sw.out', 'led.in')
  .build();

// With ports and parameters:
const Counter16 = component('Counter16')
  .input('enable', bit)
  .output('count', bus(16))
  .clock('clk')
  .node('reg', 'Register', { width: 16 })
  .node('adder', 'Adder', { width: 16 })
  .node('one', 'Constant', { value: 1 })
  .node('zero', 'Constant', { value: 0 })
  .wire('reg.q', 'adder.a')
  .wire('one.out', 'adder.b')
  .wire('zero.out', 'adder.carry_in')
  .wire('adder.sum', 'reg.data')
  .wire('enable', 'reg.we')
  .wire('reg.q', 'count')
  .build();

// Composites: use a previously-built component as a node type
const ha = component('HalfAdder')
  .input('a', bit).input('b', bit)
  .output('sum', bit).output('carry', bit)
  .node('xor1', 'Xor').node('and1', 'And')
  .wire('a', 'xor1.a').wire('b', 'xor1.b')
  .wire('a', 'and1.a').wire('b', 'and1.b')
  .wire('xor1.out', 'sum').wire('and1.out', 'carry')
  .build();
`;
}
