"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { SNAKE_CIRCUITS } from "../circuits";

export function AddressingSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        From Coordinates to Pixels
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The snake moves on a 2D grid, but our framebuffer is a flat array of
          64 bytes. We need to convert{" "}
          <strong className="text-gray-900 dark:text-white">(X,&nbsp;Y)</strong> coordinates into a
          linear address. The formula is simple:{" "}
          <code className="text-blue-300">address = (Y &laquo; 3) + X</code>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Multiplying by 8 is the same as shifting left by 3 bits, and in real
          hardware a left shift by a constant costs{" "}
          <strong className="text-gray-900 dark:text-white">zero gates</strong> &mdash; it&rsquo;s
          just wiring. Each bit of Y connects to a position three places higher,
          with the low three bits tied to zero. The only actual logic gate is the
          final{" "}
          <strong className="text-gray-900 dark:text-white">Adder</strong> that adds X.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Change the X and Y inputs below to see how the address changes. For
          example, (3,&nbsp;2) gives address&nbsp;19, which is row&nbsp;2,
          column&nbsp;3 of the screen.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.coordToPixel.dsl}
          displayDsl={SNAKE_CIRCUITS.coordToPixel.displayDsl}
          nodePositions={SNAKE_CIRCUITS.coordToPixel.nodePositions}
          height={350}
          showControls
          title="Coordinate to Pixel Address"
          description="(Y << 3) + X — the shift is just wiring, only the final add is a real gate"
        />
      </div>
    </section>
  );
}
