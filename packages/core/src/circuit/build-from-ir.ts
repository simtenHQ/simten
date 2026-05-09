/**
 * Build a BuiltCircuit from Circuit IR returned by the sandbox.
 *
 * The sandbox returns plain Circuit IR (JSON-serializable). This function
 * wraps it in a BuiltCircuit so it can be passed to CircuitEmbed/CircuitViewer,
 * which only needs the circuit IR and its dependency circuits — no closures,
 * no executable code.
 *
 * Note: simulation in the main frame only works for circuits whose components
 * use stdlib evaluators (registered at module load). Circuits with custom eval/
 * onTick defined in user code won't simulate correctly here — the same limitation
 * exists in the editor's live preview.
 *
 * Usage:
 *   const result = await sandbox.compile(source);
 *   if ('error' in result) { ... }
 *   const built = buildFromIR(
 *     result.circuits[result.circuits.length - 1],
 *     result.libraryCircuits,
 *   );
 */

import type { Circuit } from '../types/circuit.js';
import type { BuiltCircuit } from './types.js';

/**
 * Reconstruct a BuiltCircuit from sandbox-returned Circuit IR.
 *
 * @param circuit - The main circuit to display
 * @param libraryCircuits - All dependency circuits returned by the sandbox
 * @returns A BuiltCircuit suitable for CircuitEmbed / CircuitViewer
 */
export function buildFromIR(circuit: Circuit, libraryCircuits: Circuit[]): BuiltCircuit {
  const dependencies = new Map<string, BuiltCircuit>();
  for (const dep of libraryCircuits) {
    dependencies.set(dep.name, attachToJSON(wrap(dep, new Map())));
  }
  return attachToJSON(wrap(circuit, dependencies));
}

function wrap(c: Circuit, deps: Map<string, BuiltCircuit>): BuiltCircuit {
  const inputs: Record<string, typeof c.inputs[number]> = {};
  for (const p of c.inputs) inputs[p.name] = p;
  const outputs: Record<string, typeof c.outputs[number]> = {};
  for (const p of c.outputs) outputs[p.name] = p;
  const nodes: Record<string, typeof c.nodes[number]> = {};
  for (const n of c.nodes) nodes[n.id] = n;
  return {
    circuit: c,
    inputs,
    outputs,
    nodes,
    _dependencies: deps,
  } as unknown as BuiltCircuit;
}

function attachToJSON<T extends BuiltCircuit>(built: T): T {
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
