import chalk from 'chalk';
import {
  validateCircuit,
  createDefaultValidationContext,
  formatForCLI,
} from '@turing-incomplete/core/dsl';
import {
  createComponentLibrary,
  getPrimitives,
} from '@turing-incomplete/core/simulator';
import { loadDSLFile } from '../lib/file-loader.js';

export async function check(filePath: string): Promise<void> {
  const { source, filePath: absPath, errors: loadErrors } = loadDSLFile(filePath);

  if (loadErrors.length > 0) {
    for (const err of loadErrors) {
      console.error(chalk.red('error:'), err);
    }
    process.exit(1);
  }

  // Build component library with primitives
  const library = createComponentLibrary(getPrimitives());

  // Validate (parses + compiles + validates)
  const context = createDefaultValidationContext(library, absPath);
  const result = validateCircuit(source, context);

  // Print diagnostics
  const output = formatForCLI(result, { colors: true });
  if (output) console.log(output);

  // Summary
  const errorCount = result.diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = result.diagnostics.filter((d) => d.severity === 'warning').length;

  if (result.valid) {
    const circuitCount = result.circuits?.length ?? 0;
    console.log(
      chalk.green(`  ${circuitCount} circuit${circuitCount === 1 ? '' : 's'} checked — no issues found`)
    );
  } else if (errorCount === 0) {
    console.log(chalk.yellow(`  ${warnCount} warning${warnCount === 1 ? '' : 's'}`));
  } else {
    console.log(
      chalk.red(`  ${errorCount} error${errorCount === 1 ? '' : 's'}`) +
        (warnCount > 0
          ? chalk.yellow(`, ${warnCount} warning${warnCount === 1 ? '' : 's'}`)
          : '')
    );
    process.exit(1);
  }
}
