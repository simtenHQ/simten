/**
 * Hardware LLM Envelope
 *
 * Single canonical response shape for all LLM interactions.
 * This is the PUBLIC CONTRACT. Changes require versioning.
 *
 * Design Principles:
 * - All fields MUST be present (use null/[] for absent data)
 * - Never conditionally omit blocks
 * - Version field for contract evolution
 * - LLMs treat missing keys as semantic signals - consistency is critical
 */

import type { ComponentLibrary } from '../../types/circuit.js';

import type { ValidationResult, ComponentInterface } from '../validation/types.js';
import type {
  ElaboratedContext,
  CircuitMetrics,
  SimulationTrace,
  CircuitDelta,
  BehavioralDiagnostic,
} from './types.js';
import { extractBehavioralDiagnostics } from './simulate.js';
import { buildComponentCatalog } from '../validation/validate.js';
import { getGrammarSummary } from '../validation/catalog.js';

// ============================================================================
// Envelope Version
// ============================================================================

/**
 * Current envelope version.
 * Increment on breaking changes.
 */
export const ENVELOPE_VERSION = '1.0' as const;

// ============================================================================
// Envelope Interface
// ============================================================================

/**
 * HardwareLLMEnvelope - Single canonical response shape for all LLM interactions.
 *
 * This is the PUBLIC CONTRACT. Changes require versioning.
 * All fields MUST be present (use null/[] for absent data).
 */
export interface HardwareLLMEnvelope {
  /** Version for contract evolution */
  version: typeof ENVELOPE_VERSION;

  /** Validation result (always present) */
  validation: EnvelopeValidation;

  /** Structural metrics (always present, null if not computed) */
  metrics: CircuitMetrics | null;

  /** Behavioral diagnostics from simulation (always [], never undefined) */
  behavioralDiagnostics: BehavioralDiagnostic[];

  /** Simulation trace (always present, null if not run) */
  simulation: SimulationTrace | null;

  /** Design delta (optional, only for comparison operations) */
  delta: CircuitDelta | null;

  /** Component catalog (always present) */
  components: ComponentInterface[];

  /** Grammar summary (always present) */
  grammarSummary: string;
}

/**
 * Simplified validation info for envelope.
 */
export interface EnvelopeValidation {
  /** Overall validity */
  valid: boolean;
  /** Can simulation proceed */
  canSimulate: boolean;
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Diagnostic messages */
  diagnostics: EnvelopeDiagnostic[];
  /** Analysis context for LLM auto-fix */
  analysis: {
    circuitsDefined: string[];
    componentsUsed: string[];
    unresolvedReferences: string[];
  };
}

/**
 * Simplified diagnostic for envelope.
 */
export interface EnvelopeDiagnostic {
  phase: string;
  code: string;
  severity: string;
  message: string;
  line?: number;
  column?: number;
  suggestions: string[];
}

// ============================================================================
// Envelope Builder
// ============================================================================

/**
 * Options for building an envelope.
 */
export interface BuildEnvelopeOptions {
  /** Validation result (required) */
  validation: ValidationResult;
  /** Structural metrics (optional) */
  metrics?: CircuitMetrics;
  /** Simulation trace (optional) */
  simulation?: SimulationTrace;
  /** Design delta (optional) */
  delta?: CircuitDelta;
  /** Component library for catalog */
  library: ComponentLibrary;
  /**
   * Elaborated circuit context.
   * When provided, causality chain diagnostics are included in
   * behavioralDiagnostics by tracing register updates back through
   * the connection graph.
   */
  elaboratedContext?: ElaboratedContext;
}

/**
 * Build a complete HardwareLLMEnvelope.
 *
 * CRITICAL: All fields are always present.
 * - Use null for absent optional data
 * - Use [] for absent arrays
 * - Never conditionally omit fields
 */
export function buildEnvelope(options: BuildEnvelopeOptions): HardwareLLMEnvelope {
  const { validation, metrics, simulation, delta, library, elaboratedContext } = options;

  // Convert validation to envelope format
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

  // Extract behavioral diagnostics if simulation was run.
  // Pass elaboratedContext when available so causality chain diagnostics
  // can be produced by tracing register updates through the connection graph.
  const behavioralDiagnostics = simulation
    ? extractBehavioralDiagnostics(simulation, elaboratedContext)
    : [];

  // Build component catalog
  const components = buildComponentCatalog(library);

  return {
    version: ENVELOPE_VERSION,
    validation: envelopeValidation,
    metrics: metrics ?? null,
    behavioralDiagnostics,
    simulation: simulation ?? null,
    delta: delta ?? null,
    components,
    grammarSummary: getGrammarSummary(),
  };
}

// ============================================================================
// Envelope Utilities
// ============================================================================

/**
 * Check if envelope represents a valid circuit.
 */
export function isEnvelopeValid(envelope: HardwareLLMEnvelope): boolean {
  return envelope.validation.valid;
}

/**
 * Check if envelope circuit can be simulated.
 */
export function canEnvelopeSimulate(envelope: HardwareLLMEnvelope): boolean {
  return envelope.validation.canSimulate;
}

/**
 * Get all diagnostics from envelope (validation + behavioral).
 */
export function getAllDiagnostics(
  envelope: HardwareLLMEnvelope
): Array<EnvelopeDiagnostic | BehavioralDiagnostic> {
  return [
    ...envelope.validation.diagnostics,
    ...envelope.behavioralDiagnostics,
  ];
}

/**
 * Check if envelope has any errors.
 */
export function hasErrors(envelope: HardwareLLMEnvelope): boolean {
  return envelope.validation.errorCount > 0;
}

/**
 * Check if envelope has any warnings.
 */
export function hasWarnings(envelope: HardwareLLMEnvelope): boolean {
  return envelope.validation.warningCount > 0;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize envelope to JSON string.
 * Uses stable key ordering for deterministic output.
 */
export function serializeEnvelope(envelope: HardwareLLMEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parse envelope from JSON string.
 * Validates version compatibility.
 */
export function parseEnvelope(json: string): HardwareLLMEnvelope {
  const parsed = JSON.parse(json) as HardwareLLMEnvelope;

  // Version check
  if (parsed.version !== ENVELOPE_VERSION) {
    console.warn(
      `Envelope version mismatch: expected ${ENVELOPE_VERSION}, got ${parsed.version}`
    );
  }

  return parsed;
}

// ============================================================================
// LLM Response Helpers
// ============================================================================

/**
 * Build a minimal envelope for quick responses.
 * Use when only validation is needed.
 */
export function buildMinimalEnvelope(
  validation: ValidationResult,
  library: ComponentLibrary
): HardwareLLMEnvelope {
  return buildEnvelope({
    validation,
    library,
  });
}

/**
 * Build a full envelope with metrics.
 * Use when analysis has been run.
 */
export function buildFullEnvelope(
  validation: ValidationResult,
  metrics: CircuitMetrics,
  library: ComponentLibrary
): HardwareLLMEnvelope {
  return buildEnvelope({
    validation,
    metrics,
    library,
  });
}

/**
 * Build an envelope with simulation results.
 * Use after running simulation.
 *
 * @param validation - Validation result
 * @param metrics - Structural metrics
 * @param simulation - Simulation trace (carries steadyStateAt and signalMetrics)
 * @param library - Component library
 * @param elaboratedContext - Optional elaborated context for causality chain diagnostics
 */
export function buildSimulationEnvelope(
  validation: ValidationResult,
  metrics: CircuitMetrics,
  simulation: SimulationTrace,
  library: ComponentLibrary,
  elaboratedContext?: ElaboratedContext
): HardwareLLMEnvelope {
  return buildEnvelope({
    validation,
    metrics,
    simulation,
    library,
    elaboratedContext,
  });
}

/**
 * Build an envelope for design comparison.
 * Use after comparing two circuits.
 */
export function buildComparisonEnvelope(
  validation: ValidationResult,
  delta: CircuitDelta,
  library: ComponentLibrary
): HardwareLLMEnvelope {
  return buildEnvelope({
    validation,
    delta,
    library,
  });
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Get a human-readable status summary from envelope.
 */
export function getEnvelopeStatus(envelope: HardwareLLMEnvelope): string {
  if (envelope.validation.errorCount > 0) {
    return `errors: ${envelope.validation.errorCount} error(s), ${envelope.validation.warningCount} warning(s)`;
  }
  if (envelope.validation.warningCount > 0) {
    return `warnings: ${envelope.validation.warningCount} warning(s)`;
  }
  return 'valid';
}

/**
 * Get envelope status as enum.
 */
export function getEnvelopeStatusCode(
  envelope: HardwareLLMEnvelope
): 'valid' | 'warnings' | 'errors' {
  if (envelope.validation.errorCount > 0) return 'errors';
  if (envelope.validation.warningCount > 0) return 'warnings';
  return 'valid';
}
