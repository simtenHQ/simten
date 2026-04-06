/**
 * Source Code Compilation — TypeScript builder API only.
 *
 * Shared by all API handlers (check, simulate, test).
 * Accepts TypeScript code using the component() builder API.
 */

import { executeCircuitCode } from '../circuit/execute.js';
import type { Circuit, CircuitLibrary } from '../types/circuit.js';

export interface CompileSourceResult {
  circuits: Circuit[];
  library: CircuitLibrary & { addCircuit(c: Circuit): void };
  error: string | null;
}

/**
 * Compile TypeScript circuit code into circuits and a library.
 */
export function compileSource(
  source: string,
  _sourceName?: string,
): CompileSourceResult {
  const result = executeCircuitCode(source);
  if (result.error) {
    return { circuits: [], library: result.library, error: result.error };
  }
  if (result.circuits.length === 0) {
    return { circuits: [], library: result.library, error: 'No circuits found. Call .build() on your component() definitions.' };
  }
  return { circuits: result.circuits, library: result.library, error: null };
}
