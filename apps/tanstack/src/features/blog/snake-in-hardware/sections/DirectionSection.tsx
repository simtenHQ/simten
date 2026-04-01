"use client";

import { CircuitEmbed } from "@turing-incomplete/embed";
import { SNAKE_CIRCUITS } from "../circuits";

export function DirectionSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Decoding Player Input
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Arrow keys produce scan codes: Up&nbsp;=&nbsp;72,
          Down&nbsp;=&nbsp;80, Left&nbsp;=&nbsp;75, Right&nbsp;=&nbsp;77. The
          circuit needs to turn these into movement deltas:{" "}
          <strong className="text-gray-900 dark:text-white">deltaX</strong> and{" "}
          <strong className="text-gray-900 dark:text-white">deltaY</strong>, each either
          &minus;1,&nbsp;0, or&nbsp;+1.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Four <strong className="text-gray-900 dark:text-white">Comparator</strong> nodes check
          the key code against each direction constant. The results feed into a{" "}
          <strong className="text-gray-900 dark:text-white">Mux tree</strong> &mdash; a cascade of
          multiplexers that selects the right delta. If the Left comparator
          fires, deltaX becomes 255 (which is &minus;1 in unsigned 8-bit
          arithmetic). If Right fires, deltaX becomes 1. Otherwise it stays 0.
          The same logic applies to deltaY for Up and Down.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Try changing the key code input below. Set it to 72 for Up, 75 for
          Left, 77 for Right, or 80 for Down, and watch the delta displays
          update.
        </p>
      </div>

      <div className="mt-8">
        <CircuitEmbed
          dsl={SNAKE_CIRCUITS.directionDecoder.dsl}
          displayDsl={SNAKE_CIRCUITS.directionDecoder.displayDsl}
          nodePositions={SNAKE_CIRCUITS.directionDecoder.nodePositions}
          height={350}
          showControls
          title="Direction Decoder"
          description="Key code to deltaX/deltaY — try 72 (Up), 75 (Left), 77 (Right), 80 (Down)"
        />
      </div>
    </section>
  );
}
