/**
 * Recursively detect if a circuit is sequential (has clocks/state at any level).
 *
 * A circuit is sequential if it, OR any composite it contains, has:
 *   - clocks declared
 *   - state declared (reg or mem)
 *
 * Walks the full dependency tree via the library's resolveCircuit.
 */

import type { Circuit } from '../types/circuit.js';

export function isSequentialCircuit(
  circuit: Circuit | null | undefined,
  resolveCircuit: (name: string) => Circuit | undefined,
  visited: Set<string> = new Set(),
): boolean {
  if (!circuit) return false;
  if (visited.has(circuit.name)) return false;
  visited.add(circuit.name);

  if (circuit.clocks?.length > 0) return true;
  if (circuit.state?.length > 0) return true;

  for (const node of circuit.nodes) {
    const sub = resolveCircuit(node.componentRef);
    if (sub && isSequentialCircuit(sub, resolveCircuit, visited)) return true;
  }

  return false;
}
