/**
 * Testbench Runner
 *
 * Executes testbenches by applying stimulus and running simulation.
 *
 * Features:
 * - Apply stimulus before each cycle
 * - Run simulation for specified cycles
 * - Collect port values for VCD export
 * - Evaluate assertions (Phase 5)
 *
 * Integration:
 * - Uses existing runSimulationTick() from simulator
 * - Applies stimulus via node.arguments.value manipulation
 * - Integrates with time-travel system (stimulus is environmental state)
 */

import {
  Testbench,
  TestbenchState,
  StimulusSchedule,
  StimulusAction,
  getStimulusActions,
  createTestbenchState,
  CaptureData,
  TraceData,
  SignalRef,
  signalKey,
} from '../types/testbench';
import { Circuit, Node, BitValue, BusValue } from '../types/ir-v0.1';
import { runSimulationTick, SequentialState, initializeSequentialState } from './simulator-v0.1';
import { generateVCD, writeVCDToFile } from './vcd-generator';

// ============================================================================
// Testbench Runner
// ============================================================================

/**
 * Run a testbench for specified number of cycles
 *
 * @param testbench - Compiled testbench to run
 * @param maxCycles - Maximum cycles to simulate (default from testbench)
 * @returns Final testbench state with results
 */
export function runTestbench(
  testbench: Testbench,
  maxCycles?: number
): TestbenchState {
  const cycles = maxCycles ?? testbench.maxCycles;
  const state = createTestbenchState();
  const circuit = testbench.circuit;

  // Initialize sequential state
  const seqState = initializeSequentialState(circuit);

  // Initialize capture data if configured
  if (testbench.capture) {
    state.captureData = initializeCaptureData(testbench.capture);
  }

  // Run simulation for each cycle
  for (let cycle = 0; cycle < cycles; cycle++) {
    state.cycle = cycle;

    // Apply stimulus for this cycle
    applyStimulusForCycle(circuit, testbench.stimulus, cycle);

    // Run one simulation tick
    const result = runSimulationTick(circuit, seqState);

    // Check for simulation errors
    if (result.error) {
      state.status = 'failed';
      state.failureReason = result.error;
      break;
    }

    // Collect port values for capture
    if (state.captureData) {
      collectPortValues(circuit, state.captureData, cycle, result.portValues);
    }

    // Store current port values in state
    updatePortValues(circuit, state);

    // TODO Phase 5: Evaluate assertions
    // if (testbench.assertions) {
    //   evaluateAssertions(testbench.assertions, cycle, state);
    // }
  }

  // Mark as passed if no assertions or all passed
  if (!testbench.assertions || state.assertionResults.every(r => r.passed)) {
    state.status = 'passed';
  } else {
    state.status = 'failed';
  }

  // Generate VCD file if capture is configured (skip if filename is empty - for testing)
  if (state.captureData && testbench.capture && testbench.capture.filename) {
    writeVCDToFile(state.captureData, testbench.capture.filename);
  }

  return state;
}

/**
 * Apply stimulus for a given cycle
 *
 * Modifies node arguments to set input values.
 * For circuit-level inputs (nodeId === ''), stores values in circuit.inputs[].value
 * Signals hold their previous value unless explicitly changed.
 */
function applyStimulusForCycle(
  circuit: Circuit,
  stimulus: StimulusSchedule,
  cycle: number
): void {
  const actions = getStimulusActions(stimulus, cycle);

  for (const action of actions) {
    if (action.nodeId === '') {
      // Circuit-level input - target the tb_input_* node
      // (testbench circuits use Input nodes that connect to DUT)
      const tbInputNode = circuit.nodes.find(n => n.id === `tb_input_${action.portName}`);
      if (tbInputNode) {
        tbInputNode.arguments.value = action.value;
      } else {
        console.warn(`Stimulus target testbench input not found: tb_input_${action.portName}`);
      }
    } else {
      // Node port - find the node and update its arguments
      const node = findNodeById(circuit, action.nodeId);
      if (!node) {
        console.warn(`Stimulus target node not found: ${action.nodeId}`);
        continue;
      }

      // Update the node's argument value
      // For testbench inputs driving DUT, these are stored as node arguments
      node.arguments[action.portName] = action.value;
    }
  }
}

/**
 * Find node by ID in circuit
 */
function findNodeById(circuit: Circuit, nodeId: string): Node | undefined {
  if (nodeId === '') {
    // Circuit-level port (not yet implemented)
    return undefined;
  }
  return circuit.nodes.find(n => n.id === nodeId);
}

/**
 * Initialize capture data structure
 */
function initializeCaptureData(config: import('../types/testbench').CaptureConfig): CaptureData {
  const traces = new Map<string, TraceData>();

  for (const signal of config.signals) {
    const key = signalKey(signal);
    traces.set(key, {
      signal,
      values: [],
      changes: [],
    });
  }

  return {
    config,
    traces,
  };
}

/**
 * Collect port values for current cycle
 */
function collectPortValues(
  circuit: Circuit,
  captureData: CaptureData,
  cycle: number,
  portValues?: Map<string, BitValue | BusValue>
): void {
  for (const [_key, trace] of captureData.traces) {
    const value = getPortValue(circuit, trace.signal, portValues);

    // Store value
    trace.values.push(value);

    // Track changes for efficient VCD generation
    if (trace.changes.length === 0 || trace.changes[trace.changes.length - 1].value !== value) {
      trace.changes.push({ cycle, value });
    }
  }
}

/**
 * Get current value of a signal
 */
function getPortValue(
  circuit: Circuit,
  signal: SignalRef,
  portValues?: Map<string, BitValue | BusValue>
): BitValue | BusValue {
  // First try to get from simulation portValues (most accurate)
  if (portValues) {
    const key = signal.nodeId === ''
      ? `.${signal.portName}`
      : `${signal.nodeId}.${signal.portName}`;
    const value = portValues.get(key);
    if (value !== undefined) {
      return value;
    }
  }

  // Fallback to reading from circuit structure
  if (signal.nodeId === '') {
    // Circuit-level port
    const port = [...circuit.inputs, ...circuit.outputs].find(p => p.name === signal.portName);
    if (port) {
      return (port as any).value ?? 0;
    }
    return 0;
  } else {
    // Node port
    const node = circuit.nodes.find(n => n.id === signal.nodeId);
    if (!node) return 0;

    const port = [...node.inputs, ...node.outputs].find(p => p.name === signal.portName);
    if (!port) return 0;

    return port.value ?? 0;
  }
}

/**
 * Update testbench state with current port values
 */
function updatePortValues(circuit: Circuit, state: TestbenchState): void {
  // Store all port values for assertions and inspection
  for (const node of circuit.nodes) {
    for (const port of [...node.inputs, ...node.outputs]) {
      const key = `${node.id}.${port.name}`;
      state.portValues.set(key, port.value ?? 0);
    }
  }
}

// ============================================================================
// Debugging and Inspection
// ============================================================================

/**
 * Format testbench state for debugging
 */
export function formatTestbenchState(state: TestbenchState): string {
  const lines: string[] = [];
  lines.push(`Testbench State (cycle ${state.cycle}):`);
  lines.push(`  Status: ${state.status}`);

  if (state.failureReason) {
    lines.push(`  Failure: ${state.failureReason}`);
  }

  if (state.assertionResults.length > 0) {
    const passed = state.assertionResults.filter(r => r.passed).length;
    const failed = state.assertionResults.filter(r => !r.passed).length;
    lines.push(`  Assertions: ${passed} passed, ${failed} failed`);

    for (const result of state.assertionResults.filter(r => !r.passed)) {
      lines.push(`    FAILED at cycle ${result.cycle}: ${result.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get summary of testbench run
 */
export function getTestbenchSummary(state: TestbenchState): {
  totalCycles: number;
  passed: boolean;
  assertionsPassed: number;
  assertionsFailed: number;
} {
  return {
    totalCycles: state.cycle,
    passed: state.status === 'passed',
    assertionsPassed: state.assertionResults.filter(r => r.passed).length,
    assertionsFailed: state.assertionResults.filter(r => !r.passed).length,
  };
}
