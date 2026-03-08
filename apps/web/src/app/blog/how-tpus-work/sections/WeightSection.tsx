"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { TPU_CIRCUITS } from "../circuits";

export function WeightSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">Loading Weights</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          In a TPU, weights are loaded <em>before</em> data starts flowing. Each
          processing element has a{" "}
          <strong className="text-white">weight register</strong> that captures a
          value only when a{" "}
          <strong className="text-white">valid bit</strong> is asserted. This
          gating mechanism means the weight stays fixed while activation data
          streams through on every clock cycle.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Alongside the weight register sits a{" "}
          <strong className="text-white">pipeline register</strong> that passes
          the incoming weight through unchanged. This is how weights flow
          vertically from one row of PEs to the next &mdash; the top PE captures
          its weight and simultaneously forwards the value downward for the next
          PE to capture on the following cycle.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle the <code className="text-blue-300">weightValid</code> switch
          on, then click <strong>Tick</strong>. The stored weight display latches
          the value. Turn valid off and tick again &mdash; the stored weight
          stays put while the pass-through register keeps forwarding.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.weightLoader.dsl}
          displayDsl={TPU_CIRCUITS.weightLoader.displayDsl}
          nodePositions={TPU_CIRCUITS.weightLoader.nodePositions}
          height={350}
          showControls
          autoRunSpeed={400}
          title="Weight Loader"
          description="Toggle valid to store the weight. The pipeline register always forwards."
        />
      </div>
    </section>
  );
}
