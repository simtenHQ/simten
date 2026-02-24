/**
 * Reference Circuit Cache
 *
 * Compiles reference circuit DSL strings on demand and caches the results.
 * Reference circuits are optional DSL strings attached to primitive definitions
 * that show how the primitive could be built from lower-level components.
 */

import { getReferenceCircuit } from '../../simulator';
import { compileDSL } from '@turing-incomplete/core/dsl';
import type { ComponentLibrary as DSLComponentLibrary } from '@turing-incomplete/core/dsl';
import type { Circuit } from '../types/circuit';

interface ComponentLibraryStore {
  resolveComponent(name: string): Circuit | undefined;
  registerStandard(circuit: Circuit): void;
}

const cache = new Map<string, Circuit>();

/**
 * Get the compiled reference circuit for a primitive.
 * Compiles on first access, then caches.
 *
 * Multi-circuit DSL is supported — helper circuits (e.g., HalfAdder defined
 * above FullAdder) are registered via registerStandard so the inspector
 * can resolve them for nested drill-down.
 */
export function getCompiledReferenceCircuit(
  primitiveName: string,
  store: ComponentLibraryStore,
): Circuit | undefined {
  if (cache.has(primitiveName)) return cache.get(primitiveName);

  const dsl = getReferenceCircuit(primitiveName);
  if (!dsl) return undefined;

  try {
    const dslLibrary: DSLComponentLibrary = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
      addCircuit: (circuit: Circuit) => store.registerStandard(circuit),
    };
    const { circuits, errors } = compileDSL(dsl, dslLibrary);

    if (errors.length > 0) {
      console.warn(`Failed to compile reference circuit for ${primitiveName}:`, errors);
      return undefined;
    }

    // Use the last circuit in the file (the top-level one that uses the others)
    const compiled = circuits[circuits.length - 1];
    if (!compiled) return undefined;

    cache.set(primitiveName, compiled);
    return compiled;
  } catch (e) {
    console.warn(`Failed to compile reference circuit for ${primitiveName}:`, e);
    return undefined;
  }
}

/**
 * Clear the reference circuit cache.
 * Call on: component library reload, DSL language version change.
 */
export function clearReferenceCircuitCache(): void {
  cache.clear();
}
