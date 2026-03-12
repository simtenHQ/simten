"use client";

import dynamic from "next/dynamic";

const SystolicDemo = dynamic(
  () =>
    import("../SystolicDemo").then((m) => ({ default: m.SystolicDemo })),
  {
    loading: () => (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span>Loading systolic array simulator...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function SystolicSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The Full 3&times;3 Systolic Array
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; multiply-add units, weight
          registers, horizontal data pipelines, vertical partial-sum
          accumulation, and cycle control &mdash; comes together here. Nine
          processing elements are arranged in a 3&times;3 grid. Each PE stores
          one weight from matrix&nbsp;B. Activations from matrix&nbsp;A flow
          left to right through pipeline registers. Partial sums flow top to
          bottom combinationally through each column.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The circuit computes C = A &times; B where A&nbsp;=&nbsp;
          <code className="text-blue-300">[[1,2,3],[4,5,6],[7,8,9]]</code> and
          B&nbsp;=&nbsp;
          <code className="text-blue-300">[[2,0,1],[0,2,0],[1,0,2]]</code>. The
          expected result is C&nbsp;=&nbsp;
          <code className="text-blue-300">
            [[5,4,7],[14,10,16],[23,16,25]]
          </code>
          . Click <strong>Start</strong> to begin. Cycle&nbsp;0 loads all nine
          weights. Then over{" "}
          <strong className="text-white">5 cycles</strong> of pipelined data
          flow (2N&minus;1 for N=3), activation values ripple rightward through
          the rows while partial sums accumulate downward through the columns.
          After 6 total ticks the done signal fires.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is the same fundamental architecture that powers Google&rsquo;s
          TPU. A real TPUv1 has a 256&times;256 systolic array &mdash; 65,536
          processing elements performing 92 trillion 8-bit operations per
          second. The principles are identical: weights are loaded once and held
          stationary, activations flow right through pipeline registers, and
          partial sums accumulate combinationally down each column.
        </p>
      </div>

      <div className="mt-8">
        <SystolicDemo />
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          What you just watched is the same process that happens inside every
          TPU inference. Matrix A holds activations from the previous layer.
          Matrix B holds the model&rsquo;s trained weights. The systolic array
          computes the matrix product in a pipelined wavefront &mdash; weights
          are loaded once, then activations stream through at full speed. The
          result feeds into the next layer. Repeat for every layer in the
          network.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The systolic design is powerful because it maximizes data reuse. Each
          activation value is read once from memory and multiplied by every
          weight in its row as it flows rightward. Each weight is loaded once
          and used for every activation that passes through its PE over time.
          This dramatically reduces memory bandwidth &mdash; the bottleneck
          that limits GPU performance on large language models.
        </p>
      </div>
    </section>
  );
}
