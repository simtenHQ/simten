"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { PONG_CIRCUITS } from "../circuits";

export function BallSection() {
  const circuit = PONG_CIRCUITS.ballPosition;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        A Moving Ball
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The ball&rsquo;s position is stored in two <code>Register</code>
          {" "}components &mdash; one for X and one for Y. Each clock tick, an{" "}
          <code>Adder</code> adds a velocity delta (dx, dy) to the current
          position. A <code>BitSlice</code> wraps the result to the 0&ndash;7
          range so the ball stays on our 8&times;8 screen.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Toggle the <strong>enable</strong> switch, then click{" "}
          <strong>Tick</strong> to watch the ball move. Try changing{" "}
          <strong>dx</strong> and <strong>dy</strong> to alter the ball&rsquo;s
          direction.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={280}
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
