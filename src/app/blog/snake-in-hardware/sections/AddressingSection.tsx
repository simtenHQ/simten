"use client";

import { CircuitEmbed } from "@/components/circuit-embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function AddressingSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        From Coordinates to Pixels
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          The snake moves on a 2D grid, but our framebuffer is a flat array of
          64 bytes. We need to convert{" "}
          <strong className="text-white">(X,&nbsp;Y)</strong> coordinates into a
          linear address. The formula is simple:{" "}
          <code className="text-blue-300">address = Y &times; 8 + X</code>.
        </p>
        <p className="text-gray-300 leading-relaxed">
          But we don&rsquo;t have a multiplier &mdash; just adders. No problem:
          multiplying by 8 is the same as doubling three times. We chain three{" "}
          <strong className="text-white">Adder</strong> nodes:{" "}
          <code className="text-blue-300">Y+Y=2Y</code>, then{" "}
          <code className="text-blue-300">2Y+2Y=4Y</code>, then{" "}
          <code className="text-blue-300">4Y+4Y=8Y</code>. Finally, one more
          adder adds X to get the pixel address.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Change the X and Y inputs below to see how the address changes. For
          example, (3,&nbsp;2) gives address&nbsp;19, which is row&nbsp;2,
          column&nbsp;3 of the screen.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.coordToPixel.dsl}
          displayDsl={SNAKE_CIRCUITS.coordToPixel.displayDsl}
          height={350}
          showControls
          title="Coordinate to Pixel Address"
          description="Y*8+X computed with chained adders — change X and Y to see the address"
        />
      </div>
    </section>
  );
}
