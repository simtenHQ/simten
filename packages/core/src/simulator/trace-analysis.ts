/**
 * Simulation-trace types and helpers consumed by the MCP server's `traceSource`.
 *
 * The richer validation/envelope/diagnostic surface that used to live here
 * was removed in the Diagnostics-sidebar cleanup (issue #99) — it had no
 * runtime producer, and every consumer was dead code.
 */

import type { BitValue, BusValue } from '../ir/circuit-ir.js';

// ============================================================================
// Simulation Traces
// ============================================================================

export interface SimulationTrace {
  cycles: number;
  signals: Record<string, (BitValue | BusValue)[]>;
  registers: Record<string, (BitValue | BusValue)[]>;
  sampleRate: number;
  sampledCycles: number[];
  steadyStateAt?: number;
  signalMetrics?: Record<string, SignalMetrics>;
}

export interface SignalMetrics {
  transitions: number;
  dutyCycle?: number;
}

// ============================================================================
// Trace utilities
// ============================================================================

/**
 * Compress unchanged runs in a trace for efficiency (RLE encoding).
 */
export function compressTrace(
  trace: SimulationTrace,
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

/**
 * Detect steady state: the earliest cycle at which all signals become constant.
 */
export function detectSteadyState(trace: SimulationTrace): number | undefined {
  const STEADY_STATE_WINDOW = 5;
  const allSeries = [...Object.values(trace.signals), ...Object.values(trace.registers)];
  const totalSamples = trace.sampledCycles.length;
  if (totalSamples < STEADY_STATE_WINDOW) return undefined;

  for (let startIdx = 0; startIdx <= totalSamples - STEADY_STATE_WINDOW; startIdx++) {
    let allConstant = true;
    for (const series of allSeries) {
      if (series.length === 0) continue;
      const ref = series[startIdx];
      for (let i = startIdx + 1; i < series.length; i++) {
        if (series[i] !== ref) {
          allConstant = false;
          break;
        }
      }
      if (!allConstant) break;
    }
    if (allConstant) return trace.sampledCycles[startIdx];
  }
  return undefined;
}
