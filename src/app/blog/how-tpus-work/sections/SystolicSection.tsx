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
        The Full 2&times;2 Systolic Array
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; MAC units, weight loading,
          horizontal data flow, vertical weight distribution, and wavefront
          control &mdash; comes together here. Four processing elements are
          arranged in a 2&times;2 grid. Weights flow down the columns. Data
          flows across the rows. The wavefront controller orchestrates the
          entire computation.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The circuit computes C = A &times; B where A&nbsp;=&nbsp;
          <code className="text-blue-300">[[1,2],[3,4]]</code> and B&nbsp;=&nbsp;
          <code className="text-blue-300">[[5,6],[7,8]]</code>. The expected
          result is C&nbsp;=&nbsp;
          <code className="text-blue-300">[[19,22],[43,50]]</code>. Click{" "}
          <strong>Start</strong> to toggle the start signal and begin
          auto-running. Watch the wavefront propagate through the phases:
          reset, load first weights + stream first activations, load second
          weights + stream second activations, done.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is the same fundamental architecture that powers Google&rsquo;s
          TPU. A real TPUv1 has a 256&times;256 systolic array &mdash; 65,536
          processing elements performing 92 trillion 8-bit operations per
          second. The principles are identical: data flows right, weights flow
          down, and every PE computes a MAC on every clock cycle.
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
          computes the matrix product in a carefully choreographed wavefront,
          and the result feeds into the next layer. Repeat for every layer in
          the network.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The systolic design is powerful because it maximizes data reuse. Each
          activation value is read once from memory and used by every PE in its
          row. Each weight is read once and used by every PE in its column.
          This dramatically reduces memory bandwidth &mdash; the bottleneck
          that limits GPU performance on large language models.
        </p>
      </div>
    </section>
  );
}
