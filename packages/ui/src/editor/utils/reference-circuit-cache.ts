/**
 * Reference Circuit Cache
 *
 * Previously compiled reference circuit DSL strings on demand.
 * Now returns undefined since DSL parser has been removed.
 * Will be reimplemented using TS builder API.
 */

import type { Circuit } from '../types/circuit';

interface ComponentLibraryStore {
  resolveComponent(name: string): Circuit | undefined;
  registerStandard(circuit: Circuit): void;
}

/**
 * Get the compiled reference circuit for a primitive.
 *
 * @deprecated DSL parser removed. Returns undefined until reimplemented with TS builder.
 */
export function getCompiledReferenceCircuit(
  _primitiveName: string,
  _store: ComponentLibraryStore,
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
