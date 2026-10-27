/**
 * Source Code Compilation — circuit() API only.
 *
 * Shared by all API handlers (check, simulate, test).
 * Accepts TypeScript code using the circuit() API.
 */

import { type CircuitIR, executeCircuitCode, type MutableLibrary } from '@simten/core/internal';

export interface CompileSourceResult {
  circuits: CircuitIR[];
  library: MutableLibrary;
  error: string | null;
}

/**
 * Compile TypeScript circuit code into circuits and a library.
 */
export function compileSource(source: string, _sourceName?: string): CompileSourceResult {
  const result = executeCircuitCode(source);
  const { library } = result;
  if (result.error) {
    return { circuits: [], library, error: result.error };
  }
  if (result.circuits.length === 0) {
    return {
      circuits: [],
      library,
      error: 'No circuits found. Call .build() on your component() definitions.',
    };
  }
  return { circuits: result.circuits, library, error: null };
}
