/**
 * Live interactive demo used by /docs/building-custom-uis to illustrate
 * tier 2 (CircuitEmbed + onPortValuesChange) and tier 4 (full composition
 * via useCircuitSimulator + CircuitCanvas).
 *
 * Self-contained — defines its own HalfAdder, doesn't rely on any
 * /learn-page modules. Keeps the docs page reproducible in isolation.
 */

import { useState } from "react";
import { circuit, bit } from "@simten/core/circuit";
import { And, Xor } from "@simten/core/std";
import type { FlatPortValueMap } from "@simten/core/simulator";
import { CircuitEmbed, useCircuitSimulator } from "@simten/embed";
import { TruthTable, computeActiveRow } from "@/components/TruthTable";

const HalfAdder = circuit("HalfAdderDocsDemo", {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xorGate: Xor, andGate: And },
  connect: ({ inputs, outputs, nodes: { xorGate, andGate } }) => [
    inputs.a.to(xorGate.a, andGate.a),
    inputs.b.to(xorGate.b, andGate.b),
    xorGate.out.to(outputs.sum),
    andGate.out.to(outputs.carry),
  ],
});

const HA_COLUMNS = [
  { name: "a", group: "input" as const },
  { name: "b", group: "input" as const },
  { name: "sum", group: "output" as const },
  { name: "carry", group: "output" as const },
];

const HA_ROWS: Array<Array<number | string>> = [
  [0, 0, 0, 0],
  [0, 1, 1, 0],
  [1, 0, 1, 0],
  [1, 1, 0, 1],
];

/**
 * Tier 2 demo: <CircuitEmbed> with the onPortValuesChange callback
 * driving a sibling TruthTable. The embed keeps its canned chrome; the
 * table follows live switch state via the callback.
 */
export function Tier2EmbedWithCallback() {
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);
  const activeRow = computeActiveRow(portValues, HA_COLUMNS, HA_ROWS);

  return (
    <div className="my-6 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0">
        <CircuitEmbed
          circuit={HalfAdder}
          title="Half adder"
          description="Toggle the switches — the truth table row follows."
          onPortValuesChange={setPortValues}
        />
      </div>
      <div className="shrink-0">
        <TruthTable
          title="Half adder truth table"
          columns={HA_COLUMNS}
          rows={HA_ROWS}
          highlightRow={activeRow}
        />
      </div>
    </div>
  );
}

/**
 * Tier 4 demo: deliberately *no* CircuitCanvas. Renders the same
 * HalfAdder circuit, but the frontend is custom toggle buttons +
 * styled LED indicators + the truth table. Same sim, completely
 * different UI — shows that the canvas is optional; the simulator
 * is just an engine you can build any visualization on top of.
 *
 * Mirrors the Snake demo in miniature: circuit = engine, React =
 * frontend.
 */
export function Tier4FullComposition() {
  const sim = useCircuitSimulator(HalfAdder, { autoHarness: true });
  const a = readPortBit(sim.portValues, "a");
  const b = readPortBit(sim.portValues, "b");
  const sum = readPortBit(sim.portValues, "sum");
  const carry = readPortBit(sim.portValues, "carry");
  const activeRow = computeActiveRow(sim.portValues, HA_COLUMNS, HA_ROWS);

  return (
    <div className="my-6 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] p-6">
          <div className="flex flex-wrap items-end justify-around gap-6">
            <ToggleControl
              label="a"
              value={a ?? 0}
              onToggle={() => sim.setNodeValue("a", a ? 0 : 1)}
            />
            <ToggleControl
              label="b"
              value={b ?? 0}
              onToggle={() => sim.setNodeValue("b", b ? 0 : 1)}
            />
            <LedReadout label="sum" lit={sum === 1} />
            <LedReadout label="carry" lit={carry === 1} />
          </div>
          <p className="mt-6 text-xs text-[var(--embed-text-muted)] text-center">
            No canvas. The simulator is driving the LEDs directly via the
            same <code>portValues</code> map; <code>setNodeValue</code>
            writes the toggles back.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <TruthTable
          title="Half adder truth table"
          columns={HA_COLUMNS}
          rows={HA_ROWS}
          highlightRow={activeRow}
        />
      </div>
    </div>
  );
}

function ToggleControl({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: number;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-wide text-[var(--embed-text-secondary)]">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={value === 1}
        className={
          "w-16 h-9 rounded-full px-1 flex items-center transition-colors " +
          (value === 1
            ? "bg-blue-500/70 justify-end"
            : "bg-[var(--embed-bg-tertiary)] justify-start")
        }
      >
        <span className="w-7 h-7 rounded-full bg-white shadow" />
      </button>
      <span className="text-xs font-mono text-[var(--embed-text-muted)]">
        {value === 1 ? "1" : "0"}
      </span>
    </div>
  );
}

function LedReadout({ label, lit }: { label: string; lit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-wide text-[var(--embed-text-secondary)]">
        {label}
      </span>
      <div
        className={
          "w-9 h-9 rounded-full transition-all " +
          (lit
            ? "bg-blue-400 ring-4 ring-blue-400/30 shadow-[0_0_12px_rgba(96,165,250,0.6)]"
            : "bg-[var(--embed-bg-tertiary)] ring-1 ring-inset ring-[var(--embed-border)]")
        }
      />
      <span className="text-xs font-mono text-[var(--embed-text-muted)]">
        {lit ? "1" : "0"}
      </span>
    </div>
  );
}

/**
 * Pull a single-bit value out of the live port-values map by port name.
 * Tries every shape the auto-harness produces:
 *   - `<port>.out`  — Switch node wrapping an input (id matches port name)
 *   - `dut.<port>`  — value coming out of the original (DUT) circuit's
 *                    output port, before it reaches the Led
 *   - `<port>.in`   — Led node consuming the output (id matches port name)
 *   - `__top__.<port>` and bare `<port>` for non-harness layouts
 * Returns null if no candidate matches.
 */
function readPortBit(
  portValues: ReadonlyMap<string, number | boolean | bigint> | null | undefined,
  portName: string,
): number | null {
  if (!portValues) return null;
  const candidates = [
    `${portName}.out`,
    `dut.${portName}`,
    `${portName}.in`,
    `__top__.${portName}`,
    portName,
  ];
  for (const key of candidates) {
    const v = portValues.get(key);
    if (v === undefined) continue;
    return typeof v === "boolean" ? (v ? 1 : 0) : Number(v) & 1;
  }
  return null;
}
