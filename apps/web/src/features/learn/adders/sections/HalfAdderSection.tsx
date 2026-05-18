import { CircuitEmbed } from "@simten/embed";
import { ADDER_CIRCUITS } from "../circuits";

export function HalfAdderSection() {
  const entry = ADDER_CIRCUITS.halfAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The half adder
      </h2>
      <div className="prose-invert space-y-6">
        {/* TODO: prose */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The smallest possible adder takes two bits and produces two bits: a{" "}
          <strong>sum</strong> and a <strong>carry</strong>. Truth-table it and
          there are exactly four cases &mdash; the sum is 1 when exactly one
          input is 1 (the definition of XOR), and the carry is 1 only when
          both inputs are 1 (the definition of AND).
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Toggle the two switches below. The first LED is the sum bit, the
          second is the carry. Watch all four combinations to see the truth
          table play out.
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
    </section>
  );
}
