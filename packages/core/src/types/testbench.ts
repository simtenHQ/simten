/**
 * Testbench Intermediate Representation (IR)
 *
 * This is the compiled, executable representation of testbenches.
 * The testbench IR is generated from testbench AST by the testbench compiler.
 *
 * Design:
 * - Bit-level stimulus core (cycle-by-cycle value assignments)
 * - VCD waveform capture configuration
 * - Future-proof for multi-clock and assertions
 */

import type { BitValue, BusValue, Circuit } from './circuit.js';

// ============================================================================
// Testbench (Top Level)
// ============================================================================

/**
 * Compiled testbench ready for execution
 */
export interface Testbench {
  name: string;
  circuitRef: string; // Name of circuit under test
  dutInstanceId: string; // ID of DUT instance node
  circuit: Circuit; // The compiled circuit (includes DUT + test infrastructure)
  stimulus: StimulusSchedule;
  capture?: CaptureConfig;
  assertions?: AssertionSchedule; // Phase 5
  maxCycles: number; // Maximum simulation cycles
}

// ============================================================================
// Stimulus Schedule (Core)
// ============================================================================

/**
 * Compiled stimulus schedule
 *
 * Maps cycle number -> signal assignments for that cycle
 * Signals hold their previous value unless explicitly changed
 */
export interface StimulusSchedule {
  clockRef: string; // Which clock this stimulus is synchronized to
  events: Map<number, StimulusAction[]>; // cycle -> actions
}

/**
 * Single stimulus action (apply value to signal)
 */
export interface StimulusAction {
  nodeId: string; // Node instance ID (empty string for testbench-level ports)
  portName: string; // Port or argument name
  value: BitValue | BusValue;
}

// ============================================================================
// Capture Configuration (VCD Export)
// ============================================================================

/**
 * Configuration for waveform capture
 */
export interface CaptureConfig {
  signals: SignalRef[];
  format: 'vcd'; // Only VCD for now
  filename: string;
}

/**
 * Reference to a signal to capture
 */
export interface SignalRef {
  nodeId: string; // Empty string for circuit-level ports
  portName: string;
  displayName: string; // For VCD hierarchy
  width: number; // 1 for Bit, N for Bus[N]
}

// ============================================================================
// Assertion Schedule (Phase 5)
// ============================================================================

/**
 * Compiled assertion schedule
 */
export interface AssertionSchedule {
  clockRef: string;
  assertions: Map<number, CompiledAssertion[]>; // cycle -> assertions
}

/**
 * Single assertion to check at a cycle
 */
export interface CompiledAssertion {
  id: string;
  condition: (state: TestbenchState) => boolean; // Compiled to function
  message: string;
}

// ============================================================================
// Testbench State (Runtime)
// ============================================================================

/**
 * Testbench execution state
 */
export interface TestbenchState {
  cycle: number;
  portValues: Map<string, BitValue | BusValue>; // All port values
  assertionResults: AssertionResult[];
  captureData?: CaptureData; // Waveform data being collected
  status: 'running' | 'passed' | 'failed' | 'timeout';
  failureReason?: string;
}

/**
 * Result of an assertion check
 */
export interface AssertionResult {
  assertionId: string;
  cycle: number;
  passed: boolean;
  message: string;
}

/**
 * Captured waveform data
 */
export interface CaptureData {
  config: CaptureConfig;
  traces: Map<string, TraceData>; // signal key -> trace
}

/**
 * Trace data for a single signal
 */
export interface TraceData {
  signal: SignalRef;
  values: (BitValue | BusValue)[]; // One value per cycle
  changes: Array<{ cycle: number; value: BitValue | BusValue }>; // For efficient VCD
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a stimulus schedule
 */
export function createStimulusSchedule(clockRef: string): StimulusSchedule {
  return {
    clockRef,
    events: new Map(),
  };
}

/**
 * Add stimulus action to schedule
 */
export function addStimulusAction(
  schedule: StimulusSchedule,
  cycle: number,
  action: StimulusAction,
): void {
  if (!schedule.events.has(cycle)) {
    schedule.events.set(cycle, []);
  }
  schedule.events.get(cycle)!.push(action);
}

/**
 * Get stimulus actions for a cycle
 */
export function getStimulusActions(schedule: StimulusSchedule, cycle: number): StimulusAction[] {
  return schedule.events.get(cycle) || [];
}

/**
 * Create signal reference key for maps
 */
export function signalKey(signal: SignalRef): string {
  return signal.nodeId === '' ? signal.portName : `${signal.nodeId}.${signal.portName}`;
}

/**
 * Create a testbench state
 */
export function createTestbenchState(): TestbenchState {
  return {
    cycle: 0,
    portValues: new Map(),
    assertionResults: [],
    status: 'running',
  };
}

/**
 * Check if testbench has passed all assertions
 */
export function hasPassed(state: TestbenchState): boolean {
  return (
    state.status === 'passed' ||
    (state.assertionResults.length > 0 && state.assertionResults.every((r) => r.passed))
  );
}

/**
 * Check if testbench has failed any assertions
 */
export function hasFailed(state: TestbenchState): boolean {
  return state.status === 'failed' || state.assertionResults.some((r) => !r.passed);
}

/**
 * Get all failed assertions
 */
export function getFailedAssertions(state: TestbenchState): AssertionResult[] {
  return state.assertionResults.filter((r) => !r.passed);
}

/**
 * Get the maximum cycle number in the stimulus schedule
 */
export function getMaxStimulusCycle(schedule: StimulusSchedule): number {
  if (schedule.events.size === 0) return 0;
  return Math.max(...Array.from(schedule.events.keys()));
}
