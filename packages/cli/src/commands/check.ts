import chalk from 'chalk';
import { loadCircuitFile } from '../lib/file-loader.js';

export async function check(filePath: string): Promise<void> {
  const { filePath: absPath, result, errors } = loadCircuitFile(filePath);

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(chalk.red('error:'), err);
    }
    process.exit(1);
  }

  const circuitCount = result.circuits.length;
  if (circuitCount === 0) {
    console.log(chalk.yellow('  No circuits found in file'));
  } else {
    console.log(
      chalk.green(`  ${circuitCount} circuit${circuitCount === 1 ? '' : 's'} checked — no issues found`)
    );
  }
}
