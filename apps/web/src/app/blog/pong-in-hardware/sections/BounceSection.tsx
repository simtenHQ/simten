"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { PONG_CIRCUITS } from "../circuits";

export function BounceSection() {
  const circuit = PONG_CIRCUITS.bounceDetection;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Bounce Detection
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          When the ball reaches the top or bottom edge of the screen, it needs
          to reverse direction. Two <code>Comparator</code> nodes check if the
          ball&rsquo;s Y coordinate equals 0 (top wall) or 7 (bottom wall). An{" "}
          <code>Or</code> gate combines the results, and a <code>Mux</code>{" "}
          selects the new direction: +1 if at the top, &minus;1 (255 in unsigned
          8-bit) if at the bottom.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Change <strong>ballY</strong> to 0 or 7 and watch the bounce LED
          light up.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={260}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
