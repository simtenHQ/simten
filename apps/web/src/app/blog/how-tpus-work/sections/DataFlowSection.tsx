"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { TPU_CIRCUITS } from "../circuits";

export function DataFlowSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Systolic Data Flow
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The word &ldquo;systolic&rdquo; comes from the Greek word for the
          heart&rsquo;s rhythmic contraction. In a systolic array, data pulses
          through a grid of processing elements like blood through arteries
          &mdash; each element receives data, processes it, and passes it along
          in lockstep with the clock.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Here we connect two PEs{" "}
          <strong className="text-white">horizontally</strong>. Data enters
          PE0&rsquo;s <code className="text-blue-300">dataIn</code> from the
          left. After one clock cycle, PE0 outputs the data from its pipeline
          register, which feeds directly into PE1&rsquo;s{" "}
          <code className="text-blue-300">dataIn</code>. Each PE has its own
          weight, so the same activation data gets multiplied by different
          weights as it flows across the row.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Load weights into both PEs (toggle{" "}
          <code className="text-blue-300">valid0</code> and{" "}
          <code className="text-blue-300">valid1</code>, tick, then toggle off).
          Now tick repeatedly to watch the data flow from left to right. PE0
          accumulates <code className="text-blue-300">data &times; weight0</code>
          , while PE1 accumulates{" "}
          <code className="text-blue-300">data &times; weight1</code> &mdash;
          one cycle behind.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.twoPERow.dsl}
          displayDsl={TPU_CIRCUITS.twoPERow.displayDsl}
          nodePositions={TPU_CIRCUITS.twoPERow.nodePositions}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Two-PE Row"
          description="Data flows left to right. Each PE multiplies by its own stored weight."
        />
      </div>
    </section>
  );
}
