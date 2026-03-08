"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { TPU_CIRCUITS } from "../circuits";

export function PESection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The Processing Element
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The <strong className="text-white">processing element</strong> (PE) is
          the fundamental building block of a systolic array. It combines
          everything we&rsquo;ve seen so far: a weight register with valid-bit
          gating, a data pipeline register, and a MAC accumulator &mdash; all in
          one unit.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The workflow is straightforward. First, load a weight: set{" "}
          <code className="text-blue-300">weightValid</code> on and tick once.
          The weight register captures the value. Then turn valid off and start
          streaming data values through{" "}
          <code className="text-blue-300">dataIn</code>. Each clock tick, the PE
          multiplies the incoming data by the stored weight and adds it to its
          accumulator. The data flows out through{" "}
          <code className="text-blue-300">dataOut</code> with a one-cycle delay,
          ready to feed the next PE in the row.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle <code className="text-blue-300">resetAccum</code> to clear the
          accumulated result back to zero. This is how the systolic array resets
          between matrix multiplications.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.processingElement.dsl}
          displayDsl={TPU_CIRCUITS.processingElement.displayDsl}
          nodePositions={TPU_CIRCUITS.processingElement.nodePositions}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Processing Element"
          description="Load a weight (set valid, tick), then stream data through to accumulate."
        />
      </div>
    </section>
  );
}
