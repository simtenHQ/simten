/**
 * DSL Module - Main Entry Point
 *
 * LLM-native hardware design environment with:
 * - Validation Pipeline: Static correctness (syntax → semantic → type → structural)
 * - Analysis Pipeline: Hardware metrics, simulation traces, design deltas
 *
 * Complete DSL pipeline: Text → Tokens → AST → Validated AST → IR
 */

// ============================================================================
// Parser Pipeline (Text → AST)
// ============================================================================

export {
  parse,
  parseOrThrow,
  validate,
  validateOrThrow,
  parseDSL,
  parseDSLOrThrow,
  ValidationException,
  DSLLexer,
  DSLParser,
} from './parser';

export type { ParseError, ValidationError, ChevrotainParseResult } from './parser';

// ============================================================================
// Compiler (AST → IR)
// ============================================================================

export { compileToIR, compileCircuitToIR, CompilerError } from './compiler';
export type { ComponentLibrary } from './compiler';

// ============================================================================
// Preprocessor
// ============================================================================

export {
  preprocessDSL,
  createMapFileResolver,
  createNodeFileResolver,
} from './preprocessor';
export type { FileResolver, PreprocessResult } from './preprocessor';

// ============================================================================
// Types
// ============================================================================

export * from './types';

// ============================================================================
// Validation Pipeline (Static Correctness)
// ============================================================================

export {
  // Main API
  validateCircuit,
  isValid,
  canSimulate,
  validateOrThrow as validateCircuitOrThrow,
  buildComponentCatalog,
  // Structural checks
  checkCycles,
  checkFloatingInputs,
  checkFloatingOutputs,
  runStructuralChecks,
  buildCombinationalGraph,
  hasCycle,
  getNodesInCycles,
  assertAcyclic,
  // Component catalog
  getComponentCatalog,
  searchComponents,
  getComponentsByKind,
  getGrammarSummary,
  getLLMContext,
  getComponentDetails,
  formatComponentDetails,
  // Formatters
  formatForMonaco,
  formatForCLI,
  formatForLLM,
  buildLLMSystemPrompt,
  formatAsJSON,
  // Utilities
  isBlocking,
  createDefaultValidationContext,
  formatPortType,
} from './validation';

export type {
  // Core types
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
  // Catalog types
  ComponentCatalog,
  // Formatter types
  MonacoMarker,
  CLIFormatOptions,
  LLMFormatOptions,
  LLMContext,
  LLMDiagnostic,
  LLMStatus,
} from './validation';

// ============================================================================
// Analysis Pipeline (Hardware Intelligence)
// ============================================================================

export {
  // Metrics
  analyzeCircuit,
  countSequentialNodes,
  computeCriticalPath,
  computeFanMetrics,
  getNodeFanOut,
  getNodeFanIn,
  computeComponentBreakdown,
  generateStructuralDiagnostics,
  hasSequentialElements,
  getSequentialNodeIds,
  // Simulation
  simulateCircuit,
  extractBehavioralDiagnostics,
  getValueAtCycle,
  getSignalValues,
  findTransitions,
  signalEverEquals,
  compressTrace,
  detectSteadyState,
  computeAllSignalMetrics,
  extractCausalityChains,
  // Delta analysis
  compareCircuits,
  findAddedNodes,
  findRemovedNodes,
  findAddedConnections,
  findRemovedConnections,
  summarizeDelta,
  generateDeltaSuggestion,
  compareCircuitsDetailed,
  // Envelope
  ENVELOPE_VERSION,
  buildEnvelope,
  isEnvelopeValid,
  canEnvelopeSimulate,
  getAllDiagnostics,
  hasErrors,
  hasWarnings,
  serializeEnvelope,
  parseEnvelope,
  buildMinimalEnvelope,
  buildFullEnvelope,
  buildSimulationEnvelope,
  buildComparisonEnvelope,
  getEnvelopeStatus,
  getEnvelopeStatusCode,
  // Constants
  MAX_SIMULATION_CYCLES,
  MAX_OBSERVED_SIGNALS,
  ANALYSIS_THRESHOLDS,
  emptyMetrics,
  emptyTrace,
  emptyDelta,
} from './analysis';

export type {
  // Core types
  ElaboratedContext,
  CircuitMetrics,
  SimulationTrace,
  SimulateOptions,
  Stimuli,
  CircuitDelta,
  BehavioralDiagnostic,
  BehavioralDiagnosticCode,
  AnalysisResult,
  SignalMetrics,
  DetailedDelta,
  // Envelope types
  HardwareLLMEnvelope,
  EnvelopeValidation,
  EnvelopeDiagnostic,
  BuildEnvelopeOptions,
} from './analysis';

// ============================================================================
// Harness Generator (Deterministic Test Wrappers)
// ============================================================================

export {
  generateHarness,
  generateHarnessDSL,
  generateHarnessAppended,
  analyzeForHarness,
  extractCircuitInterface,
  isHarnessName,
  // Assertion evaluator
  evaluateAssertions,
  formatAssertionSummary,
  allAssertionsPassed,
  getFailedResults,
} from './harness';

export type {
  CircuitInterface,
  PortInfo,
  HarnessAnalysis,
  // Assertion evaluator types
  AssertionEvalResult,
  AssertionSummary,
} from './harness';

// Convenience: Complete pipeline function
import { parseDSL } from './parser';
import { compileToIR, ComponentLibrary } from './compiler';
import { Circuit } from './types';

/**
 * Interface for store-like objects that have resolveComponent.
 * This matches the ComponentLibraryStore interface from visual-editor.
 */
interface StoreWithResolveComponent {
  resolveComponent(name: string): Circuit | undefined;
}

/**
 * Adapt a store-like object (with resolveComponent) to the DSL compiler's
 * ComponentLibrary interface (with getCircuit/hasCircuit).
 *
 * This allows tests and UI code to pass ComponentLibraryStore directly
 * to DSL compilation functions.
 */
export function adaptStoreToCompilerLibrary(
  store: StoreWithResolveComponent
): ComponentLibrary {
  return {
    getCircuit: (name: string) => store.resolveComponent(name),
    hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    addCircuit: () => {}, // No-op for read-only usage
  };
}

/**
 * Complete DSL compilation pipeline: source text → executable IR
 */
export function compileDSL(
  source: string,
  library: ComponentLibrary,
  sourceName?: string
): {
  circuits: Circuit[];
  errors: Array<{ message: string; line: number; column: number }>;
} {
  const { ast, errors } = parseDSL(source, sourceName);

  if (errors.length > 0) {
    return {
      circuits: [],
      errors: errors.map((e) => ({
        message: e.message,
        line: e.location.start.line,
        column: e.location.start.column,
      })),
    };
  }

  try {
    const circuits = compileToIR(ast, library);
    return { circuits, errors: [] };
  } catch (error) {
    return {
      circuits: [],
      errors: [
        {
          message: error instanceof Error ? error.message : String(error),
          line: 0,
          column: 0,
        },
      ],
    };
  }
}
