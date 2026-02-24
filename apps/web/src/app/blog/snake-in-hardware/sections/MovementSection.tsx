"use client";

import { CircuitEmbed } from "@turing-incomplete/ui/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function MovementSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Moving a Pixel
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          With direction decoding solved, we can make a pixel actually move.
          Two <strong className="text-white">Register</strong> nodes store the
          current head position &mdash;{" "}
          <code className="text-blue-300">headX</code> and{" "}
          <code className="text-blue-300">headY</code>, both starting at 4.
          Each clock tick, the deltas are added to produce the next position.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The key trick is{" "}
          <strong className="text-white">BitSlice(low=0, high=2)</strong>,
          which extracts the lowest 3 bits. This wraps the coordinate to
          0&ndash;7 automatically: moving right from column 7 wraps to
          column&nbsp;0, and moving left from column 0 wraps to column&nbsp;7
          (since 0&nbsp;&minus;&nbsp;1&nbsp;=&nbsp;255, and{" "}
          <code className="text-blue-300">255 &amp; 0b111 = 7</code>).
        </p>
        <p className="text-gray-300 leading-relaxed">
          The wrapped coordinates are then converted to a pixel address
          (Y&times;8+X) and written to the DualPortRAM framebuffer. Toggle the{" "}
          <strong>enable</strong> switch, set a direction code on the keyboard
          input, and tick to see the pixel move across the screen.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.pixelMover.dsl}
          displayDsl={SNAKE_CIRCUITS.pixelMover.displayDsl}
          height={400}
          showControls
          title="Pixel Mover"
          description="Toggle enable, set a direction (72/75/77/80), and tick to move the pixel"
        />
      </div>
    </section>
  );
}
