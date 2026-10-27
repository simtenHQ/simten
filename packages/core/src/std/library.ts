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
  definitionKey,
  emptyLibrary,
  type Library,
  type MutableLibrary,
} from '../circuit/behavior.js';
import type { Circuit } from '../circuit/builder-types.js';
import { sameDefinition } from '../circuit/circuit.js';
import { internalsOf } from '../circuit/internals.js';
import type { CircuitDefinitions, CircuitIR } from '../ir/circuit-ir.js';
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

/** Std's IR and behavior for one primitive name. */
interface StdPrimitive {
  ir: CircuitIR;
  behavior: Behavior;
}

/** `Splitter_4w`, `Combiner_16w`: a bit splitter or combiner of one width. */
const PER_WIDTH = /^(Splitter|Combiner)_([1-9]\d?)w$/;
const perWidth = new Map<string, StdPrimitive>();

/**
 * Std's primitive of this name, if std has one. Splitter and Combiner register
 * one primitive per width (`Splitter_4w`), and the library holds only the
 * default width, so the others are built on first use.
 */
function stdPrimitive(name: string): StdPrimitive | undefined {
  const std = getStdLibrary();
  const ir = std.definitions.resolveCircuit(name);
  const behavior = std.behaviors.get(name);
  if (ir && behavior) return { ir, behavior };
  const bits = PER_WIDTH.exec(name);
  if (!bits) return undefined;
  let built = perWidth.get(name);
  if (!built) {
    const width = Number(bits[2]);
    const internals = internalsOf(
      bits[1] === 'Splitter' ? Splitter({ width }) : Combiner({ width }),
    );
    if (!internals.behavior) return undefined;
    built = { ir: internals.ir, behavior: internals.behavior };
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
  const std = stdPrimitive(name)?.behavior;
  if (!std) return false;
  return behavior === std || definitionKey(behavior) === definitionKey(std);
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
  const behaviors = new Map<string, Behavior>();
  for (const name of definitions.getAllPrimitiveNames()) {
    if (userNames.has(name)) continue;
    const ir = definitions.resolveCircuit(name);
    const std = stdPrimitive(name);
    if (ir && std && shapeKey(ir) === shapeKey(std.ir)) behaviors.set(name, std.behavior);
  }
  return behaviors;
}
