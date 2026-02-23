/**
 * Testbench Runner
 *
 * Executes testbenches by applying cycle-by-cycle stimulus to the DUT
 * and collecting output traces. Uses the high-level SimulatorEngine API.
 *
 * Design: Simulates the DUT circuit directly (not the testbench wrapper circuit).
 * Stimulus port names map directly to DUT top-level inputs, so setInput() works
 * without the tb_input_* indirection needed by the visual editor.
 *
 * Pipeline:
 *   TestbenchDef AST -> compile stimulus -> create DUT simulator
 *   -> per-cycle: apply stimulus, tick, collect outputs
 *   -> return trace + optional VCD
 */

import type { TestbenchDef } from '../types/testbench-ast.js';
import type {
  StimulusSchedule,
  CaptureData,
  TraceData,
  SignalRef,
  Testbench,
} from '../../types/testbench.js';
import { getStimulusActions, signalKey } from '../../types/testbench.js';
import type {
  Circuit,
  ComponentLibrary,
  BitValue,
  BusValue,
} from '../../types/circuit.js';
import { TOP_LEVEL_NODE } from '../../types/circuit.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import { compileStimulus, validateStimulus } from './stimulus-compiler.js';
import { generateVCD } from './vcd-generator.js';
import { compileAssertions, validateAssertionSignals } from '../compiler/testbench-compiler.js';
import { evaluateAssertions } from '../harness/assertion-evaluator.js';
import type { AssertionSummary } from '../harness/assertion-evaluator.js';
import type { SimulationTrace } from '../analysis/types.js';

// ============================================================================
// Types
// ============================================================================

export interface TestbenchRunOptions {
  maxCycles?: number;
  verbose?: boolean;
}

export interface TestbenchRunResult {
  name: string;
  dutName: string;
  cycles: number;
  status: 'passed' | 'failed';
  failureReason?: string;

  /** Per-cycle port values: key -> value[] (one per cycle) */
  signals: Record<string, (BitValue | BusValue)[]>;

  /** Cycle numbers that were sampled */
  sampledCycles: number[];

  /** VCD string if capture was configured */
  vcd?: string;

  /** Assertion evaluation summary (undefined if no assert blocks) */
  assertionSummary?: AssertionSummary;
}

// ============================================================================
// Runner
// ============================================================================

/**
 * Run a testbench against a DUT circuit.
 *
 * @param tb - Parsed testbench AST
 * @param dut - The circuit under test
 * @param library - Component library for elaboration
 * @param options - Run options
 */
export function runTestbench(
  tb: TestbenchDef,
  dut: Circuit,
  library: ComponentLibrary,
  options?: TestbenchRunOptions
): TestbenchRunResult {
  // Compile stimulus from AST
  let stimulus: StimulusSchedule;
  if (tb.impl?.stimulus && tb.impl.stimulus.length > 0) {
    stimulus = compileStimulus(tb.impl.stimulus[0]);
    validateStimulus(stimulus);
  } else {
    stimulus = { clockRef: tb.clocks[0]?.name || 'clk', events: new Map() };
  }

  // Determine max cycles: option > stimulus max cycle + 1 > 100
  const stimulusMaxCycle = stimulus.events.size > 0
    ? Math.max(...Array.from(stimulus.events.keys())) + 1
    : 0;
  const cycles = options?.maxCycles ?? Math.max(stimulusMaxCycle, 100);

  // Create simulator for the DUT directly
  const simulator = createSimulatorFromCircuit(dut, library);

  // Track per-cycle signal values
  const signals: Record<string, (BitValue | BusValue)[]> = {};
  const sampledCycles: number[] = [];

  // Build capture config for VCD (if requested in testbench)
  let captureData: CaptureData | undefined;
  if (tb.impl?.capture) {
    captureData = buildCaptureData(tb, dut);
  }

  // Run simulation cycle by cycle
  let failureReason: string | undefined;

  for (let cycle = 0; cycle < cycles; cycle++) {
    // Apply stimulus for this cycle
    const actions = getStimulusActions(stimulus, cycle);
    for (const action of actions) {
      simulator.setInput(action.portName, action.value as BitValue | BusValue);
    }

    // Tick
    const result = simulator.tick();
    sampledCycles.push(cycle);

    // Collect all port values
    for (const [key, value] of result.portValues) {
      if (!signals[key]) signals[key] = [];
      signals[key].push(value);
    }

    // Collect capture data for VCD
    if (captureData) {
      collectCaptureValues(captureData, result.portValues, cycle);
    }
  }

  // Generate VCD if capture configured
  let vcd: string | undefined;
  if (captureData) {
    vcd = generateVCD(captureData);
  }

  // Evaluate assertions if present
  let assertionSummary: AssertionSummary | undefined;
  if (tb.impl?.assertions && tb.impl.assertions.length > 0) {
    // Validate signal references against DUT ports
    validateAssertionSignals(tb.impl.assertions, dut);

    // Compile assertion AST to executable schedule
    const compiledSchedule = compileAssertions(tb.impl.assertions);

    // Build SimulationTrace from collected signals
    // The assertion evaluator looks up signals by bare name (e.g. "count"),
    // but our runner stores them with __top__. prefix (e.g. "__top__.count").
    // Add both forms so closures can resolve either way.
    const traceSignals: Record<string, (BitValue | BusValue)[]> = {};
    const topPrefix = `${TOP_LEVEL_NODE}.`;
    for (const [key, values] of Object.entries(signals)) {
      traceSignals[key] = values;
      if (key.startsWith(topPrefix)) {
        traceSignals[key.slice(topPrefix.length)] = values;
      }
    }

    const trace: SimulationTrace = {
      cycles,
      signals: traceSignals,
      registers: {},
      sampleRate: 1,
      sampledCycles,
    };

    // Build minimal Testbench IR for evaluateAssertions()
    const minimalTestbench = { assertions: compiledSchedule } as Testbench;
    assertionSummary = evaluateAssertions(minimalTestbench, trace);

    // If any assertion failed, mark the run as failed
    if (!assertionSummary.allPassed && !failureReason) {
      failureReason = assertionSummary.firstFailure
        ? `Assertion failed at cycle ${assertionSummary.firstFailure.cycle}: ${assertionSummary.firstFailure.message}`
        : 'One or more assertions failed';
    }
  }

  return {
    name: tb.name,
    dutName: tb.circuitRef.circuitName,
    cycles,
    status: failureReason ? 'failed' : 'passed',
    failureReason,
    signals,
    sampledCycles,
    vcd,
    assertionSummary,
  };
}

// ============================================================================
// VCD Capture Helpers
// ============================================================================

/**
 * Build CaptureData structure from testbench capture config.
 */
function buildCaptureData(tb: TestbenchDef, dut: Circuit): CaptureData {
  const captureBlock = tb.impl!.capture!;
  const signalRefs: SignalRef[] = [];

  for (const sigName of captureBlock.signals) {
    // Check DUT inputs
    const inputPort = dut.inputs.find(p => p.name === sigName);
    if (inputPort) {
      signalRefs.push({
        nodeId: '',
        portName: sigName,
        displayName: sigName,
        width: inputPort.portType.kind === 'bus' ? inputPort.portType.width : 1,
      });
      continue;
    }

    // Check DUT outputs
    const outputPort = dut.outputs.find(p => p.name === sigName);
    if (outputPort) {
      signalRefs.push({
        nodeId: '',
        portName: sigName,
        displayName: sigName,
        width: outputPort.portType.kind === 'bus' ? outputPort.portType.width : 1,
      });
      continue;
    }

    // Unknown signal — add with width 1
    signalRefs.push({
      nodeId: '',
      portName: sigName,
      displayName: sigName,
      width: 1,
    });
  }

  const traces = new Map<string, TraceData>();
  for (const ref of signalRefs) {
    traces.set(signalKey(ref), {
      signal: ref,
      values: [],
      changes: [],
    });
  }

  return {
    config: {
      signals: signalRefs,
      format: 'vcd',
      filename: captureBlock.filename,
    },
    traces,
  };
}

/**
 * Collect port values for VCD capture for a single cycle.
 */
function collectCaptureValues(
  captureData: CaptureData,
  portValues: Map<string, BitValue | BusValue>,
  cycle: number
): void {
  for (const [_key, trace] of captureData.traces) {
    const value = resolveSignalValue(trace.signal, portValues);

    trace.values.push(value);

    // Track changes for efficient VCD
    if (trace.changes.length === 0 || trace.changes[trace.changes.length - 1].value !== value) {
      trace.changes.push({ cycle, value });
    }
  }
}

/**
 * Resolve a signal value from the flat simulator's port values map.
 *
 * Tries multiple key formats since the flat simulator uses hierarchical keys.
 */
function resolveSignalValue(
  signal: SignalRef,
  portValues: Map<string, BitValue | BusValue>
): BitValue | BusValue {
  const portName = signal.portName;

  // Try __top__.portName (top-level input/output)
  const topKey = `${TOP_LEVEL_NODE}.${portName}`;
  const topVal = portValues.get(topKey);
  if (topVal !== undefined) return topVal;

  // Try any key ending with .portName
  for (const [key, val] of portValues) {
    if (key.endsWith(`.${portName}`)) {
      return val;
    }
  }

  // Default
  return signal.width === 1 ? false : 0;
}
