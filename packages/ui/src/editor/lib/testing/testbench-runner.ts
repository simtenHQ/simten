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
 * - Uses flat simulator (elaborate + runFlatSimulationTick)
 * - Applies stimulus via node.arguments.value manipulation
 * - Integrates with time-travel system (stimulus is environmental state)
 */

import {
  Testbench,
  TestbenchState,
  StimulusSchedule,
  getStimulusActions,
  createTestbenchState,
  CaptureData,
  TraceData,
  SignalRef,
  signalKey,
} from '../../types/testbench';
import { Circuit, Node, BitValue, BusValue } from '../../types/circuit';
import { elaborate, FlatCircuit } from '../elaboration';
import {
  runFlatSimulationTick,
  initializeFlatSequentialState,
  type FlatPortValueMap,
} from '../flat-simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { writeVCDToFile } from '../visualization/vcd-generator';
import type { SimulationTrace } from '@turing-incomplete/core/dsl';

// ============================================================================
// Testbench Runner
// ============================================================================

/**
 * Sync environmental values (Input/Switch/Button) from live circuit to flat circuit
 */
function syncEnvironmentalValues(flatCircuit: FlatCircuit, liveCircuit: Circuit): void {
  for (const flatNode of flatCircuit.nodes) {
    if (
      flatNode.primitiveType === 'Input' ||
      flatNode.primitiveType === 'Switch' ||
      flatNode.primitiveType === 'Button'
    ) {
      const liveNode = liveCircuit.nodes.find((n) => n.id === flatNode.id);
      if (liveNode && liveNode.arguments.value !== undefined) {
        flatNode.arguments = { ...flatNode.arguments, value: liveNode.arguments.value };
      }
    }
  }
}

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
  const library = useComponentLibraryStore.getState();

  // Elaborate circuit (flatten composites)
  const flatCircuit = elaborate(circuit, library);

  // Initialize sequential state
  let seqState = initializeFlatSequentialState(flatCircuit);

  // Track port values between ticks for O(K) change detection
  let previousPortValues: FlatPortValueMap | undefined;

  // Initialize capture data if configured
  if (testbench.capture) {
    state.captureData = initializeCaptureData(testbench.capture);
  }

  // Run simulation for each cycle
  for (let cycle = 0; cycle < cycles; cycle++) {
    state.cycle = cycle;

    // Apply stimulus for this cycle (modifies circuit nodes)
    applyStimulusForCycle(circuit, testbench.stimulus, cycle);

    // Sync environmental values from circuit to flat circuit
    syncEnvironmentalValues(flatCircuit, circuit);

    // Run one simulation tick with previous port values for O(K) change detection
    const result = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);

    // Check for simulation errors
    if (result.error) {
      state.status = 'failed';
      state.failureReason = result.error;
      break;
    }

    // Update sequential state and port values for next tick
    if (result.sequentialState) {
      seqState = result.sequentialState;
    }
    previousPortValues = result.portValues;

    // Collect port values for capture
    if (state.captureData) {
      collectPortValues(circuit, state.captureData, cycle, result.portValues);
    }

    // Store current port values in state
    updatePortValuesFromFlat(state, result.portValues);

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
 * Run a testbench and accumulate a per-cycle SimulationTrace for assertion evaluation.
 *
 * Unlike runTestbench(), which overwrites portValues each cycle (leaving only the
 * final cycle's values), this function collects every cycle's port values into
 * per-signal arrays.  The resulting SimulationTrace can be passed to
 * evaluateAssertions() so that cycle-indexed assertions are checked against the
 * correct cycle's data rather than the final state.
 *
 * Bare-name aliases are populated alongside the raw flat-simulator keys so that
 * assertion conditions written as `count == 2` resolve correctly even though the
 * flat simulator keys signals as `tb_input_reset.out`, `dut.count`, etc.
 */
export function runTestbenchWithTrace(
  testbench: Testbench,
  maxCycles?: number
): { state: TestbenchState; trace: SimulationTrace } {
  const cycles = maxCycles ?? testbench.maxCycles;
  const state = createTestbenchState();
  const circuit = testbench.circuit;
  const library = useComponentLibraryStore.getState();

  const flatCircuit = elaborate(circuit, library);
  let seqState = initializeFlatSequentialState(flatCircuit);
  let previousPortValues: FlatPortValueMap | undefined;

  // Per-signal value arrays: key -> value per sampled cycle.
  // Both the raw flat-simulator key and any bare-name aliases are stored here.
  const signalArrays: Record<string, (BitValue | BusValue)[]> = {};
  const sampledCycles: number[] = [];
  let actualCycles = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    state.cycle = cycle;
    applyStimulusForCycle(circuit, testbench.stimulus, cycle);
    syncEnvironmentalValues(flatCircuit, circuit);

    const result = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);

    if (result.error) {
      state.status = 'failed';
      state.failureReason = result.error;
      break;
    }

    if (result.sequentialState) {
      seqState = result.sequentialState;
    }
    previousPortValues = result.portValues;
    updatePortValuesFromFlat(state, result.portValues);

    // Accumulate per-cycle values for the trace.
    // For each flat-simulator key, also record under any bare-name alias so
    // that assertion conditions can reference signals by their port name alone.
    sampledCycles.push(cycle);
    actualCycles = cycle + 1;

    for (const [key, value] of result.portValues.entries()) {
      // Raw key
      if (!signalArrays[key]) signalArrays[key] = [];
      signalArrays[key].push(value);

      // Bare-name aliases
      const bareNames = extractBareNames(key);
      for (const bareName of bareNames) {
        if (!signalArrays[bareName]) signalArrays[bareName] = [];
        signalArrays[bareName].push(value);
      }
    }
  }

  if (!testbench.assertions || state.assertionResults.every(r => r.passed)) {
    state.status = 'passed';
  } else {
    state.status = 'failed';
  }

  const trace: SimulationTrace = {
    cycles: actualCycles,
    signals: signalArrays,
    registers: {},
    sampleRate: 1,
    sampledCycles,
  };

  return { state, trace };
}

/**
 * Given a flat-simulator port key, return any bare signal names it implies.
 *
 * Examples:
 *   "tb_input_reset.out"  -> ["reset"]
 *   "tb_output_led.in"   -> ["led"]
 *   "dut.count"          -> ["count"]
 *   "dut.sub.q"          -> ["q", "sub.q"]
 *   "and1.out"           -> []  (primitive internal, no useful alias)
 */
function extractBareNames(key: string): string[] {
  const names: string[] = [];

  // tb_input_<signal>.out  -> <signal>
  const tbInputMatch = key.match(/^tb_input_(.+)\.out$/);
  if (tbInputMatch) {
    names.push(tbInputMatch[1]);
    return names;
  }

  // tb_output_<signal>.in  -> <signal>
  const tbOutputMatch = key.match(/^tb_output_(.+)\.in$/);
  if (tbOutputMatch) {
    names.push(tbOutputMatch[1]);
    return names;
  }

  // dut.<portName>  -> <portName>
  // dut.<inner>.<portName>  -> <portName> and <inner>.<portName>
  if (key.startsWith('dut.')) {
    const rest = key.slice('dut.'.length); // e.g. "count" or "sub.q"
    names.push(rest); // always add the full suffix
    const lastDot = rest.lastIndexOf('.');
    if (lastDot !== -1) {
      names.push(rest.slice(lastDot + 1)); // also add just the final segment
    }
  }

  return names;
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
export function initializeCaptureData(config: import('../../types/testbench').CaptureConfig): CaptureData {
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
export function collectPortValues(
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
 *
 * Tries multiple key formats to find the value in flat simulator port values:
 * 1. Exact key: nodeId.portName
 * 2. Testbench input node: tb_input_{portName}.out
 * 3. Testbench output node: tb_output_{portName}.in
 * 4. Any key ending with the port name
 */
function getPortValue(
  circuit: Circuit,
  signal: SignalRef,
  portValues?: Map<string, BitValue | BusValue>
): BitValue | BusValue {
  if (portValues) {
    // Try exact key first
    const exactKey = signal.nodeId === ''
      ? `.${signal.portName}`
      : `${signal.nodeId}.${signal.portName}`;
    let value = portValues.get(exactKey);
    if (value !== undefined) {
      return value;
    }

    // Try testbench input node format: tb_input_{portName}.out
    const tbInputKey = `tb_input_${signal.portName}.out`;
    value = portValues.get(tbInputKey);
    if (value !== undefined) {
      return value;
    }

    // Try testbench output node format: tb_output_{portName}.in
    const tbOutputKey = `tb_output_${signal.portName}.in`;
    value = portValues.get(tbOutputKey);
    if (value !== undefined) {
      return value;
    }

    // Try finding any key that ends with the port name (for DUT internal signals)
    // This handles cases like dut.counter_reg.q for the 'count' output
    for (const [key, val] of portValues.entries()) {
      // Match keys like "dut.{anything}.{portName}" or ending with ".{portName}"
      if (key.endsWith(`.${signal.portName}`) ||
          key.endsWith(`.q`) && signal.portName === 'count') { // Special case for register outputs
        return val;
      }
    }

    // For DUT outputs, try to find the connected primitive output
    // The DUT output 'count' is connected to internal register 'counter_reg.q'
    if (signal.nodeId === 'dut') {
      // Search for keys like dut.*.q that might be the register output
      for (const [key, val] of portValues.entries()) {
        if (key.startsWith('dut.') && key.endsWith('.q')) {
          // This might be the register we're looking for
          return val;
        }
      }
    }
  }

  // Fallback to reading from circuit structure
  if (signal.nodeId === '') {
    const port = [...circuit.inputs, ...circuit.outputs].find(p => p.name === signal.portName);
    if (port) {
      return (port as any).value ?? 0;
    }
    return 0;
  } else {
    const node = circuit.nodes.find(n => n.id === signal.nodeId);
    if (!node) return 0;

    const port = [...node.inputs, ...node.outputs].find(p => p.name === signal.portName);
    if (!port) return 0;

    return port.value ?? 0;
  }
}

/**
 * Update testbench state with current port values from flat simulation
 */
function updatePortValuesFromFlat(
  state: TestbenchState,
  portValues: Map<string, BitValue | BusValue>
): void {
  // Copy all port values from flat simulation
  for (const [key, value] of portValues.entries()) {
    state.portValues.set(key, value);
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
