/**
 * Behaviour: a primitive's `eval` and `onTick` closures, carried alongside the
 * IR rather than inside it (decision 0001).
 *
 * A built `Circuit` carries its own behaviour. A compile collects a
 * `BehaviourTable` for exactly the circuit tree it compiles and hands it to the
 * engine, the Verilog exporter and anything else that needs to run or read
 * behaviour. Nothing is registered globally, so two compiles never see each
 * other's circuits and importing a module registers nothing.
 */

import type { CircuitIR, MutableCircuitLibrary } from '../ir/circuit-ir.js';
import type { Circuit } from './builder-types.js';

/** Named values in and out of an `eval` or `onTick`. */
export type BehaviourValues = Record<string, unknown>;
export type BehaviourFn = (inputs: BehaviourValues) => BehaviourValues;

export interface Behaviour {
  inputNames: string[];
  outputNames: string[];
  evalFn: BehaviourFn;
  stateKeys?: string[];
  onTickFn?: BehaviourFn;
}

/** Behaviour by component name, for one compile. */
export type BehaviourTable = ReadonlyMap<string, Behaviour>;

/** The eval of a primitive declared without one (a display, a bare port shape). */
export const NO_EVAL: BehaviourFn = () => ({});

/** Whether the behaviour has user callbacks, as opposed to the no-op default. */
export function hasCallbacks(behaviour: Behaviour): boolean {
  return behaviour.evalFn !== NO_EVAL || behaviour.onTickFn !== undefined;
}

/**
 * Behaviour of each primitive built by `circuit()`, keyed by the built object.
 * The circuit itself stays plain data, and a circuit nothing references any
 * more is freed along with its entry.
 */
const behaviours = new WeakMap<Circuit, Behaviour>();

/** Record a built circuit's behaviour. Calling it again replaces it (fault injection). */
export function attachBehaviour(built: Circuit, behaviour: Behaviour): void {
  behaviours.set(built, behaviour);
}

/** The behaviour a circuit was built with, if it is a primitive built by `circuit()`. */
export function behaviourOf(built: Circuit): Behaviour | undefined {
  return behaviours.get(built);
}

const definitionKeys = new WeakMap<Behaviour, string>();

/**
 * What makes two primitives under one name the same definition: the port and
 * state names and the behaviour's source text. Port widths are left out, since
 * specialisations of one factory differ there and nowhere else.
 */
export function definitionKey(behaviour: Behaviour): string {
  let key = definitionKeys.get(behaviour);
  if (key === undefined) {
    key = JSON.stringify([
      behaviour.inputNames,
      behaviour.outputNames,
      behaviour.stateKeys ?? [],
      String(behaviour.evalFn),
      behaviour.onTickFn ? String(behaviour.onTickFn) : '',
    ]);
    definitionKeys.set(behaviour, key);
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

/** What one compile works from: circuit definitions and their behaviour, by name. */
export interface Design {
  library: MutableCircuitLibrary;
  behaviours: Map<string, Behaviour>;
}

export function emptyDesign(): Design {
  return { library: createLibrary(), behaviours: new Map() };
}

/** Add a circuit and its dependencies to a design. Later additions replace earlier ones. */
export function addToDesign(design: Design, top: Circuit): void {
  for (const c of [top, ...top._dependencies.values()]) {
    design.library.addCircuit(c.circuit);
    const behaviour = behaviourOf(c);
    if (behaviour) design.behaviours.set(c.circuit.name, behaviour);
  }
}

/**
 * The library and behaviour table for exactly one circuit tree. `circuit()`
 * rejects two different circuits under one name in a tree, so each name here
 * has one definition.
 */
export function designOf(top: Circuit): Design {
  const design = emptyDesign();
  addToDesign(design, top);
  return design;
}
