"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { TPU_CIRCUITS } from "../circuits";

export function WeightFlowSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Vertical Weight Flow
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Data flows horizontally, but weights flow{" "}
          <strong className="text-white">vertically</strong>. Here we stack two
          PEs in a column. A single weight value enters the top PE along with a
          valid signal. The top PE captures the weight in its weight register and
          simultaneously forwards the weight downward through its pipeline
          register. One cycle later, the bottom PE sees the weight and the
          delayed valid signal, and stores its own copy.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This cascading mechanism is elegant because it requires{" "}
          <strong className="text-white">no central controller</strong> for
          weight distribution. The valid bit{" "}
          <em>is</em> the control signal &mdash; it propagates down the column
          in lockstep with the weight data, telling each PE exactly when to
          latch. In a real TPU with 256 rows, a weight entered at the top
          ripples down to every PE in 256 clock cycles with no additional wiring.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle <code className="text-blue-300">weightValid</code> on and tick
          once. The top PE latches the weight and the LED shows the valid signal
          propagating. Tick again &mdash; the bottom PE receives and latches its
          weight. Both PEs now have independent data inputs and accumulate
          independently.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={TPU_CIRCUITS.twoPEColumn.dsl}
          displayDsl={TPU_CIRCUITS.twoPEColumn.displayDsl}
          height={400}
          showControls
          autoRunSpeed={400}
          title="Two-PE Column"
          description="Weight enters at top, propagates down with the valid signal."
        />
      </div>
    </section>
  );
}
