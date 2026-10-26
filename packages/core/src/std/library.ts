/**
 * The standard library as one Library: every std circuit and its dependencies,
 * with their behavior. It is built once and shared, so it is typed read-only:
 * a compile that adds its own circuits copies the definitions and table first.
 *
 * A name in std means one circuit. Specialisations of one factory (an 8-bit and
 * a 16-bit Register) are the same definition and share an entry; two different
 * circuits under one name are a bug in std and building it throws.
 */

import {
  behaviorOf,
  emptyLibrary,
  type Library,
  type MutableLibrary,
} from '../circuit/behavior.js';
import type { Circuit } from '../circuit/builder-types.js';
import { sameDefinition } from '../circuit/circuit.js';
import { STDLIB_CIRCUITS } from './index.js';

let cached: Library | null = null;

function buildStdLibrary(): MutableLibrary {
  const library = emptyLibrary();
  const seen = new Map<string, Circuit>();
  for (const built of STDLIB_CIRCUITS) {
    for (const c of [built, ...built._dependencies.values()]) {
      const name = c.circuit.name;
      const existing = seen.get(name);
      if (existing) {
        if (!sameDefinition(existing, c)) {
          throw new Error(`The standard library has two different circuits named '${name}'.`);
        }
        continue;
      }
      seen.set(name, c);
      library.definitions.addCircuit(c.circuit);
      const behavior = behaviorOf(c);
      if (behavior) library.behaviors.set(name, behavior);
    }
  }
  return library;
}

/**
 * The standard library's circuits and behavior (cached): the base for a
 * compile that only has IR (and perhaps behavior as source text), such as the
 * sandbox's compile-ir or a page-side canvas showing std components.
 */
export function getStdLibrary(): Library {
  cached ??= buildStdLibrary();
  return cached;
}
