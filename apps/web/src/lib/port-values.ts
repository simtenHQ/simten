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
 * The map is keyed by `<nodeId>.<portName>`. For an auto-harnessed
 * circuit (`useCircuitSimulator(c, { autoHarness: true })`):
 *   - Input port `a`  → Switch node `a`, output value at `a.out`
 *   - Output port `s` → Led/HexDisplay node `s`, equivalent values at
 *                       `dut.s` (the original circuit's output port)
 *                       and `s.in` (the Led's input port)
 * Non-harnessed top-level ports use `__top__.<name>`.
 */

export type PortValuesMap = ReadonlyMap<string, number | boolean | bigint>;

/**
 * Pull a single-bit value for a named port out of the live port-values
 * map. Tries every shape the harness and the simulator produce, in the
 * order most-likely-to-hit-first. Returns null if no candidate matches
 * (sim not yet ready, port name doesn't exist, etc.).
 */
export function readPortBit(
  portValues: PortValuesMap | null | undefined,
  portName: string,
): number | null {
  if (!portValues) return null;
  const candidates = [
    `${portName}.out`, // Switch node wrapping an input
    `dut.${portName}`, // DUT's own output port (auto-harness)
    `${portName}.in`, // Led/HexDisplay node consuming an output (auto-harness)
    `__top__.${portName}`, // top-level port (non-harness)
    portName, // bare last-resort
  ];
  for (const key of candidates) {
    const v = portValues.get(key);
    if (v === undefined) continue;
    return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) & 1;
  }
  return null;
}
