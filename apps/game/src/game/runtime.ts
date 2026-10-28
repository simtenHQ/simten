/**
 * The surface the grader needs from a simulator, and the sandbox adapter for it.
 *
 * The grader is written against this rather than `SandboxClient` directly so it
 * can be run host-side in tests, which is what proves a level is solvable
 * before anyone is asked to solve it. The browser passes `sandboxRuntime`; the
 * test suite passes a local one built on `executeCircuitCode`.
 */

import type { CircuitIR } from '@simten/core/internal';
import type { Compiled, SandboxClient, SimulationClient } from '@simten/sandbox';

interface CompiledSource {
  /** Circuits the source defines. */
  circuits: CircuitIR[];
  /** Everything else the source pulled in, stdlib included. */
  libraryCircuits: CircuitIR[];
}

export interface GradeRuntime {
  compile(source: string): Promise<CompiledSource>;
  /**
   * Point the simulator at one specific circuit of the last compile, by name,
   * so a player who defines a helper below their answer is graded on the answer.
   */
  select(target: CircuitIR): Promise<void>;
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
   * `@simten/core` returns them bare, and leaving that unstated let the two
   * implementations disagree silently: grading read `undefined` for every
   * output and scored it 0, which passes any row that expects 0.
   *
   * A name resolves against either circuit shape; see `splitInputs` and
   * `resolveOutput`.
   */
  evaluate(inputs: Record<string, number>, outputs: string[]): Promise<Record<string, number>>;
  /** Free what the grading held. `grade` calls it when it's done, pass or fail. */
  close(): Promise<void>;
}

/** How the sandbox namespaces a top-level port. Mirrors core's TOP_LEVEL_NODE. */
const TOP_LEVEL_PREFIX = '__top__.';

/** A vector's inputs, split by what each name drives. */
interface SplitInputs {
  /** Top-level input ports of the circuit, by port name. */
  ports: Record<string, number>;
  /** Nodes of the circuit (a Switch in a self-contained level), by node id. */
  nodes: Record<string, number>;
}

/**
 * Sort input signals by the shape the level takes: a signal named `a` is either
 * a top-level input port of `target` or a node with that id. Ports win, as for
 * outputs. The simulator takes exact names only, so this is where a bare level
 * signal becomes one or the other.
 */
export function splitInputs(target: CircuitIR, inputs: Record<string, number>): SplitInputs {
  const portNames = new Set(target.inputs.map((p) => p.name));
  const nodeIds = new Set(target.nodes.map((n) => n.id));
  const split: SplitInputs = { ports: {}, nodes: {} };
  for (const [name, value] of Object.entries(inputs)) {
    if (portNames.has(name)) split.ports[name] = value;
    else if (nodeIds.has(name)) split.nodes[name] = value;
    else throw new RuntimeFailure(`\`${target.name}\` has no input port or node \`${name}\``);
  }
  return split;
}

/**
 * Find one output signal in a bag of port values.
 *
 * A signal named `out` is either a top-level output port (`__top__.out`) or the
 * input of a display node of that name (`out.in`), the two shapes a level can
 * take. Ports win, so a circuit with both is unambiguous.
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

/**
 * Grade in the sandbox. Player source never runs in this frame. Each grading
 * gets its own compile and session, freed by `close`.
 */
export function sandboxRuntime(sandbox: SandboxClient): GradeRuntime {
  let compiled: Compiled | null = null;
  let session: SimulationClient | null = null;
  let selected: CircuitIR | null = null;
  return {
    async compile(source) {
      compiled = await sandbox.compile(source);
      return { circuits: compiled.circuits, libraryCircuits: compiled.libraryCircuits };
    },
    async select(target) {
      if (!compiled) throw new RuntimeFailure('compile() was not called before select()');
      // By name, so a helper defined after the target is never what's graded.
      session = await sandbox.open({ compiled, circuit: target.name }, { history: 0 });
      selected = target;
    },
    async evaluate(inputs, outputs) {
      if (!session || !selected) {
        throw new RuntimeFailure('select() was not called before evaluate()');
      }
      const { ports, nodes } = splitInputs(selected, inputs);
      // One request for the whole vector: written one at a time, a latch would
      // see the switches change in order and could follow a value it should hold.
      if (Object.keys(nodes).length > 0) await session.setInputs(nodes);
      if (Object.keys(ports).length > 0) await session.set(ports);
      await session.tick();
      return readOutputs(Object.fromEntries(session.getState().ports), outputs);
    },
    async close() {
      const open = session;
      session = null;
      if (compiled) sandbox.release(compiled);
      compiled = null;
      await open?.close();
    },
  };
}
