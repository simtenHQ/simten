/**
 * Build a Circuit from Circuit IR returned by the sandbox.
 *
 * The sandbox returns plain Circuit IR (JSON-serializable). This function
 * wraps it in a Circuit so it can be passed to CircuitEmbed/CircuitViewer,
 * which only needs the circuit IR and its dependency circuits — no closures,
 * no executable code.
 *
 * The IR carries no behavior, so the result has none unless a behavior table
 * is passed (an import's, for example): each primitive whose name is in it gets
 * that behavior. Without one the circuit is for display, or for the sandbox,
 * which runs the behavior of its own compile.
 *
 * Usage:
 *   const result = await sandbox.compile(source);
 *   if ('error' in result) { ... }
 *   const built = buildFromIR(
 *     result.circuits[result.circuits.length - 1],
 *     result.libraryCircuits,
 *   );
 */

import type { CircuitIR } from '../ir/circuit-ir.js';
import type { BehaviorTable } from './behavior.js';
import type { Circuit } from './builder-types.js';
import { makeCircuit } from './internals.js';

/**
 * Reconstruct a Circuit from sandbox-returned Circuit IR.
 *
 * @param circuit - The main circuit to display
 * @param libraryCircuits - All dependency circuits returned by the sandbox
 * @param behaviors - Behavior to attach to primitives, by name
 * @returns A Circuit suitable for CircuitEmbed / CircuitViewer
 */
export function buildFromIR(
  circuit: CircuitIR,
  libraryCircuits: CircuitIR[],
  behaviors?: BehaviorTable,
): Circuit {
  const dependencies = new Map<string, Circuit>();
  for (const dep of libraryCircuits) {
    dependencies.set(dep.name, wrap(dep, new Map(), behaviors));
  }
  return wrap(circuit, dependencies, behaviors);
}

function wrap(
  ir: CircuitIR,
  dependencies: Map<string, Circuit>,
  behaviors?: BehaviorTable,
): Circuit {
  const behavior = ir.implementation.kind === 'primitive' ? behaviors?.get(ir.name) : undefined;
  return makeCircuit({ ir, dependencies, args: {}, behavior });
}
