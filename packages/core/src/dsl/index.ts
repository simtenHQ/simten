/**
 * DSL Module - Main Entry Point
 *
 * LLM-native hardware design environment with:
 * - Validation Pipeline: Static correctness (syntax -> semantic -> type -> structural)
 * - Analysis Pipeline: Hardware metrics, simulation traces, design deltas
 *
 * Complete DSL pipeline: Text -> Tokens -> AST -> Validated AST -> IR
 */

// ============================================================================
// Parser Pipeline (Text -> AST)
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
} from './parser/index.js';

export type { ParseError, ValidationError, ChevrotainParseResult } from './parser/index.js';

// ============================================================================
// Compiler (AST -> IR)
// ============================================================================

export { compileToIR, compileCircuitToIR, CompilerError } from './compiler/index.js';
export type { ComponentLibrary as DSLComponentLibrary } from './compiler/index.js';

// ============================================================================
// Preprocessor
// ============================================================================

export {
  preprocessDSL,
  createMapFileResolver,
  createNodeFileResolver,
} from './preprocessor.js';
export type { FileResolver, PreprocessResult } from './preprocessor.js';

// ============================================================================
// Types
// ============================================================================

export * from './types/index.js';

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
} from './validation/index.js';

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
} from './validation/index.js';

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
} from './analysis/index.js';

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
} from './analysis/index.js';

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
} from './harness/index.js';

export type {
  CircuitInterface,
  PortInfo,
  HarnessAnalysis,
  // Assertion evaluator types
  AssertionEvalResult,
  AssertionSummary,
} from './harness/index.js';

// ============================================================================
// Testbench Compiler
// ============================================================================

export {
  compileTestbenchToIR,
  compileAssertions,
  validateTestbenchAgainstDUT,
  validateAssertionSignals,
  TestbenchCompilerError,
  ComponentNotFoundError,
} from './compiler/testbench-compiler.js';

export type { ComponentLibraryInterface } from './compiler/testbench-compiler.js';

// ============================================================================
// Testbench Runner & Testing
// ============================================================================

export {
  compileStimulus,
  validateStimulus,
  formatStimulusSchedule,
  StimulusCompilerError,
  generateVCD,
  parseVCDHeader,
  runTestbench,
} from './testing/index.js';

export type {
  VCDSignalInfo,
  TestbenchRunResult,
  TestbenchRunOptions,
} from './testing/index.js';

// ============================================================================
// DSL Generator
// ============================================================================

export { generateDSL } from './generator/dsl-generator.js';

// ============================================================================
// Convenience Functions
// ============================================================================

import { parseDSL } from './parser/index.js';
import type { ComponentLibrary } from './compiler/ir-generator.js';
import { compileToIR } from './compiler/index.js';
import type { Circuit } from '../types/circuit.js';

/**
 * Complete DSL compilation pipeline: source text -> executable IR
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
