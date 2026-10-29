/**
 * A GradeRuntime that runs on this thread, for tests.
 *
 * The browser grades in the sandbox iframe. Nothing about the *rules* needs an
 * iframe, though, so the suite drives the same grader through
 * `executeCircuitCode` and core's `Simulation` directly. That is what lets the
 * validation gate run in CI.
 *
 * It follows the sandbox's rules: a vector input is a top-level port or a
 * Switch/Input node, both written by `set`, which refuses anything else, and
 * outputs are read from the flat port map, where a self-contained level's
 * `Led` named `out` is exactly `out.in`.
 *
 * Deliberately not exported from the app: shipping a path that executes player
 * source in the main frame would defeat the sandbox.
 */

import type { Simulation } from '@simten/core';
import {
  type CircuitIR,
  createSimulation,
  executeCircuitCode,
  getStdLibrary,
  internalsOf,
  type Library,
  nodesOf,
} from '@simten/core/internal';
import type { GradeRuntime } from '../runtime';
import { RuntimeFailure, readOutputs } from '../runtime';

export function localRuntime(): GradeRuntime {
  let compiled: CircuitIR[] = [];
  let library: Library | null = null;
  let simulation: Simulation | null = null;
  let selected: CircuitIR | null = null;

  return {
    async compile(source) {
      const result = executeCircuitCode(source);
      if (result.error) throw new RuntimeFailure(result.error);
      const { definitions } = result.library;
      compiled = definitions
        .getAllCircuitNames()
        .map((n) => definitions.resolveCircuit(n))
        .filter((c): c is CircuitIR => c != null);
      library = result.library;
      return { circuits: result.circuits.map((c) => internalsOf(c).ir), libraryCircuits: compiled };
    },

    async select(target) {
      if (!library) throw new RuntimeFailure('compile() was not called before select()');
      const byName = new Map(compiled.map((c) => [c.name, c]));
      const definitions = {
        resolveCircuit: (name: string) => byName.get(name),
        getAllPrimitiveNames: () =>
          [...byName.values()]
            .filter((c) => c.implementation?.kind === 'primitive')
            .map((c) => c.name),
      };
      // As the sandbox's open: std's behavior under the compiled source's.
      simulation = createSimulation(target, {
        definitions,
        behaviors: new Map([...getStdLibrary().behaviors, ...library.behaviors]),
      });
      selected = target;
    },

    async evaluate(inputs, outputs) {
      if (!simulation || !selected) {
        throw new RuntimeFailure('select() was not called before evaluate()');
      }
      simulation.set(inputs);
      // A clock cycle, as the browser grades: `sandboxRuntime` ticks after
      // every vector. Settling alone agrees on every combinational level and
      // silently disagrees on anything clocked, so a level that graded
      // correctly in the browser could never pass CI.
      simulation.tick();
      return readOutputs(Object.fromEntries(nodesOf(simulation).ports()), outputs);
    },

    async close() {
      simulation = null;
      selected = null;
    },
  };
}
