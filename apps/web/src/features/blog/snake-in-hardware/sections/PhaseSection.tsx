
import { CircuitEmbed } from "@simten/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function PhaseSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Multi-Step Operations
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A RAM port does one thing per cycle: read{" "}
          <em>or</em> write, at <em>one</em> address. But moving the snake needs
          four memory operations: read the tail&rsquo;s address, clear that
          pixel, write the new head to the body buffer, draw the new head pixel.
          So we run four{" "}
          <strong className="text-gray-900 dark:text-white">phases</strong>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A counter tracks which phase we&rsquo;re in: a 2-bit register that
          ticks 0 &rarr; 1 &rarr; 2 &rarr; 3 and back to 0. It only holds two
          bits, so it wraps after 3 on its own (a{" "}
          <strong className="text-gray-900 dark:text-white">BitSlice</strong> keeping the low
          two bits). Comparators watch the count and switch on the right RAM
          operation for each phase.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Toggle <strong>enable</strong> and tick to watch the counter cycle;
          each LED marks its phase. In the full game, the four ticks make one
          complete &ldquo;game step.&rdquo;
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.phaseDemo.circuit}
          layout={SNAKE_CIRCUITS.phaseDemo.layout}
          showControls
          autoRunSpeed={400}
          title="4-Phase Counter"
          description="Toggle enable and tick to see the phase cycle through 0-1-2-3"
        />
      </div>
    </section>
  );
}
