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
  type Behavior,
  definitionKey,
  emptyLibrary,
  type Library,
  type MutableLibrary,
} from '../circuit/behavior.js';
import type { Circuit } from '../circuit/builder-types.js';
import { sameDefinition } from '../circuit/circuit.js';
import { internalsOf } from '../circuit/internals.js';
import { STDLIB_CIRCUITS } from './index.js';
import { Combiner, Splitter } from './routing.js';

let cached: Library | null = null;

function buildStdLibrary(): MutableLibrary {
  const library = emptyLibrary();
  const seen = new Map<string, Circuit>();
  for (const built of STDLIB_CIRCUITS) {
    for (const c of [built, ...internalsOf(built).dependencies.values()]) {
      const { name } = c;
      const existing = seen.get(name);
      if (existing) {
        if (!sameDefinition(existing, c)) {
          throw new Error(`The standard library has two different circuits named '${name}'.`);
        }
        continue;
      }
      seen.set(name, c);
      const { ir, behavior } = internalsOf(c);
      library.definitions.addCircuit(ir);
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

/** `Splitter_4w`, `Combiner_16w`: a bit splitter or combiner of one width. */
const PER_WIDTH = /^(Splitter|Combiner)_([1-9]\d?)w$/;
const perWidth = new Map<string, Behavior>();

/**
 * Std's behavior for the primitive of this name, if std has one. Splitter and
 * Combiner register one primitive per width (`Splitter_4w`), and the library
 * holds only the default width, so the others are built on first use.
 */
function stdBehavior(name: string): Behavior | undefined {
  const behavior = getStdLibrary().behaviors.get(name);
  if (behavior) return behavior;
  const bits = PER_WIDTH.exec(name);
  if (!bits) return undefined;
  let built = perWidth.get(name);
  if (!built) {
    const width = Number(bits[2]);
    built = internalsOf(
      bits[1] === 'Splitter' ? Splitter({ width }) : Combiner({ width }),
    ).behavior;
    if (!built) return undefined;
    perWidth.set(name, built);
  }
  return built;
}

/**
 * Whether `behavior` is std's own behavior for the primitive `name`, so std's
 * hand-written Verilog for that name describes it. A user circuit that takes a
 * std name (its own `Adder`) has its own behavior and fails this.
 *
 * Each factory call builds fresh closures, so `Adder({ width: 16 })` and the
 * library's `Adder` carry different behavior objects. They are the same
 * behavior when their `definitionKey`s match: the same ports, state and
 * source text, the test `circuit()` uses to decide two circuits under one name
 * are one circuit. Std's behaviors read nothing from a factory's scope (their
 * widths come from the node's arguments), so equal source means equal logic.
 */
export function isStdBehavior(name: string, behavior: Behavior | undefined): boolean {
  if (!behavior) return false;
  const std = stdBehavior(name);
  if (!std) return false;
  return behavior === std || definitionKey(behavior) === definitionKey(std);
}
