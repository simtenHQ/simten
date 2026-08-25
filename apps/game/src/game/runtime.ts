/**
 * The surface the grader needs from a simulator, and the sandbox adapter for it.
 *
 * The grader is written against this rather than `SandboxHandle` directly so it
 * can be run host-side in tests, which is what proves a level is solvable
 * before anyone is asked to solve it. The browser passes `sandboxRuntime`; the
 * test suite passes a local one built on `executeCircuitCode`.
 */

import type { Circuit } from '@simten/core';
import type { SandboxHandle, SimSlot } from '@simten/ui/sandbox';

export interface CompiledSource {
  /** Circuits the source defines. */
  circuits: Circuit[];
  /** Everything else the source pulled in, stdlib included. */
  libraryCircuits: Circuit[];
}

export interface GradeRuntime {
  compile(source: string): Promise<CompiledSource>;
  /**
   * Point the simulator at one specific circuit.
   *
   * Not merely convenience: the sandbox's `compile` builds its simulator on the
   * LAST circuit in the source, so a player who defines a helper below their
   * answer would otherwise be graded on the helper.
   */
  select(target: Circuit, library: Circuit[]): Promise<void>;
  /**
   * Drive the named input signals, advance one clock cycle, then read the named
   * output signals.
   *
   * The tick is part of the contract, not an implementation detail: a level's
   * vectors are consecutive cycles, which is what lets a sequential level state
   * its behaviour as a sequence. An implementation that only settles the logic
   * would agree on every combinational level and quietly disagree on anything
   * with a clock in it.
   *
   * Keys in and out are the level's BARE signal names. The contract has to say
   * so: the sandbox reports top-level ports namespaced under `__top__` while
   * `@simten/core/sim` returns them bare, and leaving that unstated let the two
   * implementations disagree silently: grading read `undefined` for every
   * output and scored it 0, which passes any row that expects 0.
   *
   * A name resolves against either circuit shape; see `resolveOutput`.
   */
  evaluate(inputs: Record<string, number>, outputs: string[]): Promise<Record<string, number>>;
}

/** How the sandbox namespaces a top-level port. Mirrors core's TOP_LEVEL_NODE. */
const TOP_LEVEL_PREFIX = '__top__.';

/**
 * Find one output signal in a bag of port values.
 *
 * A signal named `out` is either a top-level output port (`__top__.out`) or the
 * input of a display node of that name (`out.in`), the two shapes a level can
 * take. Ports win, so a circuit with both is unambiguous.
 *
 * Driving inputs needs no equivalent: the simulator's `setNode` already tries a
 * top-level port first and falls back to a node id (simulator/index.ts:304),
 * so one bare name works for both shapes.
 */
export function resolveOutput(
  values: Record<string, number | boolean>,
  name: string,
): number | undefined {
  const raw = values[`${TOP_LEVEL_PREFIX}${name}`] ?? values[`${name}.in`];
  if (raw === undefined) return undefined;
  return typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
}

/** Read every named output, dropping ones the circuit does not expose. */
export function readOutputs(
  values: Record<string, number | boolean>,
  names: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of names) {
    const value = resolveOutput(values, name);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** Thrown for anything that is not a verdict on the player's design. */
export class RuntimeFailure extends Error {}

function isSandboxError(v: unknown): v is { type: 'error'; error: string } {
  return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'error';
}

function unwrap<T>(v: T | { type: 'error'; error: string }): T {
  if (isSandboxError(v)) throw new RuntimeFailure(v.error);
  return v;
}

/** Grade against the sandbox iframe. Player source never runs in this frame. */
export function sandboxRuntime(sandbox: SandboxHandle, slot: SimSlot = 'grade'): GradeRuntime {
  return {
    async compile(source) {
      const res = unwrap(await sandbox.compile(source, slot));
      return { circuits: res.circuits, libraryCircuits: res.libraryCircuits };
    },
    async select(target, library) {
      // Same slot as the compile above, so the evals registered there are
      // inherited and do not need transferring again.
      unwrap(await sandbox.compileIR(target, library, slot));
    },
    async evaluate(inputs, outputs) {
      const res = unwrap(await sandbox.tick(inputs, slot));
      return readOutputs(res.portValues, outputs);
    },
  };
}
