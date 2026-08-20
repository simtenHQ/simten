/**
 * A GradeRuntime that runs on this thread, for tests.
 *
 * The browser grades in the sandbox iframe. Nothing about the *rules* needs an
 * iframe, though, so the suite drives the same grader through
 * `executeCircuitCode` and the simulator engine directly. That is what lets the
 * validation gate run in CI.
 *
 * It goes to the engine rather than the friendlier `simulate()` handle because
 * that handle's `get(name)` resolves a top-level port and otherwise falls back
 * to *any* port key ending in `.name` — which is ambiguous the moment gates
 * have their own `a`/`b`/`in` ports. Reading an `Led` named `out` means reading
 * exactly `out.in`, so the raw port map is what is needed.
 *
 * Deliberately not exported from the app: shipping a path that executes player
 * source in the main frame would defeat the sandbox.
 */

import type { Circuit } from '@simten/core';
import { createSimulatorFromCircuit, executeCircuitCode } from '@simten/core';
import type { GradeRuntime } from '../runtime';
import { RuntimeFailure, readOutputs } from '../runtime';

export function localRuntime(): GradeRuntime {
  let library: Circuit[] = [];
  let engine: ReturnType<typeof createSimulatorFromCircuit> | null = null;

  return {
    async compile(source) {
      const result = executeCircuitCode(source);
      if (result.error) throw new RuntimeFailure(result.error);
      library = result.library
        .getAllCircuitNames()
        .map((n) => result.library.resolveCircuit(n))
        .filter((c): c is Circuit => c != null);
      return { circuits: result.circuits, libraryCircuits: library };
    },

    async select(target, all) {
      const byName = new Map([...library, ...all].map((c) => [c.name, c]));
      engine = createSimulatorFromCircuit(target, {
        resolveCircuit: (name: string) => byName.get(name),
        getAllPrimitiveNames: () =>
          [...byName.values()]
            .filter((c) => c.implementation?.kind === 'primitive')
            .map((c) => c.name),
      });
    },

    async evaluate(inputs, outputs) {
      if (!engine) throw new RuntimeFailure('select() was not called before evaluate()');
      // `setNode` resolves a bare name to a top-level input port first and a
      // node id second (simulator/index.ts:304), so the same call drives a
      // Switch in a self-contained level and a port in an abstracted one.
      for (const [name, value] of Object.entries(inputs)) engine.setNode(name, value);
      // A clock cycle, because that is what the browser does: `sandboxRuntime`
      // grades through `sandbox.tick`. This used `runCombinational`, which
      // settles the logic without advancing a clock — the two agreed on every
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
