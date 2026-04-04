/**
 * Testbench Handler
 *
 * Pure function to run testbenches against circuits.
 * Accepts already-resolved source strings, returns typed result.
 */

import {
  parseDSL,
  compileToIR,
  runTestbench,
} from '../dsl/index.js';
import type { ComponentLibrary } from '../dsl/index.js';
import { compressTrace } from '../dsl/analysis/simulate.js';
import type { SimulationTrace } from '../dsl/analysis/types.js';
import {
  createComponentLibrary,
  getPrimitives,
} from '../simulator/index.js';
import type { Circuit } from '../types/circuit.js';
import type { RLEValue } from './simulate.js';
import { compileSource } from './compile-source.js';

export interface TestbenchResult {
  name: string;
  dutName?: string;
  status: 'passed' | 'failed';
  cycles: number;
  failureReason?: string;
  assertionSummary?: {
    total: number;
    passed: number;
    failed: number;
    results: Array<{ cycle: number; passed: boolean; message: string }>;
  };
  signals?: Record<string, RLEValue[]>;
}

export interface TestError {
  error: string;
}

export function runTestbenchHandler(
  params: {
    circuitSource: string;
    circuitSourceName?: string;
    testbenchSource: string;
    testbenchSourceName?: string;
  },
): TestbenchResult[] | TestError {
  // Compile circuit source (auto-detects TS vs DSL)
  const compiledCircuits = compileSource(params.circuitSource, params.circuitSourceName);
  if (compiledCircuits.error) {
    return { error: `Circuit: ${compiledCircuits.error}` };
  }

  // Build shared mutable library including compiled circuits
  const allCircuits: Circuit[] = [...getPrimitives(), ...compiledCircuits.circuits];
  const mutableLibrary: ComponentLibrary = {
    resolveComponent: (name: string) =>
      allCircuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    getCircuit: (name: string) =>
      allCircuits.find((c) => c.name === name),
    hasCircuit: (name: string) =>
      allCircuits.some((c) => c.name === name),
    addCircuit: (circuit: Circuit) => {
      allCircuits.push(circuit);
    },
  };

  // Parse and compile testbench source
  const { ast: tbAst, errors: tbParseErrors } = parseDSL(
    params.testbenchSource,
    params.testbenchSourceName ?? '<testbench>'
  );
  if (tbParseErrors.length > 0) {
    const messages = tbParseErrors.map(
      (e) => `${e.location.start.line}:${e.location.start.column} ${e.message}`
    );
    return { error: `Testbench parse errors:\n${messages.join('\n')}` };
  }

  try {
    const circuits = compileToIR(tbAst, mutableLibrary);
    allCircuits.push(...circuits);
  } catch (e) {
    return {
      error: `Testbench compilation error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Find testbenches
  if (!tbAst.testbenches || tbAst.testbenches.length === 0) {
    return { error: 'No testbenches found in the provided source.' };
  }

  // Build final library
  const library = createComponentLibrary(allCircuits);

  // Run all testbenches
  const results: TestbenchResult[] = [];

  for (const tb of tbAst.testbenches) {
    const dutName = tb.circuitRef.circuitName;
    const dut = allCircuits.find((c) => c.name === dutName);

    if (!dut) {
      results.push({
        name: tb.name,
        status: 'failed' as const,
        failureReason: `DUT "${dutName}" not found`,
        cycles: 0,
      });
      continue;
    }

    try {
      const result = runTestbench(tb, dut, library);
      const failed = result.status === 'failed';

      // Compress signals only on failure; omit entirely on pass
      let compressedSignals: Record<string, RLEValue[]> | undefined;
      if (failed && result.signals && Object.keys(result.signals).length > 0) {
        const trace: SimulationTrace = {
          cycles: result.cycles,
          signals: result.signals,
          registers: {},
          sampleRate: 1,
          sampledCycles: Array.from({ length: result.cycles }, (_, i) => i),
        };
        compressedSignals = compressTrace(trace);
      }

      // Filter assertion results to only failing ones
      const assertionSummary = result.assertionSummary
        ? {
            total: result.assertionSummary.total,
            passed: result.assertionSummary.passed,
            failed: result.assertionSummary.failed,
            results: result.assertionSummary.results
              .filter((r) => !r.passed)
              .map((r) => ({
                cycle: r.cycle,
                passed: r.passed,
                message: r.message,
              })),
          }
        : undefined;

      results.push({
        name: result.name,
        dutName: result.dutName,
        status: result.status,
        cycles: result.cycles,
        failureReason: result.failureReason,
        assertionSummary,
        ...(compressedSignals ? { signals: compressedSignals } : {}),
      });
    } catch (e) {
      results.push({
        name: tb.name,
        status: 'failed' as const,
        failureReason: e instanceof Error ? e.message : String(e),
        cycles: 0,
      });
    }
  }

  return results;
}
