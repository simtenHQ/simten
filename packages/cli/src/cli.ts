import { Command } from 'commander';
import { check } from './commands/check.js';
import { sim } from './commands/sim.js';
import { test } from './commands/test.js';

const program = new Command();

program
  .name('turing')
  .description('Turing Incomplete — hardware design from the terminal')
  .version('0.1.0');

program
  .command('check <file>')
  .description('Parse and validate a DSL file')
  .action(check);

program
  .command('sim <file>')
  .description('Simulate a circuit for N ticks')
  .option('-n, --ticks <number>', 'number of ticks to simulate', '10')
  .option('-c, --circuit <name>', 'circuit to simulate (default: last in file)')
  .option('-i, --input <values...>', 'input values (name=value)')
  .action((file, opts) => {
    return sim(file, {
      ticks: parseInt(opts.ticks, 10),
      circuit: opts.circuit,
      inputs: opts.input,
    });
  });

program
  .command('test <files...>')
  .description('Run testbench assertions (pass circuit + testbench files)')
  .option('-v, --verbose', 'show per-cycle trace table')
  .option('-n, --ticks <number>', 'override max simulation cycles')
  .action((files, opts) => test(files, opts));

program.parse();
