
import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const SnakeDemo = lazy(() => import("../SnakeDemo").then((m) => ({ default: m.SnakeDemo })));

function SnakeDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading Snake game circuit...</span>
      </div>
    </div>
  );
}

export function SnakeSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full Snake Game
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything we&rsquo;ve built &mdash; framebuffer memory, coordinate
          addressing, direction decoding, pixel movement, phased operations,
          and collision detection &mdash; comes together in one circuit. The
          full <strong className="text-gray-900 dark:text-white">SnakeAdvanced</strong> circuit is
          over 300 lines of TypeScript, compiled and running in your browser.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The snake body is stored as a circular buffer of pixel addresses in
          RAM addresses 64&ndash;127. A 4-phase pipeline coordinates all the
          memory operations: phase&nbsp;0 reads the tail address from the body
          buffer, phase&nbsp;1 clears the tail pixel from the framebuffer,
          phase&nbsp;2 writes the new head address to the body buffer, and
          phase&nbsp;3 draws the new head pixel. When the snake eats food, the
          tail clear is suppressed &mdash; making the snake grow by one
          segment.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Click <strong>Run</strong> and use the arrow keys to play. There is
          no CPU executing instructions here &mdash; every decision is made by
          comparators, muxes, and gates, all evaluated in parallel on each
          clock tick.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<SnakeDemoLoader />}>
          <Suspense fallback={<SnakeDemoLoader />}>
            <SnakeDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          What you just played is a game that runs without any software. No
          instruction fetch, no decode, no execute cycle. The &ldquo;program&rdquo;
          is the circuit topology itself &mdash; wires carry data, gates make
          decisions, registers remember state, and the clock drives it all
          forward. It&rsquo;s the same principle behind dedicated hardware
          accelerators, GPU shader pipelines, and FPGA designs.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The difference between this and a CPU-based Snake game? A CPU is
          general-purpose &mdash; it can run <em>any</em> program but needs
          many cycles per decision. This circuit is special-purpose &mdash; it
          can <em>only</em> play Snake, but it makes every decision in a
          single combinational pass. That&rsquo;s the fundamental trade-off in
          computing: flexibility versus efficiency.
        </p>
      </div>
    </section>
  );
}
