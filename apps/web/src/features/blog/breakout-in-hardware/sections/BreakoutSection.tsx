
import { Suspense, lazy } from "react";

const BreakoutDemo = lazy(() =>
  import("../BreakoutDemo").then((m) => ({ default: m.BreakoutDemo }))
);

function BreakoutDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8 flex items-center gap-3 text-gray-500 dark:text-gray-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      <span className="text-sm">Loading Breakout simulator...</span>
    </div>
  );
}

function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  if (typeof window === "undefined") return <>{fallback}</>;
  return <>{children}</>;
}

export function BreakoutSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Full Game
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          All the pieces come together: paddle input, ball physics, brick
          collision, and the combinational raster scan. 128 bricks across the
          top four rows, a ball that bounces off walls, paddle, and bricks, and
          a 6-pixel paddle you control with arrow keys.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Press <strong className="text-gray-900 dark:text-white">Run</strong> and use the arrow
          keys to move the paddle. The ball moves every 4th clock &mdash; a
          hardware clock divider that gives you time to react. When the ball
          hits a brick, it disappears and the ball bounces back. Lose the ball
          and the wall redraws itself, then a fresh ball launches.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything you see is running on the same simulator that powers all
          the circuits in this blog. No CPU, no software &mdash; just gates,
          registers, and one DualPortRAM for the wall. And it&rsquo;s all
          synthesizable: the exact same circuit exports to Verilog and runs on
          an FPGA.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<BreakoutDemoLoader />}>
          <Suspense fallback={<BreakoutDemoLoader />}>
            <BreakoutDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-4">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit uses the same fundamental building blocks as everything
          else on this site: registers for state, comparators for collision
          detection, muxes for selecting between values, and adders for position
          arithmetic. The raster scan is just a counter and a bank of comparators
          &mdash; the same on-the-fly pixel generation a VGA controller uses,
          scaled to a 32&times;16 screen.
        </p>
      </div>
    </section>
  );
}
