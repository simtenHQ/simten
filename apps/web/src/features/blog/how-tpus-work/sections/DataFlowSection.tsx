
import { CircuitEmbed } from "@simten/embed";
import { TPU_CIRCUITS } from "../circuits";

export function DataFlowSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Horizontal Data Flow
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The word &ldquo;systolic&rdquo; comes from the Greek word for the
          heart&rsquo;s rhythmic contraction. In a systolic array, data pulses
          through a grid of processing elements like blood through arteries
          &mdash; each element receives data, processes it, and passes it along
          in lockstep with the clock.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Here we connect two PEs{" "}
          <strong className="text-gray-900 dark:text-white">horizontally</strong>. Data enters
          PE0&rsquo;s <code className="text-blue-300">dataIn</code> from the
          left. After one clock cycle, PE0&rsquo;s pipeline register outputs the
          data, which feeds directly into PE1&rsquo;s{" "}
          <code className="text-blue-300">dataIn</code>. Each PE has its own
          stored weight, so the same activation value gets multiplied by
          different weights as it flows across the row.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Both PEs have{" "}
          <code className="text-blue-300">partialSumIn = 0</code> here because
          vertical flow hasn&rsquo;t been introduced yet. Each PE independently
          computes{" "}
          <code className="text-blue-300">0 + data &times; weight</code>.
          Load weights into both PEs (toggle{" "}
          <code className="text-blue-300">weightValid</code> on, tick, then
          toggle off). Now tick repeatedly to watch data flow from left to right.
          PE0 shows <code className="text-blue-300">data &times; weight0</code>,
          while PE1 shows{" "}
          <code className="text-blue-300">data &times; weight1</code> &mdash;
          one cycle behind.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={TPU_CIRCUITS.twoPERow.circuit}
          nodePositions={TPU_CIRCUITS.twoPERow.nodePositions}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Two-PE Row"
          description="Data flows left to right with a one-cycle delay. Each PE multiplies by its own weight."
        />
      </div>
    </section>
  );
}
