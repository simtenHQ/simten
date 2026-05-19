import { CircuitEmbed } from "@simten/embed";
import { ADDER_CIRCUITS } from "../circuits";
import { TruthTable } from "@/components/TruthTable";

export function FullAdderSection() {
  const entry = ADDER_CIRCUITS.fullAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Handling carry-in: the full adder
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose */}
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
          Try all eight input combinations &mdash; the result is the binary
          encoding of how many of the three inputs are 1.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={false}
          title={entry.name}
          description={entry.description}
        />
      </div>

      <div className="mt-8">
        <TruthTable
          title="Full adder truth table"
          columns={[
            { name: "a", group: "input" },
            { name: "b", group: "input" },
            { name: "cin", group: "input" },
            { name: "sum", group: "output" },
            { name: "cout", group: "output" },
          ]}
          rows={[
            [0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 1, 0],
            [0, 1, 1, 0, 1],
            [1, 0, 0, 1, 0],
            [1, 0, 1, 0, 1],
            [1, 1, 0, 0, 1],
            [1, 1, 1, 1, 1],
          ]}
        />
      </div>
    </section>
  );
}
