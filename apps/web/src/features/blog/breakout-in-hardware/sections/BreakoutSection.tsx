
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
          collision, and the 10-phase rendering pipeline. 16 bricks across two
          rows, a ball that bounces off walls, paddle, and bricks, and a
          3-pixel paddle you control with arrow keys.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Press <strong className="text-gray-900 dark:text-white">Run</strong> and use the arrow
          keys to move the paddle. The ball moves every 4th frame (40 clock
          ticks) &mdash; a hardware clock divider that gives you time to
          react. When the ball hits a brick, it disappears and the ball
          bounces back.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything you see is running on the same simulator that powers all
          the circuits in this blog. ~120 nodes, ~200 connections, no CPU, no
          software &mdash; just gates, registers, and one DualPortRAM.
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
          detection, muxes for selecting between addresses, and adders for
          position arithmetic. The 10-phase pipeline is just a counter driving
          a chain of muxes &mdash; the same pattern a GPU uses to schedule
          memory operations, scaled down to 8&times;8 pixels.
        </p>
      </div>
    </section>
  );
}
