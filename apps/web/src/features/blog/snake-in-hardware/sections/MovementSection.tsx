
import { CircuitEmbed } from "@simten/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function MovementSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Moving a Pixel
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Now make a pixel move. Two{" "}
          <strong className="text-gray-900 dark:text-white">Registers</strong> hold the head
          position,{" "}
          <code className="text-blue-300">headX</code> and{" "}
          <code className="text-blue-300">headY</code>, both starting at 4. Each
          tick adds the deltas to get the next position.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The grid wraps: walk off the right edge and you reappear on the left.
          That comes for free by keeping only the lowest 3 bits of each
          coordinate, which forces it back into the 0&ndash;7 range. Column 7 +
          1 wraps to&nbsp;0; column 0 &minus; 1 wraps to&nbsp;7
          (0&nbsp;&minus;&nbsp;1&nbsp;=&nbsp;255, and{" "}
          <code className="text-blue-300">255 &amp; 0b111 = 7</code>). The part
          doing it is a{" "}
          <strong className="text-gray-900 dark:text-white">BitSlice</strong>, and there&rsquo;s
          no edge-case check anywhere; the wrap falls out of the arithmetic.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The wrapped coordinates become a pixel address (Y&times;8+X) written
          to the framebuffer. Flip <strong>enable</strong> on, set a direction
          code, and tick to walk the pixel across the screen.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          circuit={SNAKE_CIRCUITS.pixelMover.circuit}
          layout={SNAKE_CIRCUITS.pixelMover.layout}
          showControls
          title="Pixel Mover"
          description="Toggle enable, set a direction (72/75/77/80), and tick to move the pixel"
        />
      </div>
    </section>
  );
}
