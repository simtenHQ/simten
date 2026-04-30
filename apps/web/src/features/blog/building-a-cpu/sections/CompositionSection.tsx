
import { CircuitEmbed } from "@simten/embed";
import { GATE_CIRCUITS } from "../circuits";

export function CompositionSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Composition: Building Arithmetic
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Now for the magic trick of digital design:{" "}
          <strong className="text-gray-900 dark:text-white">composition</strong>. We take the gates
          we just built and wire them together into bigger circuits. Those bigger
          circuits become building blocks for even bigger ones.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Let&rsquo;s build an adder &mdash; the circuit that lets a CPU do
          math.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* Half Adder */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Half Adder
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Adds two single bits. The <strong>sum</strong> output is the XOR
            (are the bits different?), and the <strong>carry</strong> output is
            the AND (are both bits 1?). Try it: 1+1 = 10 in binary &mdash; sum
            is 0, carry is 1.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.halfAdder.circuit}
            height={260}
            title="Half Adder"
            description="Adds two bits: produces sum and carry"
          />
        </div>

        {/* Full Adder */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Full Adder
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The real workhorse. A full adder handles three inputs: A, B, and a{" "}
            <strong>carry-in</strong> from the previous column. Chain 8 of
            these together and you can add two bytes. Chain 32 and you have the
            adder in a modern CPU.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.fullAdder.circuit}
            height={300}
            title="Full Adder"
            description="Adds three bits: a, b, and carry-in"
          />
        </div>

        {/* Multiplexer */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Multiplexer
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            A data selector: the <strong>sel</strong> switch chooses which input
            (A or B) passes through to the output. Muxes are everywhere in
            CPUs &mdash; they&rsquo;re how the control unit routes data between
            components.
          </p>
          <CircuitEmbed
            circuit={GATE_CIRCUITS.mux.circuit}
            height={280}
            title="2:1 Multiplexer"
            description="sel=OFF picks A, sel=ON picks B"
          />
        </div>
      </div>
    </section>
  );
}
