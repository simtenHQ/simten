/**
 * Helpers for reading values out of a simulator's port-values map.
 *
 * Shared between TruthTable's row-highlight logic (which only ever
 * reads input bits) and the docs/CustomCompositionDemo (which reads
 * both inputs and outputs). Lives here so the candidate-key list stays
 * a single source of truth; historically the two consumers had
 * separate copies that drifted (the truth-table version was missing
 * the output-side candidates, which broke when anyone tried to read
 * outputs through it).
 *
 * The map is keyed by `<nodeId>.<portName>`. A circuit's own ports are under
 * `__top__` (`__top__.a`). A circuit without ports is read off its own nodes:
 * a Switch `a` at `a.out`, a lamp `s` at `s.in`.
 */

export type PortValuesMap = ReadonlyMap<string, number | boolean | bigint>;

/**
 * Pull a single-bit value for a named port out of the live port-values
 * map: the circuit's own port first, then a Switch or lamp of that name. Returns null if no candidate matches
 * (sim not yet ready, port name doesn't exist, etc.).
 */
export function readPortBit(
  portValues: PortValuesMap | null | undefined,
  portName: string,
): number | null {
  if (!portValues) return null;
  const candidates = [
    `__top__.${portName}`, // the circuit's own port
    `${portName}.out`, // a Switch node
    `${portName}.in`, // a Led or display node
    portName, // bare last-resort
  ];
  for (const key of candidates) {
    const v = portValues.get(key);
    if (v === undefined) continue;
    return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) & 1;
  }
  return null;
}
