"use client";

import { ThemedCircuitEmbed as CircuitEmbed } from "@/features/blog/components/ThemedCircuitEmbed";
import { CHACHA20_CIRCUITS } from "../circuits";

export function RotateSection() {
  const circuit = CHACHA20_CIRCUITS.rotateDemo;

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Rotation: Zero-Cost Diffusion
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The third operation is left bit-rotation. In software,{" "}
          <code>(x &lt;&lt; n) | (x &gt;&gt; (32-n))</code>.
          In hardware, it&rsquo;s even simpler &mdash; you just rewire the bits.
          No gates, no delay, no power consumption. It&rsquo;s literally free.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Rotation moves high bits to low positions and low bits to high positions,
          ensuring that the carry diffusion from addition spreads across the
          entire word. ChaCha20 uses four specific rotation amounts &mdash;
          16, 12, 8, and 7 &mdash; carefully chosen to maximize diffusion
          after just a few rounds.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing the input value below (decimal). Start with{" "}
          <strong>1</strong> &mdash; <code>RotateLeft16</code> will output
          65536 (bit 0 moved to position 16), and <code>RotateLeft7</code>{" "}
          will output 128 (bit 0 moved to position 7). You can watch a single
          bit travel to its new position.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={circuit.dsl}
          height={300}
          showControls={false}
          displayDsl={circuit.displayDsl}
          title={circuit.name}
          description={circuit.description}
        />
      </div>
    </section>
  );
}
