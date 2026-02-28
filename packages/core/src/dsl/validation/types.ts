/**
 * Validation Pipeline Types
 *
 * Core type definitions for the LLM-native hardware design environment.
 * These types define the contract for validation results, diagnostics,
 * and component interfaces.
 *
 * Design Principles:
 * - Validation phases are ordered: syntax → semantic → type → structural
 * - 'runtime' phase is defined but NOT implemented in validateCircuit
 * - Blocking determination is centralized via DIAGNOSTIC_META
 * - All types support deterministic output for LLM stability
 */

import type { SourceRange, Program } from '../types/ast.js';
import type { Circuit, ComponentLibrary } from '../../types/circuit.js';

// ============================================================================
// Validation Phases
// ============================================================================

/**
 * Validation phases in order of execution.
 * 'runtime' is defined but NOT implemented in validateCircuit -
 * keep runtime separate in simulateCircuit() since structural correctness ≠ runtime correctness.
 */
export type ValidationPhase = 'syntax' | 'semantic' | 'type' | 'structural' | 'runtime';

// ============================================================================
// Diagnostic Codes
// ============================================================================

/**
 * All diagnostic codes used by the validation pipeline.
 * These codes are part of the public contract - changes require versioning.
 */
export type DiagnosticCode =
  // Syntax errors (Phase 1)
  | 'SYNTAX_ERROR'
  | 'UNEXPECTED_TOKEN'
  | 'MISSING_TOKEN'
  // Semantic errors (Phase 2)
  | 'UNKNOWN_COMPONENT'
  | 'DUPLICATE_NAME'
  | 'UNDEFINED_REFERENCE'
  | 'UNDEFINED_PORT'
  | 'UNDEFINED_NODE'
  | 'UNDEFINED_PARAMETER'
  | 'UNDEFINED_CLOCK'
  | 'UNDEFINED_VARIABLE'
  | 'MULTIPLE_DRIVERS'
  // Type errors (Phase 3)
  | 'WIDTH_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'PARAMETER_TYPE_ERROR'
  | 'INVALID_WIDTH'
  // Structural errors (Phase 4)
  | 'COMBINATIONAL_CYCLE'
  | 'FLOATING_INPUT'
  | 'FLOATING_OUTPUT'
  | 'ELABORATION_ERROR'
  // Runtime errors (Phase 5 - not implemented in validateCircuit)
  | 'CLOCK_UNDEFINED'
  | 'ASSERTION_FAILED'
  // Generic
  | 'INTERNAL_ERROR';

// ============================================================================
// Diagnostic Interface
// ============================================================================

/**
 * A single diagnostic message from the validation pipeline.
 */
export interface Diagnostic {
  /** The validation phase that produced this diagnostic */
  phase: ValidationPhase;
  /** Machine-readable diagnostic code */
  code: DiagnosticCode;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Human-readable message */
  message: string;
  /** Source location (if available) */
  location?: SourceRange;
  /** Suggested fixes or next steps */
  suggestions?: string[];
  /** Nodes involved in this diagnostic (e.g., cycle participants) */
  involvedNodes?: string[];
}

// ============================================================================
// Diagnostic Metadata - Blocking Determination
// ============================================================================

/**
 * Metadata for each diagnostic code.
 * Using record pattern for extensibility as language grows.
 */
interface DiagnosticMeta {
  /** Whether this diagnostic blocks simulation */
  blocking: boolean;
  // Future: fixable, deprecated, etc.
}

/**
 * Centralized policy for diagnostic blocking behavior.
 * This avoids scattered logic and makes it easy to extend.
 */
const DIAGNOSTIC_META: Partial<Record<DiagnosticCode, DiagnosticMeta>> = {
  // Syntax errors - always blocking
  SYNTAX_ERROR: { blocking: true },
  UNEXPECTED_TOKEN: { blocking: true },
  MISSING_TOKEN: { blocking: true },

  // Semantic errors - mostly blocking
  UNKNOWN_COMPONENT: { blocking: true },
  DUPLICATE_NAME: { blocking: true },
  UNDEFINED_REFERENCE: { blocking: true },
  UNDEFINED_PORT: { blocking: true },
  UNDEFINED_NODE: { blocking: true },
  UNDEFINED_PARAMETER: { blocking: true },
  UNDEFINED_CLOCK: { blocking: true },
  UNDEFINED_VARIABLE: { blocking: true },
  MULTIPLE_DRIVERS: { blocking: true },

  // Type errors - blocking
  WIDTH_MISMATCH: { blocking: true },
  TYPE_MISMATCH: { blocking: true },
  PARAMETER_TYPE_ERROR: { blocking: true },
  INVALID_WIDTH: { blocking: true },

  // Structural errors
  COMBINATIONAL_CYCLE: { blocking: true },
  FLOATING_INPUT: { blocking: true },
  // AUDIT: verify simulator defaults undriven outputs to 0
  FLOATING_OUTPUT: { blocking: false },
  ELABORATION_ERROR: { blocking: true },

  // Runtime errors
  CLOCK_UNDEFINED: { blocking: true },
  ASSERTION_FAILED: { blocking: false },

  // Generic
  INTERNAL_ERROR: { blocking: true },
};

/**
 * Determine if a diagnostic blocks simulation.
 * Non-error diagnostics are never blocking.
 */
export function isBlocking(diagnostic: Diagnostic): boolean {
  if (diagnostic.severity !== 'error') return false;
  return DIAGNOSTIC_META[diagnostic.code]?.blocking ?? false;
}

// ============================================================================
// Component Interface
// ============================================================================

/**
 * Describes a component's interface for autocomplete and LLM context.
 */
export interface ComponentInterface {
  /** Component name */
  name: string;
  /** Input ports */
  inputs: Array<{ name: string; type: string }>;
  /** Output ports */
  outputs: Array<{ name: string; type: string }>;
  /** Clock signals */
  clocks: Array<{ name: string }>;
  /** Optional parameters */
  parameters?: Array<{ name: string; type: string; defaultValue?: string; options?: (number | string | boolean)[] }>;
  /** Component kind (combinational, sequential, sink) */
  kind?: 'combinational' | 'sequential' | 'sink';
  /** Optional description */
  description?: string;
}

// ============================================================================
// Validation Context
// ============================================================================

/**
 * Context for validation to avoid boolean flag proliferation.
 */
export interface ValidationContext {
  /** Component library for resolving references */
  componentLibrary: ComponentLibrary;
  /** Optional source file name for error messages */
  sourceName?: string;
  /** Which validation phases to run (all default to true) */
  phases?: {
    syntax?: boolean;
    semantic?: boolean;
    type?: boolean;
    structural?: boolean;
  };
}

/**
 * Create default validation context with all phases enabled.
 */
export function createDefaultValidationContext(
  library: ComponentLibrary,
  sourceName?: string
): ValidationContext {
  return {
    componentLibrary: library,
    sourceName,
    phases: {
      syntax: true,
      semantic: true,
      type: true,
      structural: true,
    },
  };
}

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Summary statistics for validation results.
 */
export interface ValidationSummary {
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
  /** Total info count */
  infoCount: number;
  /** Phases that produced diagnostics */
  phasesWithDiagnostics: ValidationPhase[];
}

/**
 * Analysis context for LLM auto-fix.
 * This dramatically improves fix quality by exposing what was attempted.
 */
export interface AnalysisContext {
  /** Circuits defined in the source */
  circuitsDefined: string[];
  /** Components referenced (successfully resolved or not) */
  componentsUsed: string[];
  /** References that failed to resolve */
  unresolvedReferences: string[];
}

/**
 * The complete result of running the validation pipeline.
 */
export interface ValidationResult {
  /** True if no errors at all */
  valid: boolean;
  /** True if no BLOCKING errors (can simulate) */
  canSimulate: boolean;
  /** All diagnostics sorted deterministically */
  diagnostics: Diagnostic[];
  /** Parsed AST (if syntax phase succeeded) */
  ast?: Program;
  /** Compiled circuits (if type phase succeeded) */
  circuits?: Circuit[];
  /** Available components for autocomplete */
  availableComponents: ComponentInterface[];
  /** Summary statistics */
  summary: ValidationSummary;
  /** Analysis context for LLM auto-fix */
  analysis: AnalysisContext;
}

// ============================================================================
// Structural Check Results
// ============================================================================

/**
 * Result from cycle detection.
 */
export interface CycleCheckResult {
  /** Whether any cycles were detected */
  hasCycle: boolean;
  /** Each array is one strongly connected component */
  cycles: string[][];
  /** One diagnostic per SCC - atomic for LLM fixing */
  diagnostics: Diagnostic[];
}

/**
 * Result from all structural checks.
 */
export interface StructuralCheckResult {
  /** All structural diagnostics */
  diagnostics: Diagnostic[];
  /** Detailed cycle check results */
  cycleCheck: CycleCheckResult;
  /** Floating input ports */
  floatingInputs: string[];
  /** Floating output ports */
  floatingOutputs: string[];
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Port type formatted as string for LLM context.
 */
export function formatPortType(portType: { kind: string; width?: number }): string {
  if (portType.kind === 'bit') {
    return 'Bit';
  } else if (portType.kind === 'bus' && portType.width !== undefined) {
    return `Bus[${portType.width}]`;
  }
  return 'unknown';
}
