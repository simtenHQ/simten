import { CircuitEmbed } from "@simten/embed";
import { ABSTRACTION_CIRCUITS } from "../circuits";

export function ScalingSection() {
  const entry = ABSTRACTION_CIRCUITS.eightBitAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Why this scales
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Once full adders have a name, building an 8-bit adder is eight
          nodes chained tail-to-head &mdash; each stage&rsquo;s carry-out
          feeding the next stage&rsquo;s carry-in. The flat equivalent
          would have 40+ gates with criss-crossing carry wires. Same
          behavior, but you couldn&rsquo;t glance at it and see
          &ldquo;eight adders in a chain.&rdquo;
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is why hardware design works the way it does. Every CPU you
          have ever used is, at the gate level, hundreds of millions of
          standard cells. Nobody designs CPUs by drawing them. They
          describe <code>FullAdder</code>, then <code>Adder</code>, then{" "}
          <code>ALU</code>, then <code>Datapath</code>, then{" "}
          <code>Core</code> &mdash; and at each level, the previous level
          is &ldquo;a node with a name.&rdquo; (Real production CPUs use
          parallel-prefix adders, not ripple-carry, for speed &mdash; see{" "}
          <a
            href="/learn/adders"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            /learn/adders
          </a>{" "}
          for why and what they use instead.)
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
