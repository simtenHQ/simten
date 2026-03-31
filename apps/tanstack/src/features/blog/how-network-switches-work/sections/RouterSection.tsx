"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { SWITCH_CIRCUITS } from "../circuits";

export function RouterSection() {
  const circuit = SWITCH_CIRCUITS.crossbarRouter;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Crossbar Routing
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A real switch looks at the destination MAC address to decide where to
          forward each packet. Our simplified 2-port switch uses a{" "}
          <strong className="text-gray-900 dark:text-white">static cross-over</strong>: anything
          from port 0 goes to port 1, and vice versa. This is the minimal
          useful routing &mdash; a 2-port crossbar.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The routing logic is just a comparator and a mux. If the source port
          equals 0, the <code>Mux</code> selects 1 as the destination (and the{" "}
          <strong>routedLed</strong> lights up). Otherwise, it selects 0.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change <strong>sourcePort</strong> between 0 and 1 to see the{" "}
          <strong>destDisplay</strong> flip to the opposite port. This is
          instant &mdash; pure combinational logic.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={220}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
