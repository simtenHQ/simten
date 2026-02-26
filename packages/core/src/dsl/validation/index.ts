/**
 * Validation Pipeline Module
 *
 * LLM-native hardware design validation environment.
 * Provides static correctness checking through 4 phases:
 * - Phase 1: Syntax (Chevrotain parser)
 * - Phase 2: Semantic (Validator)
 * - Phase 3: Type (IR Compilation)
 * - Phase 4: Structural (Elaboration + Cycle/Port checks)
 *
 * @module validation
 */

// ============================================================================
// Main API
// ============================================================================

export {
  validateCircuit,
  isValid,
  canSimulate,
  validateOrThrow,
  buildComponentCatalog,
} from './validate.js';

// ============================================================================
// Structural Checks
// ============================================================================

export {
  checkCycles,
  checkFloatingInputs,
  checkFloatingOutputs,
  runStructuralChecks,
  buildCombinationalGraph,
  hasCycle,
  getNodesInCycles,
  assertAcyclic,
} from './structural.js';

// ============================================================================
// Component Catalog
// ============================================================================

export {
  getComponentCatalog,
  searchComponents,
  getComponentsByKind,
  getGrammarSummary,
  getLLMContext,
  getComponentDetails,
  formatComponentDetails,
  formatComponentCompact,
} from './catalog.js';

export type { ComponentCatalog } from './catalog.js';

// ============================================================================
// Formatters
// ============================================================================

export {
  formatForMonaco,
  formatForCLI,
  formatForLLM,
  buildLLMSystemPrompt,
  formatAsJSON,
} from './formatters.js';

export type {
  MonacoMarker,
  CLIFormatOptions,
  LLMFormatOptions,
  LLMContext,
  LLMDiagnostic,
  LLMStatus,
} from './formatters.js';

// ============================================================================
// Types
// ============================================================================

export type {
  ValidationPhase,
  DiagnosticCode,
  Diagnostic,
  ValidationResult,
  ValidationContext,
  ValidationSummary,
  AnalysisContext,
  ComponentInterface,
  CycleCheckResult,
  StructuralCheckResult,
} from './types.js';

export {
  isBlocking,
  createDefaultValidationContext,
  formatPortType,
} from './types.js';
