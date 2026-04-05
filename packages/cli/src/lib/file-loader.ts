import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  executeComponentCode,
  type ExecuteResult,
} from '@turing-incomplete/core/builder';

export interface LoadResult {
  filePath: string;
  result: ExecuteResult;
  errors: string[];
}

/**
 * Load a circuit file from disk and compile it via the TS builder.
 * Accepts .circuit.ts or .circuit files (both treated as TS builder code).
 */
export function loadCircuitFile(filePath: string): LoadResult {
  const absPath = resolve(filePath);

  let source: string;
  try {
    source = readFileSync(absPath, 'utf-8');
  } catch (e) {
    return {
      filePath: absPath,
      result: {
        circuit: null,
        circuits: [],
        components: [],
        library: null as any,
        error: `Cannot read file: ${absPath}`,
      },
      errors: [`Cannot read file: ${absPath}`],
    };
  }

  const result = executeComponentCode(source);

  return {
    filePath: absPath,
    result,
    errors: result.error ? [result.error] : [],
  };
}
