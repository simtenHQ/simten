"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { PONG_CIRCUITS } from "../circuits";

export function AddressSection() {
  const circuit = PONG_CIRCUITS.pixelAddress;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        From Coordinates to Pixels
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The screen&rsquo;s DualPortRAM stores 64 pixels in a flat array. To
          draw at position (X, Y) we need the linear address Y &times; 8 + X.
          Multiplying by 8 is the same as shifting left by 3 bits, and in real
          hardware a left shift costs{" "}
          <strong className="text-white">zero gates</strong> &mdash; it&rsquo;s
          just <em>wiring</em>. Each bit of Y connects to a position three
          places higher in the output, with the low three bits tied to zero.
          The only actual logic gate is the final adder that adds X.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Change <strong>x</strong> and <strong>y</strong> to see the address
          update instantly &mdash; this is pure combinational logic with zero
          clock cycles.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={240}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
