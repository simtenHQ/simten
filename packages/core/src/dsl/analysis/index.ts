/**
 * Analysis Pipeline Module
 *
 * Hardware intelligence features for LLM-native design environment:
 * - Structural metrics (depth, fan-out, registers)
 * - Simulation traces (waveforms, state evolution)
 * - Design deltas (what-if analysis)
 * - Behavioral diagnostics (design insights)
 *
 * Key Insight: Software LLMs run unit tests.
 * Hardware LLMs inspect waveforms. This is the equivalent.
 *
 * @module analysis
 */

// ============================================================================
// Types
// ============================================================================

export type {
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
} from './types.js';

export {
  MAX_SIMULATION_CYCLES,
  MAX_OBSERVED_SIGNALS,
  ANALYSIS_THRESHOLDS,
  emptyMetrics,
  emptyTrace,
  emptyDelta,
} from './types.js';

// ============================================================================
// Metrics
// ============================================================================

export {
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
} from './metrics.js';

// ============================================================================
// Simulation
// ============================================================================

export {
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
} from './simulate.js';

// ============================================================================
// Delta Analysis
// ============================================================================

export {
  compareCircuits,
  findAddedNodes,
  findRemovedNodes,
  findAddedConnections,
  findRemovedConnections,
  summarizeDelta,
  generateDeltaSuggestion,
  compareCircuitsDetailed,
} from './delta.js';

export type { DetailedDelta } from './delta.js';

// ============================================================================
// Envelope
// ============================================================================

export {
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
} from './envelope.js';

export type {
  HardwareLLMEnvelope,
  EnvelopeValidation,
  EnvelopeDiagnostic,
  BuildEnvelopeOptions,
} from './envelope.js';
