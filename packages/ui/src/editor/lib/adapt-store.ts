/**
 * Adapter utility for component library interface
 *
 * @deprecated No longer needed since DSL compiler library interface is gone.
 * Kept as a thin passthrough for any remaining callers.
 */

import type { ComponentLibrary, Circuit } from '@turing-incomplete/core';

interface StoreWithResolveComponent {
  resolveComponent(name: string): Circuit | undefined;
}

/**
 * Adapt a store-like object to a ComponentLibrary.
 */
export function adaptStoreToCompilerLibrary(
  store: StoreWithResolveComponent
): ComponentLibrary {
  return {
    resolveComponent: (name: string) => store.resolveComponent(name),
    getAllPrimitiveNames: () => [],
  };
}
