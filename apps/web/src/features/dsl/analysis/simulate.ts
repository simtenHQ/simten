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
  SignalMetrics,
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

  const baseTrace: SimulationTrace = {
    cycles,
    signals,
    registers,
    sampleRate,
    sampledCycles,
  };

  // Compute post-simulation enrichments
  baseTrace.steadyStateAt = detectSteadyState(baseTrace);
  baseTrace.signalMetrics = computeAllSignalMetrics(baseTrace);

  return baseTrace;
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
 *
 * @param trace - The simulation trace to analyze
 * @param ctx - Optional elaborated context; when provided, causality chain
 *   diagnostics are added for register state transitions.
 */
export function extractBehavioralDiagnostics(
  trace: SimulationTrace,
  ctx?: ElaboratedContext
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

  // Causality chain diagnostics (requires elaborated context for topology)
  if (ctx) {
    const causalityDiagnostics = extractCausalityChains(trace, ctx);
    diagnostics.push(...causalityDiagnostics);
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

// ============================================================================
// Steady-State Detection
// ============================================================================

/**
 * Number of trailing constant cycles required to declare steady state.
 * A window of 5 ensures transient settling is complete before we report.
 */
const STEADY_STATE_WINDOW = 5;

/**
 * Detect the earliest sampled cycle index at which all observed signals
 * (both combinational outputs and register outputs) became constant and
 * remained so for at least STEADY_STATE_WINDOW consecutive samples.
 *
 * Returns the cycle NUMBER (from sampledCycles) of that first stable sample,
 * or undefined if the circuit never stabilised within the simulation window.
 *
 * Implementation note: we scan from the END of the trace backward to find the
 * earliest point where the trailing STEADY_STATE_WINDOW samples are all equal,
 * then continue scanning forward until we find the first run that is long enough.
 */
export function detectSteadyState(trace: SimulationTrace): number | undefined {
  // Collect all value arrays (signals + registers)
  const allSeries = [
    ...Object.values(trace.signals),
    ...Object.values(trace.registers),
  ];

  // Need at least STEADY_STATE_WINDOW samples to make a meaningful judgment
  const totalSamples = trace.sampledCycles.length;
  if (totalSamples < STEADY_STATE_WINDOW) {
    return undefined;
  }

  // For each candidate start index (from 0 to totalSamples - STEADY_STATE_WINDOW)
  // check whether all series are constant from that index to the end of the trace.
  // We want the *earliest* such index.
  for (let startIdx = 0; startIdx <= totalSamples - STEADY_STATE_WINDOW; startIdx++) {
    let allConstantFromHere = true;

    for (const series of allSeries) {
      if (series.length === 0) continue;

      // The reference value is the value at startIdx
      const referenceValue = series[startIdx];

      // Check that every subsequent sample equals the reference
      for (let i = startIdx + 1; i < series.length; i++) {
        if (series[i] !== referenceValue) {
          allConstantFromHere = false;
          break;
        }
      }

      if (!allConstantFromHere) break;
    }

    if (allConstantFromHere) {
      // Return the actual cycle number, not the sample index
      return trace.sampledCycles[startIdx];
    }
  }

  return undefined;
}

// ============================================================================
// Signal Metrics
// ============================================================================

/**
 * Compute activity metrics for a single value series.
 *
 * @param values - Sampled values for the signal
 * @returns SignalMetrics with transition count and optional duty cycle
 */
function computeSeriesMetrics(values: (BitValue | BusValue)[]): SignalMetrics {
  if (values.length === 0) {
    return { transitions: 0 };
  }

  let transitions = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) {
      transitions++;
    }
  }

  // Compute duty cycle only for boolean (Bit) signals
  const isBitSignal = values.every(v => typeof v === 'boolean');
  let dutyCycle: number | undefined;
  if (isBitSignal && values.length > 0) {
    const trueCount = values.filter(v => v === true).length;
    dutyCycle = trueCount / values.length;
  }

  return { transitions, dutyCycle };
}

/**
 * Compute per-signal metrics for all signals and registers in a trace.
 *
 * @param trace - The simulation trace
 * @returns Map of signal/register name to its metrics
 */
export function computeAllSignalMetrics(
  trace: SimulationTrace
): Record<string, SignalMetrics> {
  const metrics: Record<string, SignalMetrics> = {};

  for (const [name, values] of Object.entries(trace.signals)) {
    metrics[name] = computeSeriesMetrics(values);
  }

  for (const [name, values] of Object.entries(trace.registers)) {
    metrics[name] = computeSeriesMetrics(values);
  }

  return metrics;
}

// ============================================================================
// Causality Chain Diagnostics
// ============================================================================

/**
 * Trace the upstream source for a given node's input port through the
 * connection graph of the flat circuit.
 *
 * Returns a human-readable description such as:
 *   "adder0.out (computed from a.out + b.out)"
 * or simply the source port path if no further elaboration is available.
 */
function traceInputSource(
  nodeId: string,
  portName: string,
  ctx: ElaboratedContext
): string {
  const { flat } = ctx;
  const targetKey = `${nodeId}.${portName}`;

  // Find the connection whose target matches this node/port
  const conn = flat.connections.find(
    (c) => c.target.nodeId === nodeId && c.target.portName === portName
  );

  if (!conn) {
    return targetKey;
  }

  const srcNodeId = conn.source.nodeId;
  const srcPortName = conn.source.portName;

  // If the source is the top-level node, name it clearly
  if (srcNodeId === '__top__') {
    return `circuit input '${srcPortName}'`;
  }

  const srcNode = flat.nodeMap.get(srcNodeId);
  if (!srcNode) {
    return `${srcNodeId}.${srcPortName}`;
  }

  // Describe the source node's inputs to explain what it computed
  const inputDescriptions = srcNode.inputSources
    .slice(0, 3) // Keep description concise
    .map((is) => {
      if (is.sourceNodeId === '__top__') {
        return `input '${is.sourcePortName}'`;
      }
      return `${is.sourceNodeId}.${is.sourcePortName}`;
    });

  const computedFrom =
    inputDescriptions.length > 0
      ? ` (computed from ${inputDescriptions.join(', ')})`
      : '';

  return `${srcNodeId}.${srcPortName}${computedFrom}`;
}

/**
 * Extract causality chain diagnostics for all registers that changed value
 * during the simulation.
 *
 * For each register update, we emit a STATE_TRANSITION_EXPLAINED diagnostic
 * that describes what value the register captured and where that value came from.
 * This helps the LLM agent understand the data-flow reason behind state changes.
 *
 * @param trace - The simulation trace
 * @param ctx - Elaborated context providing the flat circuit topology
 * @returns Array of causality-chain behavioral diagnostics
 */
export function extractCausalityChains(
  trace: SimulationTrace,
  ctx: ElaboratedContext
): BehavioralDiagnostic[] {
  const diagnostics: BehavioralDiagnostic[] = [];
  const { flat, library } = ctx;

  for (const [regId, values] of Object.entries(trace.registers)) {
    if (values.length < 2) continue;

    // Collect the first few state transitions for this register
    const transitionCycles: Array<{
      cycle: number;
      fromValue: BitValue | BusValue;
      toValue: BitValue | BusValue;
    }> = [];

    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1]) {
        transitionCycles.push({
          cycle: trace.sampledCycles[i],
          fromValue: values[i - 1],
          toValue: values[i],
        });
        // Limit to first 3 transitions per register to keep output manageable
        if (transitionCycles.length >= 3) break;
      }
    }

    if (transitionCycles.length === 0) continue;

    // Find the flat node for this register
    const regNode = flat.nodeMap.get(regId);
    if (!regNode) continue;

    // Verify it is actually a sequential node
    const component = library.resolveComponent(regNode.primitiveType);
    if (component?.metadata?.kind !== 'sequential') continue;

    // Find the data input port (conventionally named 'd' or 'in' or 'data';
    // fall back to the first input port if none of the canonical names match)
    const dataPort =
      regNode.inputs.find((p) =>
        ['d', 'in', 'data', 'value'].includes(p.name.toLowerCase())
      ) ?? regNode.inputs[0];

    // Describe the data source
    const sourceDescription = dataPort
      ? traceInputSource(regId, dataPort.name, ctx)
      : 'unknown source';

    // Build a transition summary string
    const transitionSummary = transitionCycles
      .map((t) => `${formatValue(t.fromValue)} -> ${formatValue(t.toValue)} at cycle ${t.cycle}`)
      .join('; ');

    diagnostics.push({
      code: 'STATE_TRANSITION_EXPLAINED',
      severity: 'info',
      message: `Register '${regId}' updated: ${transitionSummary}. Data captured from ${sourceDescription}.`,
      node: regId,
      suggestion: undefined,
    });
  }

  return diagnostics;
}
