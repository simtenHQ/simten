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
import {
  CircuitEmbed,
  CircuitCanvas,
  useCircuitSimulator,
} from "@simten/embed";
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
 * Tier 4 demo: the hook and the canvas composed directly. No
 * CircuitEmbed in this tree — the section owns the sim and renders
 * the canvas with whatever chrome it wants (here, a minimal rounded
 * border to keep the example visually parseable).
 */
export function Tier4FullComposition() {
  const sim = useCircuitSimulator(HalfAdder, { autoHarness: true });
  const activeRow = computeActiveRow(sim.portValues, HA_COLUMNS, HA_ROWS);

  return (
    <div className="my-6 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div
          className="rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] overflow-hidden"
          style={{ height: 320 }}
        >
          {sim.error ? (
            <div className="flex items-center justify-center h-full p-4 text-sm text-red-400">
              {sim.error}
            </div>
          ) : !sim.ready ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
              Compiling…
            </div>
          ) : (
            <CircuitCanvas
              circuit={sim.circuit}
              componentLibrary={sim.componentLibrary ?? undefined}
              portValues={sim.portValues}
              sequentialState={sim.sequentialState}
              onToggleNode={sim.toggleNode}
              onSetNodeValue={sim.setNodeValue}
              height={320}
            />
          )}
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
