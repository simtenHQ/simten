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
import {
  createComponentLibrary,
  getPrimitives,
} from '../simulator/index.js';
import type { Circuit, BitValue, BusValue } from '../types/circuit.js';

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
    allPassed: boolean;
    results: Array<{ cycle: number; passed: boolean; message: string }>;
  };
  signals: Record<string, (BitValue | BusValue)[]>;
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
  // Build shared mutable library
  const allCircuits: Circuit[] = [...getPrimitives()];
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

  // Parse and compile circuit source
  const { ast: circuitAst, errors: circuitParseErrors } = parseDSL(
    params.circuitSource,
    params.circuitSourceName ?? '<circuit>'
  );
  if (circuitParseErrors.length > 0) {
    const messages = circuitParseErrors.map(
      (e) => `${e.location.start.line}:${e.location.start.column} ${e.message}`
    );
    return { error: `Circuit parse errors:\n${messages.join('\n')}` };
  }

  try {
    const circuits = compileToIR(circuitAst, mutableLibrary);
    allCircuits.push(...circuits);
  } catch (e) {
    return {
      error: `Circuit compilation error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

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
        signals: {},
      });
      continue;
    }

    try {
      const result = runTestbench(tb, dut, library);
      results.push({
        name: result.name,
        dutName: result.dutName,
        status: result.status,
        cycles: result.cycles,
        failureReason: result.failureReason,
        assertionSummary: result.assertionSummary
          ? {
              total: result.assertionSummary.total,
              passed: result.assertionSummary.passed,
              failed: result.assertionSummary.failed,
              allPassed: result.assertionSummary.allPassed,
              results: result.assertionSummary.results.map((r) => ({
                cycle: r.cycle,
                passed: r.passed,
                message: r.message,
              })),
            }
          : undefined,
        signals: result.signals,
      });
    } catch (e) {
      results.push({
        name: tb.name,
        status: 'failed' as const,
        failureReason: e instanceof Error ? e.message : String(e),
        cycles: 0,
        signals: {},
      });
    }
  }

  return results;
}
