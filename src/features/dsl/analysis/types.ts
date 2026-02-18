/**
 * Analysis Pipeline Types
 *
 * Type definitions for hardware intelligence features:
 * - Structural metrics (depth, fan-out, registers)
 * - Simulation traces (waveforms, state evolution)
 * - Design deltas (what-if analysis)
 * - Behavioral diagnostics (design insights)
 *
 * Design Principles:
 * - Analysis = advisory (provides insights for optimization)
 * - Never blocking - validation determines correctness
 * - All types support deterministic output for LLM stability
 */

import type {
  Circuit,
  FlatCircuit,
  ComponentLibrary,
  BitValue,
  BusValue,
} from '../../../core/simulator/types';

// ============================================================================
// Elaborated Context
// ============================================================================

/**
 * Canonical context to prevent re-elaboration and divergent logic.
 * Pass this around instead of re-elaborating circuits.
 */
export interface ElaboratedContext {
  /** Original circuit definition */
  circuit: Circuit;
  /** Elaborated (flattened) circuit */
  flat: FlatCircuit;
  /** Component library used for elaboration */
  library: ComponentLibrary;
}

// ============================================================================
// Circuit Metrics
// ============================================================================

/**
 * Structural metrics - static analysis of elaborated circuit.
 * These are computed without simulation.
 */
export interface CircuitMetrics {
  /** Total number of nodes in the flat circuit */
  nodeCount: number;
  /** Number of sequential elements (registers, flip-flops) */
  registerCount: number;
  /** Critical path length (longest combinational chain) */
  combinationalDepth: number;
  /** Maximum fan-out of any node */
  maxFanOut: number;
  /** Maximum fan-in of any node */
  maxFanIn: number;
  /** True if circuit contains no sequential elements */
  isPurelyCombinational: boolean;
  /** Breakdown by component type */
  componentBreakdown?: Record<string, number>;
}

// ============================================================================
// Simulation Traces
// ============================================================================

/**
 * Memory guard constants for simulation.
 */
export const MAX_SIMULATION_CYCLES = 1000;
export const MAX_OBSERVED_SIGNALS = 100;

/**
 * Options for simulation trace capture.
 */
export interface SimulateOptions {
  /** Number of cycles to simulate */
  cycles: number;
  /** Optional: Only observe these signals (reduces memory) */
  observeSignals?: string[];
  /** Optional: Sample rate (e.g., every Nth cycle) */
  sampleRate?: number;
}

/**
 * Input stimuli for simulation.
 */
export interface Stimuli {
  /** Map of input name to value sequence (one per cycle) or constant */
  inputs: Record<string, (BitValue | BusValue)[] | BitValue | BusValue>;
  /** Optional: Initial memory contents */
  initialMemory?: Map<string, Map<number, number>>;
}

/**
 * Simulation trace - temporal behavior captured over cycles.
 */
export interface SimulationTrace {
  /** Number of cycles simulated */
  cycles: number;
  /** Signal values at each cycle (signal name -> values per cycle) */
  signals: Record<string, (BitValue | BusValue)[]>;
  /** Register values at each cycle (register name -> values per cycle) */
  registers: Record<string, (BitValue | BusValue)[]>;
  /** Sample rate used (1 = every cycle) */
  sampleRate: number;
  /** Cycle numbers that were sampled */
  sampledCycles: number[];
}

// ============================================================================
// Design Delta
// ============================================================================

/**
 * Design delta - what changes between two circuits.
 * Used for design space exploration.
 */
export interface CircuitDelta {
  /** Change in combinational depth (negative = improvement) */
  combinationalDepthChange: number;
  /** Change in register count */
  registerCountChange: number;
  /** Did a combinational cycle get resolved? */
  cycleResolved: boolean;
  /**
   * Change in latency (approximation using register count).
   * NOTE: Not accurate for complex pipelines - document this clearly.
   */
  latencyChange: number;
  /** Nodes added in the mutated circuit */
  nodesAdded: string[];
  /** Nodes removed from the original circuit */
  nodesRemoved: string[];
  /** Change in total node count */
  nodeCountChange: number;
}

// ============================================================================
// Behavioral Diagnostics
// ============================================================================

/**
 * Behavioral diagnostic codes.
 * These are design insights, NOT errors.
 */
export type BehavioralDiagnosticCode =
  | 'REGISTER_NEVER_UPDATES'
  | 'OUTPUT_CONSTANT'
  | 'UNUSED_SIGNAL'
  | 'REDUNDANT_LOGIC'
  | 'HIGH_TOGGLE_RATE'
  | 'LONG_COMBINATIONAL_PATH'
  | 'LOW_ACTIVITY';

/**
 * Behavioral diagnostic - design insight, not error.
 * These are advisory suggestions, never blocking.
 */
export interface BehavioralDiagnostic {
  /** Diagnostic code */
  code: BehavioralDiagnosticCode;
  /** Severity: info or suggestion (never error) */
  severity: 'info' | 'suggestion';
  /** Human-readable message */
  message: string;
  /** Node or signal involved */
  node?: string;
  /** Suggested action */
  suggestion?: string;
}

// ============================================================================
// Threshold Constants
// ============================================================================

/**
 * Thresholds for behavioral analysis.
 */
export const ANALYSIS_THRESHOLDS = {
  /** Combinational depth that triggers warning */
  LONG_COMBINATIONAL_PATH: 10,
  /** Fan-out that triggers warning */
  HIGH_FAN_OUT: 16,
  /** Toggle rate percentage that triggers warning */
  HIGH_TOGGLE_RATE: 0.8,
  /** Toggle rate percentage below which triggers low activity warning */
  LOW_ACTIVITY: 0.01,
} as const;

// ============================================================================
// Analysis Result
// ============================================================================

/**
 * Complete analysis result combining all analysis types.
 */
export interface AnalysisResult {
  /** Structural metrics */
  metrics: CircuitMetrics;
  /** Simulation trace (if simulation was run) */
  trace?: SimulationTrace;
  /** Behavioral diagnostics from simulation */
  behavioralDiagnostics: BehavioralDiagnostic[];
  /** Design delta (if comparison was run) */
  delta?: CircuitDelta;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty metrics for error cases.
 */
export function emptyMetrics(): CircuitMetrics {
  return {
    nodeCount: 0,
    registerCount: 0,
    combinationalDepth: 0,
    maxFanOut: 0,
    maxFanIn: 0,
    isPurelyCombinational: true,
    componentBreakdown: {},
  };
}

/**
 * Create empty simulation trace.
 */
export function emptyTrace(): SimulationTrace {
  return {
    cycles: 0,
    signals: {},
    registers: {},
    sampleRate: 1,
    sampledCycles: [],
  };
}

/**
 * Create empty delta (no change).
 */
export function emptyDelta(): CircuitDelta {
  return {
    combinationalDepthChange: 0,
    registerCountChange: 0,
    cycleResolved: false,
    latencyChange: 0,
    nodesAdded: [],
    nodesRemoved: [],
    nodeCountChange: 0,
  };
}
