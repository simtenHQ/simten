/**
 * What a built circuit carries besides its name and ports: its IR, the circuits
 * it is made of, the options it was made with and, for a primitive, its
 * behavior.
 *
 * The public `Circuit` is a frozen `{ name, inputs, outputs }`. Everything else
 * lives here, keyed by that object, so none of it is reachable from the public
 * API. `makeCircuit` is the only way to make a circuit, so every circuit has
 * internals, and a circuit nothing references any more is freed along with
 * them.
 */

import type { ArgumentValue, CircuitIR, PortDescriptor, PortType } from '../ir/circuit-ir.js';
import type { Behavior } from './behavior.js';
import type { Circuit } from './builder-types.js';

export interface CircuitInternals {
  readonly ir: CircuitIR;
  /** Every circuit this one is made of, transitively, by name. */
  readonly dependencies: ReadonlyMap<string, Circuit>;
  /** The factory options this instance was made with, e.g. `{ width: 8 }`. */
  readonly args: Record<string, ArgumentValue>;
  /** A primitive's `eval` and `onTick`. */
  readonly behavior?: Behavior;
}

const internals = new WeakMap<Circuit, CircuitInternals>();

/** The one constructor: the public circuit for `parts`, with `parts` recorded as its internals. */
export function makeCircuit(parts: CircuitInternals): Circuit {
  const built: Circuit = Object.freeze({
    name: parts.ir.name,
    inputs: portTypes(parts.ir.inputs),
    outputs: portTypes(parts.ir.outputs),
  });
  internals.set(built, parts);
  return built;
}

/** A built circuit's internals. Throws for anything `circuit()` didn't make. */
export function internalsOf(built: Circuit): CircuitInternals {
  const found = internals.get(built);
  if (!found) {
    const name = (built as { name?: unknown } | null)?.name;
    throw new Error(
      `'${typeof name === 'string' ? name : String(built)}' wasn't made by circuit()`,
    );
  }
  return found;
}

/** Whether `value` is a circuit made by `circuit()` (or built from IR). */
export function isCircuit(value: unknown): value is Circuit {
  return typeof value === 'object' && value !== null && internals.has(value as Circuit);
}

/**
 * The same circuit made with `args` as its options. For components built with
 * the config form of `circuit()`, which records none, that still need their
 * shape in `node.arguments` (the sandbox rebuilds their evals from source,
 * which drops the closure that held it).
 */
export function withArgs<T extends Circuit>(built: T, args: Record<string, ArgumentValue>): T {
  return makeCircuit({ ...internalsOf(built), args }) as T;
}

/**
 * Swap a primitive's behavior in place, for fault injection in tests: a parent
 * built from it runs the new behavior. Returns the behavior it replaced.
 */
export function replaceBehavior(built: Circuit, behavior: Behavior): Behavior | undefined {
  const parts = internalsOf(built);
  internals.set(built, { ...parts, behavior });
  return parts.behavior;
}

/** Port name to a frozen copy of its type, so the public object can't reach into the IR. */
function portTypes(ports: readonly PortDescriptor[]): Record<string, PortType> {
  const byName: Record<string, PortType> = {};
  for (const p of ports) byName[p.name] = Object.freeze({ ...p.portType });
  return Object.freeze(byName);
}
