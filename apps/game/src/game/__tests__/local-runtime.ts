/**
 * A GradeRuntime that runs on this thread, for tests.
 *
 * The browser grades in the sandbox iframe. Nothing about the *rules* needs an
 * iframe, though, so the suite drives the same grader through
 * `executeCircuitCode` and the simulator engine directly. That is what lets the
 * validation gate run in CI.
 *
 * It goes to the engine rather than `simulate()` because a self-contained
 * level's signals are Switch and Led nodes, not ports, and `Simulation.get`
 * reads top-level ports only. Reading an `Led` named `out` means reading
 * exactly `out.in`, so the raw port map is what is needed.
 *
 * Deliberately not exported from the app: shipping a path that executes player
 * source in the main frame would defeat the sandbox.
 */

import type { Behavior, CircuitIR } from '@simten/core/internal';
import {
  createEngine,
  elaborate,
  executeCircuitCode,
  getStdLibrary,
  internalsOf,
} from '@simten/core/internal';
import type { GradeRuntime } from '../runtime';
import { RuntimeFailure, readOutputs, splitInputs } from '../runtime';

export function localRuntime(): GradeRuntime {
  let compiled: CircuitIR[] = [];
  let behaviors: ReadonlyMap<string, Behavior> = new Map();
  let engine: ReturnType<typeof createEngine> | null = null;
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
      behaviors = result.library.behaviors;
      return { circuits: result.circuits.map((c) => internalsOf(c).ir), libraryCircuits: compiled };
    },

    async select(target, all) {
      const byName = new Map([...compiled, ...all].map((c) => [c.name, c]));
      const definitions = {
        resolveCircuit: (name: string) => byName.get(name),
        getAllPrimitiveNames: () =>
          [...byName.values()]
            .filter((c) => c.implementation?.kind === 'primitive')
            .map((c) => c.name),
      };
      // As the sandbox's compile-ir: std's behavior under the compiled source's.
      engine = createEngine(elaborate(target, definitions), {
        library: { definitions, behaviors: new Map([...getStdLibrary().behaviors, ...behaviors]) },
      });
      selected = target;
    },

    async evaluate(inputs, outputs) {
      if (!engine || !selected) {
        throw new RuntimeFailure('select() was not called before evaluate()');
      }
      // The same split as `sandboxRuntime`: a port in an abstracted level, a
      // Switch node in a self-contained one. The engine takes either name.
      const { ports, nodes } = splitInputs(selected, inputs);
      for (const [name, value] of Object.entries({ ...ports, ...nodes })) {
        engine.setNode(name, value);
      }
      // A clock cycle, because that is what the browser does: `sandboxRuntime`
      // grades through `sandbox.tick`. This used `runCombinational`, which
      // settles the logic without advancing a clock; the two agreed on every
      // combinational level and silently disagreed on anything clocked, so a
      // level that graded correctly in the browser could never pass CI. A
      // latch hides the difference, being combinational feedback; a flip-flop
      // does not, and simply never advances.
      engine.tick();

      const values: Record<string, number | boolean> = {};
      for (const [k, v] of engine.getPortValues()) values[k] = v;
      return readOutputs(values, outputs);
    },
  };
}
