/**
 * Adapter utility for DSL compiler library interface
 */

import type { ComponentLibrary } from '@turing-incomplete/core/dsl';
import type { Circuit } from '@turing-incomplete/core/dsl';

/**
 * Interface for store-like objects that have resolveComponent.
 * This matches the ComponentLibraryStore interface from visual-editor.
 */
interface StoreWithResolveComponent {
  resolveComponent(name: string): Circuit | undefined;
}

/**
 * Adapt a store-like object (with resolveComponent) to the DSL compiler's
 * ComponentLibrary interface (with getCircuit/hasCircuit).
 *
 * This allows tests and UI code to pass ComponentLibraryStore directly
 * to DSL compilation functions.
 */
export function adaptStoreToCompilerLibrary(
  store: StoreWithResolveComponent
): ComponentLibrary {
  return {
    getCircuit: (name: string) => store.resolveComponent(name),
    hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    addCircuit: () => {}, // No-op for read-only usage
  };
}
