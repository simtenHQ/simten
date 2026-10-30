/**
 * Grading a submission.
 *
 * Four gates, in order, each producing a message the player can act on:
 *
 *   1. does a circuit of the required name exist
 *   2. does it expose the signals the level names
 *   3. is it built only from primitives the level permits
 *   4. does it produce the right output for every vector
 *
 * The order matters. A missing signal produces nonsense truth-table failures,
 * and a forbidden primitive is worth reporting even when the answer is correct,
 * so both are settled before anything is simulated.
 *
 * The player's code runs in the sandbox the caller passes: the iframe in the
 * browser, never this frame, and `inProcessSandbox()` in tests. Both put the
 * same session host behind a `SandboxClient`, so the suite that proves every
 * level solvable runs exactly the code that grades the player.
 */

import type { CircuitIR, FlatCircuit } from '@simten/core/internal';
import { elaborate } from '@simten/core/internal';
import type { Compiled, SandboxClient, SimulationClient } from '@simten/sandbox';
import type { GradeFailure, GradeResult, Level } from './types';

/** How the sandbox namespaces a top-level port. Mirrors core's TOP_LEVEL_NODE. */
const TOP_LEVEL_PREFIX = '__top__.';

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

/**
 * Read every named output, dropping ones the circuit does not expose. Keys out
 * are the level's bare signal names, never the sandbox's `__top__` ones.
 */
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

/**
 * Primitives that carry no logic, so a level never has to permit them
 * explicitly. `Switch`/`Led` are how a self-contained level gets its signals;
 * `Input`/`Output` are the port-based equivalent.
 *
 * They need no exemption from the *score*; that is counted positively from
 * the level's `allowed` list, so anything absent from it simply does not count.
 * A mistake here therefore fails loudly (a valid solution is rejected with
 * "not available here") rather than quietly skewing par.
 *
 * Nothing here computes: a Switch sources a value, an Led consumes one. There
 * is no way to smuggle logic through an exempt node.
 */
export const STRUCTURAL = new Set([
  'Switch',
  'Led',
  'Input',
  'Output',
  'HexDisplay',
  // Pure wiring between a bus and its bits. Each width registers as its own
  // primitive (`Splitter_4w`), so the netlist name is matched by its base.
  'Splitter',
  'Combiner',
]);

/**
 * The name a primitive is permitted under. Parts whose ports change with an
 * argument register one primitive per shape (`Splitter_4w`); the player writes
 * `Splitter({ width: 4 })`, so that is the name the level permits.
 */
function permittedName(primitiveType: string): string {
  return primitiveType.replace(/_\d+w$/, '');
}

/**
 * Does the circuit expose this signal, either as a top-level port or as a node of
 * that name? Both shapes are valid; which one a level uses is a curriculum
 * decision, not something the grader needs to know.
 */
function exposes(circuit: CircuitIR, name: string, side: 'inputs' | 'outputs'): boolean {
  if (circuit[side].some((p) => p.name === name)) return true;
  return circuit.nodes.some((n) => n.id === name);
}

function interfaceProblems(circuit: CircuitIR, level: Level): string[] {
  const problems: string[] = [];
  for (const name of level.inputs) {
    if (!exposes(circuit, name, 'inputs')) problems.push(`no input signal \`${name}\``);
  }
  for (const name of level.outputs) {
    if (!exposes(circuit, name, 'outputs')) problems.push(`no output signal \`${name}\``);
  }
  return problems;
}

/**
 * Everything a level lets you place: its own gates, plus the structural pieces
 * that carry no logic.
 *
 * One definition, three consumers: the editor's ambient globals, the canvas
 * preview, and this grader. They were each composing `allowed ∪ STRUCTURAL`
 * separately, which is how an editor that autocompletes a gate the grader then
 * rejects comes about. `__tests__/permitted.test.ts` pins that they agree.
 */
export function permittedFor(allowed: string[]): string[] {
  return [...allowed, ...STRUCTURAL];
}

/** Primitives in the elaborated netlist that the level does not permit. */
export function forbiddenPrimitives(flat: FlatCircuit, allowed: string[]): string[] {
  const permitted = new Set(permittedFor(allowed));
  const used = new Set<string>();
  for (const node of flat.nodes) {
    if (!permitted.has(permittedName(node.primitiveType))) used.add(node.primitiveType);
  }
  return [...used].sort();
}

/**
 * The score: how many of the level's own permitted primitives were placed.
 *
 * Defined positively on purpose. Counting everything and subtracting an
 * exclusion list means a primitive nobody remembered to exclude inflates par
 * silently; this way anything outside `allowed` is either structural or already
 * rejected above.
 */
function countGates(flat: FlatCircuit, allowed: string[]): number {
  const permitted = new Set(allowed);
  return flat.nodes.filter((n) => permitted.has(n.primitiveType)).length;
}

const fail = (failure: GradeFailure): GradeResult => ({ status: 'fail', failure });

/**
 * Play the level's vectors on an open session: the verdict on the truth table,
 * or null when every row matches.
 */
async function runVectors(session: SimulationClient, level: Level): Promise<GradeResult | null> {
  for (const [index, vector] of level.vectors.entries()) {
    // One request for the whole vector, ports and switches alike: written one
    // at a time, a latch would see the switches change in order and could
    // follow a value it should hold. An input name is a top-level input port or
    // a Switch or Input node; `set` refuses anything else.
    await session.set(vector.inputs);
    // A clock cycle, not just a settle. A level's vectors are consecutive
    // cycles, which is what lets a sequential level state its behaviour as a
    // sequence.
    await session.tick();
    const ports = readOutputs(Object.fromEntries(session.getState().ports), level.outputs);
    const actual: Record<string, number> = {};
    let wrong = false;
    for (const [port, want] of Object.entries(vector.expect)) {
      const got = ports[port];
      // Deliberately not `?? 0`. A signal the grader cannot read is a broken
      // grader, not an output of zero, and defaulting it silently passes
      // every row that happens to expect 0, which is most of them.
      if (got === undefined) {
        return {
          status: 'error',
          message:
            `Could not read output \`${port}\`. Available: ` +
            `${Object.keys(ports).join(', ') || '(none)'}`,
        };
      }
      actual[port] = got;
      if (got !== want) wrong = true;
    }
    if (wrong) return fail({ kind: 'vector', index, vector, actual });
  }
  return null;
}

/**
 * Grade `source` against `level` in `sandbox`. Each grading gets its own
 * compile and session, both freed when it ends, pass or fail.
 */
export async function grade(
  sandbox: SandboxClient,
  level: Level,
  source: string,
): Promise<GradeResult> {
  let compiled: Compiled | null = null;
  let session: SimulationClient | null = null;
  try {
    compiled = await sandbox.compile(source);
    const { circuits, libraryCircuits } = compiled;
    const all = [...circuits, ...libraryCircuits];

    // ── 1. the circuit exists ──
    const target = all.find((c) => c.name === level.target);
    if (!target) {
      return fail({
        kind: 'missing-circuit',
        expected: level.target,
        found: circuits.map((c) => c.name),
      });
    }

    // ── 2. it exposes the signals the level names ──
    const problems = interfaceProblems(target, level);
    if (problems.length > 0) return fail({ kind: 'interface', problems });

    // ── 3. built only from what the level permits ──
    const byName = new Map(all.map((c) => [c.name, c]));
    const flat = elaborate(target, {
      resolveCircuit: (name: string) => byName.get(name),
      getAllPrimitiveNames: () =>
        all.filter((c) => c.implementation?.kind === 'primitive').map((c) => c.name),
    });

    const forbidden = forbiddenPrimitives(flat, level.allowed);
    if (forbidden.length > 0) {
      return fail({ kind: 'forbidden', used: forbidden, allowed: level.allowed });
    }

    // ── 4. the truth table ──
    // By name, so a helper defined after the target is never what's graded.
    session = await sandbox.open({ compiled, circuit: target.name }, { history: 0 });
    const failed = await runVectors(session, level);
    if (failed) return failed;

    return { status: 'pass', gates: countGates(flat, level.allowed) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  } finally {
    // Freeing is housekeeping, not part of the verdict.
    if (compiled) sandbox.release(compiled);
    await session?.close().catch(() => {});
  }
}
