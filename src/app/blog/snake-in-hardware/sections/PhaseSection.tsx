"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function PhaseSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Multi-Step Operations
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          A single RAM port can only do one thing per clock cycle &mdash; read{" "}
          <em>or</em> write, at <em>one</em> address. But moving the snake
          requires multiple memory operations: read the tail&rsquo;s pixel
          address, clear that pixel, write the new head position to the body
          buffer, and draw the new head pixel. That&rsquo;s at least four
          operations, so we need four{" "}
          <strong className="text-white">phases</strong>.
        </p>
        <p className="text-gray-300 leading-relaxed">
          A <strong className="text-white">phase counter</strong> is just a
          2-bit register that increments each tick: 0 &rarr; 1 &rarr; 2 &rarr;
          3 &rarr; 0. We use{" "}
          <strong className="text-white">BitSlice(low=0, high=1)</strong> to
          wrap it back to 0 after 3, keeping only the two lowest bits.
          Comparators detect which phase is active, and their outputs gate
          different RAM operations.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle the <strong>enable</strong> switch and tick to watch the phase
          counter cycle. Each LED lights up on its corresponding phase. In the
          full Snake circuit, each phase triggers a different RAM
          read or write &mdash; turning four clock ticks into one complete
          &ldquo;game step.&rdquo;
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.phaseDemo.dsl}
          displayDsl={SNAKE_CIRCUITS.phaseDemo.displayDsl}
          height={350}
          showControls
          autoRunSpeed={400}
          title="4-Phase Counter"
          description="Toggle enable and tick to see the phase cycle through 0-1-2-3"
        />
      </div>
    </section>
  );
}
