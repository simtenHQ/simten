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
import { attachBehavior, type BehaviorTable } from './behavior.js';
import type { Circuit } from './builder-types.js';

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
    dependencies.set(dep.name, attachToJSON(wrap(dep, new Map(), behaviors)));
  }
  return attachToJSON(wrap(circuit, dependencies, behaviors));
}

function wrap(c: CircuitIR, deps: Map<string, Circuit>, behaviors?: BehaviorTable): Circuit {
  const inputs: Record<string, (typeof c.inputs)[number]> = {};
  for (const p of c.inputs) inputs[p.name] = p;
  const outputs: Record<string, (typeof c.outputs)[number]> = {};
  for (const p of c.outputs) outputs[p.name] = p;
  const nodes: Record<string, (typeof c.nodes)[number]> = {};
  for (const n of c.nodes) nodes[n.id] = n;
  const built = {
    circuit: c,
    inputs,
    outputs,
    nodes,
    _dependencies: deps,
  } as unknown as Circuit;
  const behavior = c.implementation.kind === 'primitive' ? behaviors?.get(c.name) : undefined;
  if (behavior) attachBehavior(built, behavior);
  return built;
}

function attachToJSON<T extends Circuit>(built: T): T {
  Object.defineProperty(built, 'toJSON', {
    value: function () {
      const deps: Record<string, unknown> = {};
      for (const [n, d] of this._dependencies) deps[n] = d;
      return { circuit: this.circuit, _dependencies: deps };
    },
    enumerable: false,
  });
  return built;
}
