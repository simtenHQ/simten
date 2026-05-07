
import { CircuitEmbed } from "@simten/embed";
import { PONG_CIRCUITS } from "../circuits";

export function PhaseSection() {
  const entry = PONG_CIRCUITS.phaseCounter;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The 14-Phase Rendering Pipeline
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Pong has three objects to draw (ball, left paddle, right paddle), and
          the DualPortRAM only supports one write per clock cycle. The solution:
          a 14-phase pipeline that takes turns.
        </p>
        <ul className="text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>Phase 0: clear the old ball</li>
          <li>Phases 1&ndash;3: clear the old left paddle (3 pixels tall)</li>
          <li>Phases 4&ndash;6: clear the old right paddle</li>
          <li>Phase 7: draw the new ball</li>
          <li>Phases 8&ndash;10: draw the new left paddle</li>
          <li>Phases 11&ndash;13: draw the new right paddle</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A register counts from 0 to 13, wrapping back to 0 when it reaches 14.
          The <strong>Draw</strong> LED lights when the counter is in a draw
          phase (&ge; 7). Toggle the enable switch and tick to watch the cycle.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={entry.circuit}
          showControls={true}
          layout={entry.layout}
          title={entry.name}
          description={entry.description}
        />
      </div>
    </section>
  );
}
