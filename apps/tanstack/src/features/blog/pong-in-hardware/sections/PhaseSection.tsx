"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { PONG_CIRCUITS } from "../circuits";

export function PhaseSection() {
  const circuit = PONG_CIRCUITS.phaseCounter;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The 6-Phase Rendering Pipeline
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Pong has three objects to draw (ball, left paddle, right paddle), and
          the DualPortRAM only supports one write per clock cycle. The solution:
          a 6-phase pipeline that takes turns.
        </p>
        <ul className="text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>Phases 0&ndash;2: clear the old ball, left paddle, right paddle</li>
          <li>Phases 3&ndash;5: draw the new ball, left paddle, right paddle</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A register counts from 0 to 5, wrapping back to 0 when it reaches 6.
          The <strong>Draw</strong> LED lights when the counter is in a draw
          phase (&ge; 3). Toggle the enable switch and tick to watch the cycle.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={260}
          showControls={true}
          displayDsl={circuit.displayDsl}
          nodePositions={circuit.nodePositions}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
