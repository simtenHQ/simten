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
  type BehaviorTable,
  emptyLibrary,
  type Library,
  type MutableLibrary,
} from '../circuit/behavior.js';
import type { Circuit } from '../circuit/builder-types.js';
import { sameDefinition } from '../circuit/circuit.js';
import { internalsOf } from '../circuit/internals.js';
import type { CircuitDefinitions, CircuitIR } from '../ir/circuit-ir.js';
import { STDLIB_CIRCUITS } from './index.js';

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

/**
 * What a primitive's IR says about which circuit it is, widths aside: a
 * factory's specializations differ in their widths and nowhere else.
 */
function shapeKey(ir: CircuitIR): string {
  return JSON.stringify([
    ir.implementation,
    ir.inputs.map((p) => p.name),
    ir.outputs.map((p) => p.name),
    ir.clocks.map((c) => c.name),
    ir.state.map((s) => [s.name, s.stateType.kind]),
    ir.metadata,
  ]);
}

/**
 * Std's behavior for the primitives in `definitions` that are std's own, for a
 * caller that has IR but no behavior (the editor page's Verilog export). A
 * primitive is std's when the user's source didn't define it (`userNames`) and
 * its IR matches std's definition of that name, widths aside. Anything else
 * gets no behavior, so it exports as unsupported rather than as std's logic.
 */
export function stdBehaviorsFor(
  definitions: CircuitDefinitions,
  userNames: ReadonlySet<string>,
): BehaviorTable {
  const std = getStdLibrary();
  const behaviors = new Map<string, Behavior>();
  for (const name of definitions.getAllPrimitiveNames()) {
    if (userNames.has(name)) continue;
    const ir = definitions.resolveCircuit(name);
    const stdIR = std.definitions.resolveCircuit(name);
    const behavior = std.behaviors.get(name);
    if (ir && stdIR && behavior && shapeKey(ir) === shapeKey(stdIR)) behaviors.set(name, behavior);
  }
  return behaviors;
}
