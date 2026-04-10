import chalk from 'chalk';
import {
  createSimulatorFromCircuit,
  TOP_LEVEL_NODE,
} from '@simten/core';
import type { BitValue, BusValue } from '@simten/core';
import { loadCircuitFile } from '../lib/file-loader.js';

interface SimOptions {
  ticks: number;
  circuit?: string;
  inputs?: string[];
}

export async function sim(filePath: string, opts: SimOptions): Promise<void> {
  const { filePath: absPath, result, errors } = loadCircuitFile(filePath);

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(chalk.red('error:'), err);
    }
    process.exit(1);
  }

  const { circuits, library } = result;

  if (circuits.length === 0) {
    console.error(chalk.red('No circuits found in file'));
    process.exit(1);
  }

  // Select circuit to simulate
  const targetName = opts.circuit;
  const target = targetName
    ? circuits.find((c) => c.name === targetName)
    : circuits[circuits.length - 1];

  if (!target) {
    const names = circuits.map((c) => c.name).join(', ');
    console.error(
      chalk.red(`Circuit "${targetName}" not found. Available: ${names}`)
    );
    process.exit(1);
  }

  console.log(chalk.bold(`Simulating ${target.name} for ${opts.ticks} tick${opts.ticks === 1 ? '' : 's'}`));

  // Create simulator
  const simulator = createSimulatorFromCircuit(target, library!);

  // Set inputs if provided
  if (opts.inputs) {
    for (const input of opts.inputs) {
      const [name, valStr] = input.split('=');
      if (!name || valStr === undefined) {
        console.error(chalk.red(`Invalid input format: "${input}". Use name=value`));
        process.exit(1);
      }
      const value = valStr === 'true' ? true : valStr === 'false' ? false : Number(valStr);
      simulator.setNode(name, value as BitValue | BusValue);
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
