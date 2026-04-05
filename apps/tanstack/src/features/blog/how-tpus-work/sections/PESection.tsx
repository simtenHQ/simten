"use client";

import { ComponentEmbed } from "@turing-incomplete/embed";
import { TPU_CIRCUITS } from "../circuits";

export function PESection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Processing Element
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The <strong className="text-gray-900 dark:text-white">processing element</strong> (PE) is
          the fundamental building block of a systolic array. It combines
          everything we&rsquo;ve seen so far into one unit with four parts:
        </p>
        <ol className="text-gray-600 dark:text-gray-300 leading-relaxed list-decimal list-inside space-y-2">
          <li>
            A <strong className="text-gray-900 dark:text-white">weight register</strong> that
            latches a weight when the valid signal is high.
          </li>
          <li>
            A <strong className="text-gray-900 dark:text-white">multiplier</strong> that computes{" "}
            <code className="text-blue-300">dataIn &times; storedWeight</code>.
          </li>
          <li>
            A <strong className="text-gray-900 dark:text-white">registered adder</strong> that
            computes{" "}
            <code className="text-blue-300">
              partialSumIn + product
            </code>{" "}
            and latches the result into a register &mdash;{" "}
            <code className="text-blue-300">partialSumOut</code> appears one
            clock cycle later.
          </li>
          <li>
            A <strong className="text-gray-900 dark:text-white">data pipeline register</strong>{" "}
            that delays{" "}
            <code className="text-blue-300">dataIn</code> by one clock cycle to
            produce <code className="text-blue-300">dataOut</code>, feeding the
            next PE in the row.
          </li>
        </ol>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Both <code className="text-blue-300">partialSumOut</code> and{" "}
          <code className="text-blue-300">dataOut</code> are{" "}
          <em>registered</em> &mdash; each takes one clock cycle. Data moves
          right one PE per cycle, and partial sums move down one PE per cycle.
          This symmetry is what makes the systolic array&rsquo;s timing work:
          both directions have the same latency per hop.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Load a weight: toggle{" "}
          <code className="text-blue-300">weightValid</code> on and tick once.
          Then turn valid off and tick again. Watch{" "}
          <code className="text-blue-300">partialSumOut</code> update after the
          tick &mdash; it&rsquo;s registered, not instant. The{" "}
          <code className="text-blue-300">dataOut</code> display shows the data
          value delayed by one cycle, ready to feed the next PE.
        </p>
      </div>

      <div className="mt-8">
        <ComponentEmbed
          code={TPU_CIRCUITS.processingElement.dsl}
          displayCode={TPU_CIRCUITS.processingElement.displayCode}
          nodePositions={TPU_CIRCUITS.processingElement.nodePositions}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Processing Element (PE_Systolic)"
          description="Load a weight (set valid, tick), then tick again to see registered partial-sum output."
        />
      </div>
    </section>
  );
}
