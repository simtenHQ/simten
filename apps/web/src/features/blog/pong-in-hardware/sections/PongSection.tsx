
import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const PongDemo = lazy(() => import("../PongDemo").then((m) => ({ default: m.PongDemo })));

function PongDemoLoader() {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <span>Loading Pong circuit...</span>
      </div>
    </div>
  );
}

export function PongSection() {
  return (
    <section className="py-12">
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is a complete Pong game running on a 16&times;16 screen &mdash;
          no CPU, no software, just digital circuits. Click{" "}
          <strong className="text-gray-900 dark:text-white">Run</strong> and
          use <kbd>W</kbd>/<kbd>S</kbd> for the left paddle and{" "}
          <kbd>&uarr;</kbd>/<kbd>&darr;</kbd> for the right. Scroll down to see
          how each piece works.
        </p>
      </div>

      <div className="mt-8">
        <ClientOnly fallback={<PongDemoLoader />}>
          <Suspense fallback={<PongDemoLoader />}>
            <PongDemo />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          There is no software executing instructions here. The keyboard scan
          codes flow through comparators, the mux trees select deltas, the
          adders compute new positions, and the phase counter orchestrates
          memory writes &mdash; all in parallel combinational logic, driven
          forward by the clock.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is the same principle behind dedicated hardware accelerators:
          instead of a general-purpose CPU interpreting instructions one by one,
          the &ldquo;program&rdquo; is the circuit topology itself. It can only
          play Pong, but it does so at one operation per clock cycle per gate.
        </p>
      </div>
    </section>
  );
}
