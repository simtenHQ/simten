import { useState } from "react";
import { CircuitEmbed } from "@simten/embed";
import type { FlatPortValueMap } from "@simten/core/simulator";
import { FullAdder } from "../circuits";
import { TruthTable, computeActiveRow } from "@/components/TruthTable";

const FA_COLUMNS = [
  { name: "a", group: "input" as const },
  { name: "b", group: "input" as const },
  { name: "cin", group: "input" as const },
  { name: "sum", group: "output" as const },
  { name: "cout", group: "output" as const },
];

const FA_ROWS: Array<Array<number | string>> = [
  [0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0],
  [0, 1, 0, 1, 0],
  [0, 1, 1, 0, 1],
  [1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1],
  [1, 1, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

export function FullAdderSection() {
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);

  const activeRow = computeActiveRow(portValues, FA_COLUMNS, FA_ROWS);

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Handling carry-in: the full adder
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A half adder is enough to add a single bit, but the moment you want
          to add multi-bit numbers, you need a way to receive a carry from
          the stage below. That third input is called <strong>carry-in</strong>{" "}
          (<code>cin</code>), and an adder that handles all three inputs is
          called a <strong>full adder</strong>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The trick: a full adder is just two half-adders stacked. The first
          half-adder adds <code>a + b</code>; the second adds that partial sum
          to <code>cin</code>. Either half-adder can produce a carry, and the
          full adder's carry-out is the OR of both.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try all eight combinations &mdash; the result is the binary
          encoding of how many of the three inputs are 1.
        </p>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <CircuitEmbed
            circuit={FullAdder}
            title="Full adder"
            description="Adds three bits — a, b, and carry-in — to one sum bit and one carry-out."
            onPortValuesChange={setPortValues}
          />
        </div>
        <div className="shrink-0">
          <TruthTable
            title="Full adder truth table"
            columns={FA_COLUMNS}
            rows={FA_ROWS}
            highlightRow={activeRow}
          />
        </div>
      </div>
    </section>
  );
}
