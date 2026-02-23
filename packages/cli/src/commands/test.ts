import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import chalk from 'chalk';
import {
  parseDSL,
  compileToIR,
  runTestbench,
} from '@turing-incomplete/core/dsl';
import {
  createComponentLibrary,
  getPrimitives,
  TOP_LEVEL_NODE,
} from '@turing-incomplete/core/simulator';
import type { Circuit, BitValue, BusValue } from '@turing-incomplete/core';
import { loadDSLFile } from '../lib/file-loader.js';

interface TestOptions {
  verbose?: boolean;
  ticks?: string;
}

export async function test(filePaths: string[], opts: TestOptions): Promise<void> {
  // Shared library — all files compile into the same unit
  const allCircuits: Circuit[] = [...getPrimitives()];
  const mutableLibrary = {
    resolveComponent: (name: string) => allCircuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    getCircuit: (name: string) => allCircuits.find((c) => c.name === name),
    hasCircuit: (name: string) => allCircuits.some((c) => c.name === name),
    addCircuit: (circuit: Circuit) => { allCircuits.push(circuit); },
  };

  // Collect testbenches across all files
  const testbenches: Array<{ tb: Parameters<typeof runTestbench>[0]; sourceDir: string }> = [];

  // Phase 1: Load, parse, and compile all files
  for (const filePath of filePaths) {
    const { source, filePath: absPath, errors: loadErrors } = loadDSLFile(filePath);

    if (loadErrors.length > 0) {
      for (const err of loadErrors) {
        console.error(chalk.red('error:'), err);
      }
      process.exit(1);
    }

    // Parse
    const { ast, errors: parseErrors } = parseDSL(source, absPath);
    if (parseErrors.length > 0) {
      console.error(chalk.red(`\n${absPath}:`));
      for (const err of parseErrors) {
        console.error(chalk.red(`  ${err.location.start.line}:${err.location.start.column}  ${err.message}`));
      }
      process.exit(1);
    }

    // Compile circuits from this file into shared library
    try {
      const circuits = compileToIR(ast, mutableLibrary);
      allCircuits.push(...circuits);
    } catch (e) {
      console.error(chalk.red(`Compilation error in ${absPath}:`), e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    // Collect testbenches
    if (ast.testbenches) {
      for (const tb of ast.testbenches) {
        testbenches.push({ tb, sourceDir: dirname(absPath) });
      }
    }
  }

  // Check if any testbenches were found
  if (testbenches.length === 0) {
    const circuitCount = allCircuits.length - getPrimitives().length;
    console.log(chalk.yellow('No testbenches found. Running compilation check only.'));
    console.log(chalk.green(`  ${circuitCount} circuit${circuitCount === 1 ? '' : 's'} compiled successfully`));
    return;
  }

  // Phase 2: Build final library and run testbenches
  const library = createComponentLibrary(allCircuits);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const { tb, sourceDir } of testbenches) {
    console.log(chalk.bold(`\nTestbench: ${tb.name}`));

    // Find the DUT circuit
    const dutName = tb.circuitRef.circuitName;
    const dut = allCircuits.find((c) => c.name === dutName);
    if (!dut) {
      const available = allCircuits
        .filter((c) => !getPrimitives().some((p) => p.name === c.name))
        .map((c) => c.name);
      console.error(chalk.red(`  DUT "${dutName}" not found`));
      if (available.length > 0) {
        console.error(chalk.dim(`  Available circuits: ${available.join(', ')}`));
      }
      console.error(chalk.dim(`  Hint: pass the circuit file too — turing test Circuit.dsl Testbench.tb.dsl`));
      totalFailed++;
      continue;
    }

    // Determine max cycles
    const maxCycles = opts.ticks ? parseInt(opts.ticks, 10) : undefined;

    // Run testbench
    try {
      const result = runTestbench(tb, dut, library, { maxCycles });

      console.log(chalk.dim(`  Simulated ${result.cycles} cycles`));

      // Show per-cycle trace in verbose mode
      if (opts.verbose) {
        printTrace(result.signals, result.sampledCycles, dut);
      }

      // Write VCD file if capture configured
      if (result.vcd && tb.impl?.capture?.filename) {
        const vcdPath = resolve(sourceDir, tb.impl.capture.filename);
        writeFileSync(vcdPath, result.vcd, 'utf-8');
        console.log(chalk.cyan(`  VCD written to ${vcdPath}`));
      }

      // Show assertion results if present
      if (result.assertionSummary) {
        const summary = result.assertionSummary;
        for (const ar of summary.results) {
          if (ar.passed) {
            console.log(chalk.green(`  \u2713 cycle ${ar.cycle}: ${ar.message}`));
          } else {
            console.log(chalk.red(`  \u2717 cycle ${ar.cycle}: ${ar.message}`));
          }
        }
        console.log(
          chalk.dim(`  Assertions: ${summary.passed}/${summary.total} passed`)
        );
      }

      if (result.status === 'passed') {
        console.log(chalk.green(`  \u2713 ${tb.name} passed`));
        totalPassed++;
      } else {
        console.log(chalk.red(`  \u2717 ${tb.name} failed: ${result.failureReason}`));
        totalFailed++;
      }
    } catch (e) {
      console.error(chalk.red(`  \u2717 ${tb.name} error: ${e instanceof Error ? e.message : String(e)}`));
      totalFailed++;
    }
  }

  // Summary
  console.log('');
  if (totalFailed === 0) {
    console.log(chalk.green.bold(`All ${totalPassed} testbench${totalPassed === 1 ? '' : 'es'} passed`));
  } else {
    console.log(
      chalk.red.bold(`${totalFailed} failed`) +
        chalk.dim(`, ${totalPassed} passed, ${totalPassed + totalFailed} total`)
    );
    process.exit(1);
  }
}

/**
 * Print a trace table for verbose output.
 */
function printTrace(
  signals: Record<string, (BitValue | BusValue)[]>,
  sampledCycles: number[],
  dut: Circuit
): void {
  const inputNames = dut.inputs.map((i) => i.name);
  const outputNames = dut.outputs.map((o) => o.name);
  const headers = [...inputNames, ...outputNames];

  if (headers.length === 0) return;

  // Print header
  console.log(chalk.dim('  tick  ') + headers.map((h) => chalk.cyan(h.padEnd(10))).join(''));
  console.log(chalk.dim('  ' + '\u2500'.repeat(6 + headers.length * 10)));

  // Print each cycle
  for (let i = 0; i < sampledCycles.length; i++) {
    const cycle = sampledCycles[i];
    const values = headers.map((name) => {
      const key = `${TOP_LEVEL_NODE}.${name}`;
      const vals = signals[key];
      const val = vals?.[i];
      if (val === undefined) return chalk.dim('\u2014'.padEnd(10));
      const str = typeof val === 'boolean' ? (val ? '1' : '0') : String(val);
      const padded = str.padEnd(10);
      if (typeof val === 'boolean') {
        return val ? chalk.green(padded) : chalk.dim(padded);
      }
      return padded;
    });

    console.log(chalk.dim('  ' + String(cycle).padStart(4) + '  ') + values.join(''));
  }
}
