import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  executeCircuitCode,
  type ExecuteResult,
} from '@simten/core/circuit';

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
        builtCircuits: [],
        library: { resolveCircuit: () => undefined, getAllPrimitiveNames: () => [], addCircuit: () => {}, getAllCircuitNames: () => [] },
        error: `Cannot read file: ${absPath}`,
      },
      errors: [`Cannot read file: ${absPath}`],
    };
  }

  const result = executeCircuitCode(source);

  return {
    filePath: absPath,
    result,
    errors: result.error ? [result.error] : [],
  };
}
