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
 * Where the player's code executes is the runtime's business, not this file's;
 * see `runtime.ts`. In the browser it is the sandbox iframe, never this frame.
 */

import type { Circuit, FlatCircuit } from '@simten/core';
import { elaborate } from '@simten/core';
import { type GradeRuntime, RuntimeFailure } from './runtime';
import type { GradeFailure, GradeResult, Level } from './types';

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
export const STRUCTURAL = new Set(['Switch', 'Led', 'Input', 'Output', 'HexDisplay']);

/**
 * Does the circuit expose this signal, either as a top-level port or as a node of
 * that name? Both shapes are valid; which one a level uses is a curriculum
 * decision, not something the grader needs to know.
 */
function exposes(circuit: Circuit, name: string, side: 'inputs' | 'outputs'): boolean {
  if (circuit[side].some((p) => p.name === name)) return true;
  return circuit.nodes.some((n) => n.id === name);
}

function interfaceProblems(circuit: Circuit, level: Level): string[] {
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
    if (!permitted.has(node.primitiveType)) used.add(node.primitiveType);
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
export function countGates(flat: FlatCircuit, allowed: string[]): number {
  const permitted = new Set(allowed);
  return flat.nodes.filter((n) => permitted.has(n.primitiveType)).length;
}

const fail = (failure: GradeFailure): GradeResult => ({ status: 'fail', failure });

export async function grade(
  runtime: GradeRuntime,
  level: Level,
  source: string,
): Promise<GradeResult> {
  try {
    const { circuits, libraryCircuits } = await runtime.compile(source);
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
    await runtime.select(target, all);
    for (const vector of level.vectors) {
      const ports = await runtime.evaluate(vector.inputs, level.outputs);
      const actual: Record<string, number> = {};
      let wrong = false;
      for (const [port, want] of Object.entries(vector.expect)) {
        const got = ports[port];
        // Deliberately not `?? 0`. A signal the runtime cannot read is a broken
        // runtime, not an output of zero, and defaulting it silently passes
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
      if (wrong) return fail({ kind: 'vector', vector, actual });
    }

    return { status: 'pass', gates: countGates(flat, level.allowed) };
  } catch (e) {
    const message = e instanceof RuntimeFailure || e instanceof Error ? e.message : String(e);
    return { status: 'error', message };
  }
}
