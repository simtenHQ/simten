"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { TPU_CIRCUITS } from "../circuits";

export function MACSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Multiply and Accumulate
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Every neural network inference boils down to one operation:{" "}
          <strong className="text-white">multiply and accumulate</strong> (MAC).
          Take two numbers, multiply them together, and add the product to a
          running total. That&rsquo;s a dot product, one element at a time. Do it
          across millions of weights and activations, and you get a matrix
          multiply &mdash; the heartbeat of deep learning.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The circuit below is the simplest possible MAC unit. Two inputs{" "}
          <code className="text-blue-300">a</code> and{" "}
          <code className="text-blue-300">b</code> feed a multiplier. The product
          is added to an accumulator register that feeds back into the adder.
          Each clock tick, the register grows by{" "}
          <code className="text-blue-300">a &times; b</code>. Toggle the reset
          switch to clear the accumulator back to zero.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Try changing the input values, then click <strong>Tick</strong>{" "}
          repeatedly to watch the accumulator grow. This single MAC unit is the
          atom from which we&rsquo;ll build a full systolic array.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.simpleMACUnit.dsl}
          displayDsl={TPU_CIRCUITS.simpleMACUnit.displayDsl}
          height={350}
          showControls
          autoRunSpeed={400}
          title="Simple MAC Unit"
          description="Multiply a × b and accumulate into a register. Toggle reset to clear."
        />
      </div>
    </section>
  );
}
