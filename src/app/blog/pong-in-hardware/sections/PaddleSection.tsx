"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { PONG_CIRCUITS } from "../circuits";

export function PaddleSection() {
  const circuit = PONG_CIRCUITS.paddleMovement;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Paddle Movement
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Each paddle is controlled by a pair of keys. The circuit compares the
          keyboard scan code to the expected values: W (17) moves up, S (31)
          moves down. A cascaded <code>Mux</code> tree converts the key
          detection into a delta value: &minus;1, 0, or +1.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The delta feeds into an <code>Adder</code> that updates a{" "}
          <code>Register</code> storing the paddle&rsquo;s Y position. A{" "}
          <code>BitSlice</code> wraps the result to keep the paddle on screen.
          Set <strong>keyboard</strong> to 17 (W) or 31 (S), toggle the
          enable switch, and tick to see it move.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={300}
          showControls={true}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
