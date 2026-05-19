import { CircuitEmbed } from "@simten/embed";
import { ABSTRACTION_CIRCUITS } from "../circuits";

export function TwoWaysSection() {
  const flat = ABSTRACTION_CIRCUITS.flatHalfAdder;
  const wrapped = ABSTRACTION_CIRCUITS.encapsulatedHalfAdder;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The same circuit, two ways
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A half adder is two gates &mdash; an XOR for the sum, an AND for
          the carry. The version below collapses those two gates into a
          single labeled <code>HalfAdder</code> node with the same external
          ports. Both produce identical outputs because they <em>are</em>{" "}
          the same circuit.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That collapse is abstraction. Nothing is hidden &mdash; the gates
          are still there, doing the same work &mdash; but once a structure
          has a name, you can stop thinking about its parts.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <CircuitEmbed
          circuit={flat.circuit}
          showControls={false}
          title={flat.name}
          description={flat.description}
        />
        <CircuitEmbed
          circuit={wrapped.circuit}
          showControls={false}
          title={wrapped.name}
          description={wrapped.description}
        />
      </div>
    </section>
  );
}
