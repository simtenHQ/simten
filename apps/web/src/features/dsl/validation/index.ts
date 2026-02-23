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
} from './validate';

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
} from './structural';

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
} from './catalog';

export type { ComponentCatalog } from './catalog';

// ============================================================================
// Formatters
// ============================================================================

export {
  formatForMonaco,
  formatForCLI,
  formatForLLM,
  buildLLMSystemPrompt,
  formatAsJSON,
} from './formatters';

export type {
  MonacoMarker,
  CLIFormatOptions,
  LLMFormatOptions,
  LLMContext,
  LLMDiagnostic,
  LLMStatus,
} from './formatters';

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
} from './types';

export {
  isBlocking,
  createDefaultValidationContext,
  formatPortType,
} from './types';
