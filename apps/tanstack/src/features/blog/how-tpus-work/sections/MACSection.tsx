"use client";

import { ComponentEmbed } from "@turing-incomplete/embed";
import { TPU_CIRCUITS } from "../circuits";

export function MACSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Multiply and Add
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Every neural network inference boils down to one operation:{" "}
          <strong className="text-gray-900 dark:text-white">multiply and add</strong>. Take an
          incoming partial sum, multiply a data value by a weight, and add the
          product to the partial sum. That&rsquo;s one step of a dot product. Do
          it across millions of weights and activations, and you get a matrix
          multiply &mdash; the heartbeat of deep learning.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit below is purely combinational &mdash; no clock, no
          registers, no state. Three inputs feed the calculation:{" "}
          <code className="text-blue-300">data</code>,{" "}
          <code className="text-blue-300">weight</code>, and{" "}
          <code className="text-blue-300">partialSumIn</code>. The multiplier
          computes <code className="text-blue-300">data &times; weight</code>,
          and the adder produces{" "}
          <code className="text-blue-300">
            partialSumIn + data &times; weight
          </code>
          . The result appears instantly.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing the input values and watch the result update. This single
          multiply-add is the atom from which we&rsquo;ll build a full systolic
          array. Accumulation doesn&rsquo;t happen inside a single unit &mdash;
          it happens by <em>chaining</em> units together, passing each
          one&rsquo;s partial sum output into the next one&rsquo;s input.
        </p>
      </div>

      <div className="mt-8">
        <ComponentEmbed
          code={TPU_CIRCUITS.multiplyAdd.dsl}
          displayCode={TPU_CIRCUITS.multiplyAdd.displayCode}
          nodePositions={TPU_CIRCUITS.multiplyAdd.nodePositions}
          height={300}
          showControls
          title="Multiply-Add Unit"
          description="partialSumIn + (data × weight) = result. Purely combinational — no clock needed."
        />
      </div>
    </section>
  );
}
