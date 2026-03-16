"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { CORDIC_CIRCUITS } from "../circuits";

export function RotationSection() {
  const circuit = CORDIC_CIRCUITS.rotationStep;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The Rotation Formula
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          To rotate a vector (x, y) by a small angle, CORDIC uses:
        </p>
        <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg text-sm font-mono">
{`x_next = x - (y >> iteration)
y_next = y + (x >> iteration)`}
        </pre>
        <p className="text-gray-300 leading-relaxed">
          That&rsquo;s it &mdash; a shift and an add for each coordinate.
          Subtraction is done in two&rsquo;s complement: invert all bits with
          a <code>BusNot</code>, then add 1 via the carry input of a{" "}
          <code>SignedAdder</code>. The circuit below computes both{" "}
          <strong>x &minus; (y &gt;&gt; shift)</strong> and{" "}
          <strong>x + (y &gt;&gt; shift)</strong> simultaneously.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={280}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
