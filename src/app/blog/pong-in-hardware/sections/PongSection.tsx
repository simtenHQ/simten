"use client";

import dynamic from "next/dynamic";

const PongDemo = dynamic(
  () => import("../PongDemo").then((m) => ({ default: m.PongDemo })),
  {
    loading: () => (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span>Loading Pong circuit...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function PongSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The Full Pong Game
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; ball position registers, bounce
          detection, paddle controls, the 6-phase rendering pipeline, and pixel
          addressing &mdash; comes together in one circuit. The full{" "}
          <strong className="text-white">PongSimple</strong> circuit has over
          50 components, all compiled and running in your browser.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Click <strong>Run</strong> and use <kbd>W</kbd>/<kbd>S</kbd> for the
          left paddle and <kbd>&uarr;</kbd>/<kbd>&darr;</kbd> for the right
          paddle. The ball bounces off all four walls &mdash; comparators
          detect when it reaches an edge, and mux logic flips the velocity
          register between +1 and &minus;1. Each clock cycle executes one
          phase of the render pipeline, so 6 ticks complete one full frame
          update.
        </p>
      </div>

      <div className="mt-8">
        <PongDemo />
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          There is no software executing instructions here. The keyboard scan
          codes flow through comparators, the mux trees select deltas, the
          adders compute new positions, and the phase counter orchestrates
          memory writes &mdash; all in parallel combinational logic, driven
          forward by the clock.
        </p>
        <p className="text-gray-300 leading-relaxed">
          This is the same principle behind dedicated hardware accelerators:
          instead of a general-purpose CPU interpreting instructions one by one,
          the &ldquo;program&rdquo; is the circuit topology itself. It can only
          play Pong, but it does so at one operation per clock cycle per gate.
        </p>
      </div>
    </section>
  );
}
