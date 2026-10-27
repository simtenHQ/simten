/**
 * Behavior: a primitive's `eval` and `onTick` closures, carried alongside the
 * IR rather than inside it (decision 0001).
 *
 * A built `Circuit` carries its own behavior, in its internals. A compile collects a
 * `BehaviorTable` for exactly the circuit tree it compiles and hands it to the
 * engine, the Verilog exporter and anything else that needs to run or read
 * behavior. Nothing is registered globally, so two compiles never see each
 * other's circuits and importing a module registers nothing.
 */

import type { CircuitDefinitions, CircuitIR, MutableCircuitDefinitions } from '../ir/circuit-ir.js';
import type { Circuit } from './builder-types.js';
import { internalsOf } from './internals.js';

/** Named values in and out of an `eval` or `onTick`. */
export type BehaviorValues = Record<string, unknown>;
export type BehaviorFn = (inputs: BehaviorValues) => BehaviorValues;

export interface Behavior {
  inputNames: string[];
  outputNames: string[];
  evalFn: BehaviorFn;
  stateKeys?: string[];
  onTickFn?: BehaviorFn;
}

/** Behavior by component name, for one compile. */
export type BehaviorTable = ReadonlyMap<string, Behavior>;

/** The eval of a primitive declared without one (a display, a bare port shape). */
export const NO_EVAL: BehaviorFn = () => ({});

/** Whether the behavior has user callbacks, as opposed to the no-op default. */
export function hasCallbacks(behavior: Behavior): boolean {
  return behavior.evalFn !== NO_EVAL || behavior.onTickFn !== undefined;
}

const definitionKeys = new WeakMap<Behavior, string>();

/**
 * What makes two primitives under one name the same definition: the port and
 * state names and the behavior's source text. Port widths are left out, since
 * specialisations of one factory differ there and nowhere else.
 */
export function definitionKey(behavior: Behavior): string {
  let key = definitionKeys.get(behavior);
  if (key === undefined) {
    key = JSON.stringify([
      behavior.inputNames,
      behavior.outputNames,
      behavior.stateKeys ?? [],
      String(behavior.evalFn),
      behavior.onTickFn ? String(behavior.onTickFn) : '',
    ]);
    definitionKeys.set(behavior, key);
  }
  return key;
}

/** Circuit definitions keyed by name, starting from `circuits` (later ones win). */
export function createDefinitions(circuits: Iterable<CircuitIR> = []): MutableCircuitDefinitions {
  const byName = new Map<string, CircuitIR>();
  for (const c of circuits) byName.set(c.name, c);
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
    addCircuit: (c) => {
      byName.set(c.name, c);
    },
    getAllCircuitNames: () => [...byName.keys()],
  };
}

/**
 * A library: circuit definitions and their behavior, by name. It is what a
 * compile runs from, whether that is one user circuit tree or all of std.
 */
export interface Library {
  definitions: CircuitDefinitions;
  behaviors: BehaviorTable;
}

/** A library that circuits can still be added to. */
export interface MutableLibrary extends Library {
  definitions: MutableCircuitDefinitions;
  behaviors: Map<string, Behavior>;
}

export function emptyLibrary(): MutableLibrary {
  return { definitions: createDefinitions(), behaviors: new Map() };
}

/**
 * Add a circuit and its dependencies to a library.
 *
 * One rule for names: within one circuit tree, and within std, a name means one
 * circuit, and two different circuits under it are an error (`circuit()` and
 * `getStdLibrary` throw). Across trees added to one library, a later circuit
 * replaces an earlier one of the same name. That is how source that redefines a
 * circuit, or names one like a std component, gets its own definition.
 */
export function addToLibrary(library: MutableLibrary, top: Circuit): void {
  for (const c of [top, ...internalsOf(top).dependencies.values()]) {
    const { ir, behavior } = internalsOf(c);
    library.definitions.addCircuit(ir);
    if (behavior) library.behaviors.set(ir.name, behavior);
  }
}

/**
 * The library for exactly one circuit tree. `circuit()` rejects two different
 * circuits under one name in a tree, so each name here has one definition.
 */
export function libraryOf(top: Circuit): MutableLibrary {
  const library = emptyLibrary();
  addToLibrary(library, top);
  return library;
}
