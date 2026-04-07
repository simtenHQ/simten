/**
 * Reference Circuit Cache
 *
 * Previously compiled reference circuits on demand from a now-removed DSL parser.
 * Returns undefined until reimplemented using the TypeScript builder API.
 */

import type { Circuit } from '../types/circuit';

interface CircuitLibraryStore {
  resolveCircuit(name: string): Circuit | undefined;
  registerStandard(circuit: Circuit): void;
}

/**
 * Get the compiled reference circuit for a primitive.
 *
 * @deprecated Returns undefined until reimplemented with the TypeScript builder API.
 */
export function getCompiledReferenceCircuit(
  _primitiveName: string,
  _store: CircuitLibraryStore,
  _params?: Record<string, number>,
): Circuit | undefined {
  return undefined;
}

/**
 * Clear the reference circuit cache.
 */
export function clearReferenceCircuitCache(): void {
  // No-op — cache is empty
}
