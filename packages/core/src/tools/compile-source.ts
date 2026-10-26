/**
 * Source Code Compilation — circuit() API only.
 *
 * Shared by all API handlers (check, simulate, test).
 * Accepts TypeScript code using the circuit() API.
 */

import { executeCircuitCode } from '../circuit/execute.js';
import type { CircuitIR, CircuitLibrary } from '../ir/circuit-ir.js';

export interface CompileSourceResult {
  circuits: CircuitIR[];
  library: CircuitLibrary & { addCircuit(c: CircuitIR): void };
  error: string | null;
}

/**
 * Compile TypeScript circuit code into circuits and a library.
 */
export function compileSource(source: string, _sourceName?: string): CompileSourceResult {
  const result = executeCircuitCode(source);
  if (result.error) {
    return { circuits: [], library: result.library, error: result.error };
  }
  if (result.circuits.length === 0) {
    return {
      circuits: [],
      library: result.library,
      error: 'No circuits found. Call .build() on your component() definitions.',
    };
  }
  return { circuits: result.circuits, library: result.library, error: null };
}
