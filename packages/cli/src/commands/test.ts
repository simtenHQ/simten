import chalk from 'chalk';
import {
  createSimulatorFromCircuit,
  TOP_LEVEL_NODE,
} from '@turing-incomplete/core';
import type { Circuit, BitValue, BusValue } from '@turing-incomplete/core';
import { loadCircuitFile } from '../lib/file-loader.js';

interface TestOptions {
  verbose?: boolean;
  ticks?: string;
}

export async function test(filePaths: string[], opts: TestOptions): Promise<void> {
  const allCircuits: Circuit[] = [];
  let library: any = null;

  // Phase 1: Load and compile all files via TS builder
  for (const filePath of filePaths) {
    const { filePath: absPath, result, errors } = loadCircuitFile(filePath);

    if (errors.length > 0) {
      for (const err of errors) {
        console.error(chalk.red('error:'), err);
      }
      process.exit(1);
    }

    allCircuits.push(...result.circuits);
    library = result.library;
  }

  if (allCircuits.length === 0) {
    console.log(chalk.yellow('No circuits found.'));
    return;
  }

  // Phase 2: Run test cases defined via .testCases() on builder components
  const maxCycles = opts.ticks ? parseInt(opts.ticks, 10) : 100;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const circuit of allCircuits) {
    const testCases = circuit.metadata?.testCases;
    if (!testCases || testCases.length === 0) continue;

    console.log(chalk.bold(`\nTesting: ${circuit.name}`));

    for (const tc of testCases) {
      const simulator = createSimulatorFromCircuit(circuit, library);

      // Set inputs
      for (const [name, value] of Object.entries(tc.inputs)) {
        simulator.setInput(name, value as BitValue | BusValue);
      }

      // Run for one tick
      const result = simulator.tick();

      // Check expected outputs
      let passed = true;
      const failures: string[] = [];

      for (const [name, expected] of Object.entries(tc.expectedOutputs)) {
        const key = `${TOP_LEVEL_NODE}.${name}`;
        const actual = result.portValues.get(key);
        if (actual !== expected) {
          passed = false;
          failures.push(`${name}: expected ${expected}, got ${actual}`);
        }
      }

      const label = tc.name ?? JSON.stringify(tc.inputs);
      if (passed) {
        console.log(chalk.green(`  \u2713 ${label}`));
        totalPassed++;
      } else {
        console.log(chalk.red(`  \u2717 ${label}: ${failures.join(', ')}`));
        totalFailed++;
      }

      if (opts.verbose) {
        printTrace(circuit, result, library);
      }
    }
  }

  if (totalPassed === 0 && totalFailed === 0) {
    console.log(chalk.yellow('No test cases found. Running compilation check only.'));
    console.log(chalk.green(`  ${allCircuits.length} circuit${allCircuits.length === 1 ? '' : 's'} compiled successfully`));
    return;
  }

  // Summary
  console.log('');
  if (totalFailed === 0) {
    console.log(chalk.green.bold(`All ${totalPassed} test${totalPassed === 1 ? '' : 's'} passed`));
  } else {
    console.log(
      chalk.red.bold(`${totalFailed} failed`) +
        chalk.dim(`, ${totalPassed} passed, ${totalPassed + totalFailed} total`)
    );
    process.exit(1);
  }
}

/**
 * Print port values for verbose output.
 */
function printTrace(
  circuit: Circuit,
  result: { portValues: Map<string, BitValue | BusValue> },
  _library: any
): void {
  const inputNames = circuit.inputs.map((i) => i.name);
  const outputNames = circuit.outputs.map((o) => o.name);
  const headers = [...inputNames, ...outputNames];

  if (headers.length === 0) return;

  console.log(chalk.dim('  ') + headers.map((h) => chalk.cyan(h.padEnd(10))).join(''));
  console.log(chalk.dim('  ' + '\u2500'.repeat(headers.length * 10)));

  const values = headers.map((name) => {
    const key = `${TOP_LEVEL_NODE}.${name}`;
    const val = result.portValues.get(key);
    if (val === undefined) return chalk.dim('\u2014'.padEnd(10));
    const str = typeof val === 'boolean' ? (val ? '1' : '0') : String(val);
    const padded = str.padEnd(10);
    if (typeof val === 'boolean') {
      return val ? chalk.green(padded) : chalk.dim(padded);
    }
    return padded;
  });

  console.log(chalk.dim('  ') + values.join(''));
}
