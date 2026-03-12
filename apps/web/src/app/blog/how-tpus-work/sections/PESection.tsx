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
          everything we&rsquo;ve seen so far into one unit with four parts:
        </p>
        <ol className="text-gray-300 leading-relaxed list-decimal list-inside space-y-2">
          <li>
            A <strong className="text-white">weight register</strong> that
            latches a weight when the valid signal is high.
          </li>
          <li>
            A <strong className="text-white">multiplier</strong> that computes{" "}
            <code className="text-blue-300">dataIn &times; storedWeight</code>.
          </li>
          <li>
            A <strong className="text-white">combinational adder</strong> that
            produces{" "}
            <code className="text-blue-300">
              partialSumIn + product = partialSumOut
            </code>{" "}
            &mdash; no register, the result appears instantly.
          </li>
          <li>
            A <strong className="text-white">data pipeline register</strong>{" "}
            that delays{" "}
            <code className="text-blue-300">dataIn</code> by one clock cycle to
            produce <code className="text-blue-300">dataOut</code>, feeding the
            next PE in the row.
          </li>
        </ol>
        <p className="text-gray-300 leading-relaxed">
          The key insight is that{" "}
          <code className="text-blue-300">partialSumOut</code> is{" "}
          <em>combinational</em> &mdash; it settles immediately, with no clock
          delay. This is what allows partial sums to flow through an entire
          column of PEs within a single clock cycle.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Load a weight: toggle{" "}
          <code className="text-blue-300">weightValid</code> on and tick once.
          Then turn valid off and start changing{" "}
          <code className="text-blue-300">dataIn</code>. Watch{" "}
          <code className="text-blue-300">partialSumOut</code> update instantly
          as the multiplier and adder recompute. The{" "}
          <code className="text-blue-300">dataOut</code> display shows the data
          value delayed by one cycle, ready to feed the next PE.
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
          title="Processing Element (PE_Systolic)"
          description="Load a weight (set valid, tick), then change data to see combinational partial-sum output."
        />
      </div>
    </section>
  );
}
