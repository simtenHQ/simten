import chalk from 'chalk';
import {
  parseDSL,
  compileToIR,
} from '@turing-incomplete/core/dsl';
import {
  createComponentLibrary,
  createSimulatorFromCircuit,
  getPrimitives,
  TOP_LEVEL_NODE,
} from '@turing-incomplete/core/simulator';
import type { Circuit, BitValue, BusValue } from '@turing-incomplete/core';
import { loadDSLFile } from '../lib/file-loader.js';

interface SimOptions {
  ticks: number;
  circuit?: string;
  inputs?: string[];
}

export async function sim(filePath: string, opts: SimOptions): Promise<void> {
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
    for (const err of parseErrors) {
      console.error(chalk.red(`  ${err.location.start.line}:${err.location.start.column}  ${err.message}`));
    }
    process.exit(1);
  }

  // Build library and compile
  const allCircuits: Circuit[] = [...getPrimitives()];

  const mutableLibrary = {
    resolveComponent: (name: string) => allCircuits.find((c) => c.name === name),
    getAllPrimitiveNames: () => getPrimitives().map((c) => c.name),
    getCircuit: (name: string) => allCircuits.find((c) => c.name === name),
    hasCircuit: (name: string) => allCircuits.some((c) => c.name === name),
    addCircuit: (circuit: Circuit) => { allCircuits.push(circuit); },
  };

  let compiledCircuits: Circuit[];
  try {
    compiledCircuits = compileToIR(ast, mutableLibrary);
    allCircuits.push(...compiledCircuits);
  } catch (e) {
    console.error(chalk.red('Compilation error:'), e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // Select circuit to simulate
  const targetName = opts.circuit;
  const target = targetName
    ? compiledCircuits.find((c) => c.name === targetName)
    : compiledCircuits[compiledCircuits.length - 1];

  if (!target) {
    const names = compiledCircuits.map((c) => c.name).join(', ');
    console.error(
      chalk.red(`Circuit "${targetName}" not found. Available: ${names}`)
    );
    process.exit(1);
  }

  console.log(chalk.bold(`Simulating ${target.name} for ${opts.ticks} tick${opts.ticks === 1 ? '' : 's'}`));

  // Create simulator
  const library = createComponentLibrary(allCircuits);
  const simulator = createSimulatorFromCircuit(target, library);

  // Set inputs if provided
  if (opts.inputs) {
    for (const input of opts.inputs) {
      const [name, valStr] = input.split('=');
      if (!name || valStr === undefined) {
        console.error(chalk.red(`Invalid input format: "${input}". Use name=value`));
        process.exit(1);
      }
      const value = valStr === 'true' ? true : valStr === 'false' ? false : Number(valStr);
      simulator.setInput(name, value as BitValue | BusValue);
    }
  }

  // Run simulation
  const outputNames = target.outputs.map((o) => o.name);
  const inputNames = target.inputs.map((i) => i.name);

  // Print header
  const headers = [...inputNames, ...outputNames];
  console.log(chalk.dim('tick  ') + headers.map((h) => chalk.cyan(h.padEnd(10))).join(''));
  console.log(chalk.dim('─'.repeat(6 + headers.length * 10)));

  for (let tick = 0; tick < opts.ticks; tick++) {
    const result = simulator.tick();

    const values = headers.map((name) => {
      const key = `${TOP_LEVEL_NODE}.${name}`;
      const val = result.portValues.get(key);
      if (val === undefined) return chalk.dim('—'.padEnd(10));
      const str = typeof val === 'boolean' ? (val ? '1' : '0') : String(val);
      const padded = str.padEnd(10);
      if (typeof val === 'boolean') {
        return val ? chalk.green(padded) : chalk.dim(padded);
      }
      return padded;
    });

    console.log(chalk.dim(String(tick).padStart(4) + '  ') + values.join(''));
  }

  // Print metrics
  const metrics = simulator.getMetrics();
  console.log(chalk.dim(`\n${metrics.totalTicks} ticks, ${metrics.totalEvaluations} evals, ${metrics.nodeCount} nodes`));
}
