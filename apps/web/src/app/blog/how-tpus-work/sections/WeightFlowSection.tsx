"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { TPU_CIRCUITS } from "../circuits";

export function WeightFlowSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Vertical Partial-Sum Flow
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Data flows horizontally, but partial sums flow{" "}
          <strong className="text-white">vertically</strong>. Here we stack two
          PEs in a column. The top PE receives{" "}
          <code className="text-blue-300">partialSumIn = 0</code> and computes{" "}
          <code className="text-blue-300">0 + data &times; weight0</code>. This
          partial sum output feeds directly into the bottom PE&rsquo;s{" "}
          <code className="text-blue-300">partialSumIn</code>. The bottom PE
          computes{" "}
          <code className="text-blue-300">
            (data &times; weight0) + data &times; weight1
          </code>{" "}
          &mdash; the full dot product of the data value with both weights in
          this column.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This vertical flow is{" "}
          <strong className="text-white">combinational</strong> &mdash; both PE
          outputs settle in the same clock cycle. No extra register delay, no
          extra latency. This is the key insight of the weight-stationary
          systolic architecture: horizontal data flow is{" "}
          <em>registered</em> (one cycle per PE), but vertical partial-sum flow
          is <em>combinational</em> (an entire column settles in one cycle).
        </p>
        <p className="text-gray-300 leading-relaxed">
          In a real TPUv1 with 256 rows, a single activation value entering a
          column has its contribution added to the partial sum all the way down
          in one cycle &mdash; 256 multiply-adds in a combinational cascade.
          Load weights (toggle{" "}
          <code className="text-blue-300">weightValid</code> on, tick, toggle
          off), then change{" "}
          <code className="text-blue-300">dataIn</code> to see both results
          update instantly.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.twoPEColumn.dsl}
          displayDsl={TPU_CIRCUITS.twoPEColumn.displayDsl}
          nodePositions={TPU_CIRCUITS.twoPEColumn.nodePositions}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Two-PE Column"
          description="Partial sums cascade from top to bottom combinationally — no extra clock cycles."
        />
      </div>
    </section>
  );
}
