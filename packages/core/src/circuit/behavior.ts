/**
 * Behavior: a primitive's `eval` and `onTick` closures, carried alongside the
 * IR rather than inside it (decision 0001).
 *
 * A built `Circuit` carries its own behavior. A compile collects a
 * `BehaviorTable` for exactly the circuit tree it compiles and hands it to the
 * engine, the Verilog exporter and anything else that needs to run or read
 * behavior. Nothing is registered globally, so two compiles never see each
 * other's circuits and importing a module registers nothing.
 */

import type { CircuitIR, MutableCircuitLibrary } from '../ir/circuit-ir.js';
import type { Circuit } from './builder-types.js';

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

/**
 * Behavior of each primitive built by `circuit()`, keyed by the built object.
 * The circuit itself stays plain data, and a circuit nothing references any
 * more is freed along with its entry.
 */
const behaviors = new WeakMap<Circuit, Behavior>();

/** Record a built circuit's behavior. Calling it again replaces it (fault injection). */
export function attachBehavior(built: Circuit, behavior: Behavior): void {
  behaviors.set(built, behavior);
}

/** The behavior a circuit was built with, if it is a primitive built by `circuit()`. */
export function behaviorOf(built: Circuit): Behavior | undefined {
  return behaviors.get(built);
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

/** A name-keyed library over the circuits added to it. */
export function createLibrary(): MutableCircuitLibrary {
  const circuits = new Map<string, CircuitIR>();
  return {
    resolveCircuit: (name) => circuits.get(name),
    getAllPrimitiveNames: () =>
      [...circuits.values()]
        .filter((c) => c.implementation.kind === 'primitive')
        .map((c) => c.name),
    addCircuit: (c) => {
      circuits.set(c.name, c);
    },
    getAllCircuitNames: () => [...circuits.keys()],
  };
}

/** What one compile works from: circuit definitions and their behavior, by name. */
export interface Design {
  library: MutableCircuitLibrary;
  behaviors: Map<string, Behavior>;
}

export function emptyDesign(): Design {
  return { library: createLibrary(), behaviors: new Map() };
}

/**
 * Add a circuit and its dependencies to a design.
 *
 * One rule for names: within one circuit tree, and within std, a name means one
 * circuit, and two different circuits under it are an error (`circuit()` and
 * `getStdDesign` throw). Across trees added to one design, a later circuit
 * replaces an earlier one of the same name. That is how source that redefines a
 * circuit, or names one like a std component, gets its own definition.
 */
export function addToDesign(design: Design, top: Circuit): void {
  for (const c of [top, ...top._dependencies.values()]) {
    design.library.addCircuit(c.circuit);
    const behavior = behaviorOf(c);
    if (behavior) design.behaviors.set(c.circuit.name, behavior);
  }
}

/**
 * The library and behavior table for exactly one circuit tree. `circuit()`
 * rejects two different circuits under one name in a tree, so each name here
 * has one definition.
 */
export function designOf(top: Circuit): Design {
  const design = emptyDesign();
  addToDesign(design, top);
  return design;
}
