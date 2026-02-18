/**
 * Simulation Trace Extraction
 *
 * Runs simulation and captures signal/register traces for analysis.
 * Extracts behavioral diagnostics from simulation data.
 *
 * Design Principles:
 * - Memory guards to prevent payload explosion
 * - Optional signal filtering for large circuits
 * - Optional sampling for long simulations
 * - Behavioral diagnostics are advisory, never blocking
 *
 * Key Insight: Software LLMs run unit tests.
 * Hardware LLMs inspect waveforms. This is the equivalent.
 */

import type {
  BitValue,
  BusValue,
} from '../../../core/simulator/types';
import { createSimulator } from '../../../core/simulator';

import type {
  ElaboratedContext,
  SimulationTrace,
  SimulateOptions,
  Stimuli,
  BehavioralDiagnostic,
} from './types';
import {
  MAX_SIMULATION_CYCLES,
  MAX_OBSERVED_SIGNALS,
  ANALYSIS_THRESHOLDS,
} from './types';

// ============================================================================
// Simulation Execution
// ============================================================================

/**
 * Run simulation and capture traces.
 *
 * @param ctx - Elaborated context
 * @param stimuli - Input stimuli
 * @param options - Simulation options
 * @returns Captured simulation trace
 */
export function simulateCircuit(
  ctx: ElaboratedContext,
  stimuli: Stimuli,
  options: SimulateOptions
): SimulationTrace {
  const { flat, library } = ctx;

  // Apply memory guards
  const cycles = Math.min(options.cycles, MAX_SIMULATION_CYCLES);
  const sampleRate = options.sampleRate ?? 1;

  // Determine which signals to observe
  let observeSignals = options.observeSignals;
  if (!observeSignals) {
    // Default: observe all top-level outputs and register outputs
    observeSignals = [];

    // Add top-level outputs
    for (const output of flat.topLevelOutputs) {
      observeSignals.push(output.name);
    }

    // Add register outputs (limited)
    for (const node of flat.nodes) {
      const component = library.resolveComponent(node.primitiveType);
      if (component?.metadata?.kind === 'sequential') {
        for (const output of node.outputs) {
          observeSignals.push(`${node.id}.${output.name}`);
        }
      }
    }

    // Apply signal limit
    if (observeSignals.length > MAX_OBSERVED_SIGNALS) {
      observeSignals = observeSignals.slice(0, MAX_OBSERVED_SIGNALS);
    }
  }

  // Create simulator
  const simulator = createSimulator(flat, { componentLibrary: library });

  // Initialize traces
  const signals: Record<string, (BitValue | BusValue)[]> = {};
  const registers: Record<string, (BitValue | BusValue)[]> = {};
  const sampledCycles: number[] = [];

  // Initialize signal arrays
  for (const sig of observeSignals) {
    signals[sig] = [];
  }

  // Run simulation
  for (let cycle = 0; cycle < cycles; cycle++) {
    // Set inputs for this cycle
    setInputsForCycle(simulator, stimuli, cycle);

    // Run one tick
    const result = simulator.tick();

    // Sample if needed
    if (cycle % sampleRate === 0) {
      sampledCycles.push(cycle);

      // Capture signal values
      for (const sig of observeSignals) {
        const value = getSignalValue(result.portValues, sig);
        signals[sig]?.push(value);
      }

      // Capture register values
      for (const [regId, state] of result.sequentialState.currentState) {
        if (!registers[regId]) {
          registers[regId] = [];
        }
        // Convert state to a simple value
        const value = stateToValue(state);
        registers[regId].push(value);
      }
    }
  }

  return {
    cycles,
    signals,
    registers,
    sampleRate,
    sampledCycles,
  };
}

/**
 * Set inputs for a specific cycle.
 */
function setInputsForCycle(
  simulator: ReturnType<typeof createSimulator>,
  stimuli: Stimuli,
  cycle: number
): void {
  for (const [inputName, values] of Object.entries(stimuli.inputs)) {
    let value: BitValue | BusValue;

    if (Array.isArray(values)) {
      // Sequence of values - use cycle index (wrap if needed)
      value = values[cycle % values.length];
    } else {
      // Constant value
      value = values;
    }

    simulator.setInput(inputName, value);
  }
}

/**
 * Get a signal value from port values map.
 */
function getSignalValue(
  portValues: Map<string, BitValue | BusValue>,
  signalName: string
): BitValue | BusValue {
  // Try direct lookup
  const direct = portValues.get(signalName);
  if (direct !== undefined) {
    return direct;
  }

  // Try with __top__ prefix for top-level signals
  const topLevel = portValues.get(`__top__.${signalName}`);
  if (topLevel !== undefined) {
    return topLevel;
  }

  // Default to false/0
  return false;
}

/**
 * Convert state value to simple value for traces.
 */
function stateToValue(state: unknown): BitValue | BusValue {
  if (typeof state === 'boolean') {
    return state;
  }
  if (typeof state === 'number') {
    return state;
  }
  if (state instanceof Map) {
    // Memory state - return size as indicator
    return state.size;
  }
  return 0;
}

// ============================================================================
// Behavioral Diagnostics
// ============================================================================

/**
 * Extract behavioral diagnostics from a simulation trace.
 * These are design insights, NOT errors.
 */
export function extractBehavioralDiagnostics(
  trace: SimulationTrace
): BehavioralDiagnostic[] {
  const diagnostics: BehavioralDiagnostic[] = [];

  // Check for constant signals
  for (const [signal, values] of Object.entries(trace.signals)) {
    if (values.length > 1 && allEqual(values)) {
      diagnostics.push({
        code: 'OUTPUT_CONSTANT',
        severity: 'info',
        message: `Signal '${signal}' is constant (always ${formatValue(values[0])})`,
        node: signal,
        suggestion: 'This signal may be redundant or incorrectly wired',
      });
    }
  }

  // Check for registers that never update
  for (const [reg, values] of Object.entries(trace.registers)) {
    if (values.length > 1 && allEqual(values)) {
      diagnostics.push({
        code: 'REGISTER_NEVER_UPDATES',
        severity: 'suggestion',
        message: `Register '${reg}' never changes value`,
        node: reg,
        suggestion: 'Check if clock or enable signal is connected',
      });
    }
  }

  // Check for high toggle rate
  for (const [signal, values] of Object.entries(trace.signals)) {
    if (values.length > 2) {
      const toggleRate = computeToggleRate(values);
      if (toggleRate > ANALYSIS_THRESHOLDS.HIGH_TOGGLE_RATE) {
        diagnostics.push({
          code: 'HIGH_TOGGLE_RATE',
          severity: 'info',
          message: `Signal '${signal}' has high toggle rate (${(toggleRate * 100).toFixed(1)}%)`,
          node: signal,
          suggestion: 'High toggle rates increase power consumption',
        });
      }
    }
  }

  // Check for low activity
  for (const [signal, values] of Object.entries(trace.signals)) {
    if (values.length > 10) {
      const toggleRate = computeToggleRate(values);
      if (toggleRate < ANALYSIS_THRESHOLDS.LOW_ACTIVITY && toggleRate > 0) {
        diagnostics.push({
          code: 'LOW_ACTIVITY',
          severity: 'info',
          message: `Signal '${signal}' has very low activity (${(toggleRate * 100).toFixed(2)}%)`,
          node: signal,
          suggestion: 'Signal may be used rarely or could be power-gated',
        });
      }
    }
  }

  // Sort diagnostics for deterministic output
  diagnostics.sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return (a.node ?? '').localeCompare(b.node ?? '');
  });

  return diagnostics;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if all values in an array are equal.
 */
function allEqual<T>(arr: T[]): boolean {
  if (arr.length === 0) return true;
  const first = arr[0];
  return arr.every(v => v === first);
}

/**
 * Compute toggle rate (percentage of transitions).
 */
function computeToggleRate(values: (BitValue | BusValue)[]): number {
  if (values.length < 2) return 0;

  let transitions = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) {
      transitions++;
    }
  }

  return transitions / (values.length - 1);
}

/**
 * Format a value for display.
 */
function formatValue(value: BitValue | BusValue): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return value.toString();
}

// ============================================================================
// Trace Analysis Utilities
// ============================================================================

/**
 * Get the value of a signal at a specific cycle.
 */
export function getValueAtCycle(
  trace: SimulationTrace,
  signalName: string,
  cycle: number
): BitValue | BusValue | undefined {
  const values = trace.signals[signalName] ?? trace.registers[signalName];
  if (!values) return undefined;

  // Account for sample rate
  const sampleIndex = Math.floor(cycle / trace.sampleRate);
  return values[sampleIndex];
}

/**
 * Get all values for a signal.
 */
export function getSignalValues(
  trace: SimulationTrace,
  signalName: string
): (BitValue | BusValue)[] {
  return trace.signals[signalName] ?? trace.registers[signalName] ?? [];
}

/**
 * Find cycles where a signal changes.
 */
export function findTransitions(
  trace: SimulationTrace,
  signalName: string
): number[] {
  const values = getSignalValues(trace, signalName);
  const transitions: number[] = [];

  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) {
      transitions.push(trace.sampledCycles[i]);
    }
  }

  return transitions;
}

/**
 * Check if a signal ever has a specific value.
 */
export function signalEverEquals(
  trace: SimulationTrace,
  signalName: string,
  value: BitValue | BusValue
): boolean {
  const values = getSignalValues(trace, signalName);
  return values.some(v => v === value);
}

/**
 * Compress unchanged runs in a trace for efficiency.
 * Returns a compressed representation.
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

/**
 * Compress runs of identical values.
 */
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
