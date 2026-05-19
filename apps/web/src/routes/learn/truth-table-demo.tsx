/**
 * Demo: dynamic truth table that follows the canvas.
 *
 * Composes useCircuitSimulator + CircuitCanvas + TruthTable manually
 * instead of using CircuitEmbed. Demonstrates that simten's primitive
 * API is composable — external sites can build their own visualizations
 * over a shared simulator instance without being locked into the canned
 * CircuitEmbed wrapper.
 *
 * The shared sim instance is the key: both the canvas and the truth
 * table read from the same `sim.portValues`, so toggling a switch in
 * the canvas updates the highlighted row in the table.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { circuit, bit } from "@simten/core/circuit";
import { And, Xor } from "@simten/core/std";
import { useCircuitSimulator, CircuitCanvas } from "@simten/embed";
import { TruthTable } from "@/components/TruthTable";
import { pageHead } from "@/lib/seo";

// ── The circuit under test ─────────────────────────────────────────────
// Defined inline so the demo is self-contained. Uses the autoHarness
// option below, which wraps the bare `a`/`b` inputs in Switch nodes and
// `sum`/`carry` outputs in LED nodes automatically — same affordances
// as a hand-wired demo wrapper, but without the boilerplate.

const HalfAdder = circuit("HalfAdder", {
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

// ── Truth-table data, ordered conventionally (a high bit, b low) ───────

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

// ── The composed component ─────────────────────────────────────────────

function TruthTableDemoPage() {
  const sim = useCircuitSimulator(HalfAdder, { autoHarness: true });

  // Log the portValues key structure on first ready so we can confirm
  // the naming convention. Will inform whether we read `a.out` or
  // `Switch_a.out` or something else.
  useEffect(() => {
    if (sim.ready && sim.portValues && sim.portValues.size > 0) {
      // eslint-disable-next-line no-console
      console.log(
        "[truth-table-demo] portValues keys:",
        Array.from(sim.portValues.keys()),
      );
    }
  }, [sim.ready, sim.portValues]);

  // Read the current a, b values from the live sim state. The harness
  // names its switches after the input port names by convention; if
  // that's wrong we'll see it in the console log above and adjust.
  const activeRow = useMemo(() => {
    if (!sim.portValues || sim.portValues.size === 0) return undefined;
    const a = readBit(sim.portValues, "a");
    const b = readBit(sim.portValues, "b");
    if (a === null || b === null) return undefined;
    // Row index = a (high bit) * 2 + b (low bit), matching HA_ROWS order.
    return (a << 1) | b;
  }, [sim.portValues]);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <section>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            Truth table demo (live)
          </h1>
          <p className="text-gray-500 dark:text-gray-300 leading-relaxed">
            Composes <code>useCircuitSimulator</code> +{" "}
            <code>CircuitCanvas</code> + <code>TruthTable</code> manually,
            sharing one simulator instance between the canvas and the
            table. Toggle the switches on the canvas; the highlighted row
            in the table updates to match.
          </p>
        </section>

        <div className="rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] overflow-hidden">
          <div
            className="min-h-0"
            style={{ height: 360 }}
          >
            {sim.error ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">
                  <div className="font-medium mb-1">Compilation error</div>
                  <div className="font-mono text-xs">{sim.error}</div>
                </div>
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
                height={360}
              />
            )}
          </div>
        </div>

        <TruthTable
          title="Half adder truth table"
          caption="The highlighted row matches the current switch state above."
          columns={HA_COLUMNS}
          rows={HA_ROWS}
          highlightRow={activeRow}
        />
      </main>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Pull a single-bit value out of the live port-values map by port name.
 * Tries a couple of likely key shapes; returns null if none match so the
 * caller can fall back gracefully (e.g. before the sim is ready).
 */
function readBit(
  portValues: ReadonlyMap<string, number | boolean | bigint>,
  portName: string,
): number | null {
  const candidates = [
    `${portName}.out`, // auto-harness Switch named after the input port
    `__top__.${portName}`, // top-level input value (less likely)
    portName, // bare key (least likely)
  ];
  for (const key of candidates) {
    const v = portValues.get(key);
    if (v === undefined) continue;
    return typeof v === "boolean" ? (v ? 1 : 0) : Number(v) & 1;
  }
  return null;
}

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute("/learn/truth-table-demo")({
  head: () =>
    pageHead({
      title: "Truth table demo",
      description:
        "Live composition of useCircuitSimulator + CircuitCanvas + TruthTable, sharing one simulator instance.",
      path: "/learn/truth-table-demo",
    }),
  component: TruthTableDemoPage,
});
