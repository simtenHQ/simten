/**
 * Adapter utility for circuit library interface
 *
 * @deprecated No longer needed since the legacy compiler library interface is gone.
 * Kept as a thin passthrough for any remaining callers.
 */

import type { CircuitLibrary, Circuit } from '@turing-incomplete/core';

interface StoreWithResolveCircuit {
  resolveCircuit(name: string): Circuit | undefined;
}

/**
 * Adapt a store-like object to a CircuitLibrary.
 */
export function adaptStoreToCircuitLibrary(
  store: StoreWithResolveCircuit
): CircuitLibrary {
  return {
    resolveCircuit: (name: string) => store.resolveCircuit(name),
    getAllPrimitiveNames: () => [],
  };
}
