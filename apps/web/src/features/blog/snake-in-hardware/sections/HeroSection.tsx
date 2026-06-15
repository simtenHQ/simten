
import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const SnakeDemo = lazy(() => import("../SnakeDemo").then((m) => ({ default: m.SnakeDemo })));

export function HeroSection() {
  return (
    <section className="py-8 md:py-12">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight mb-2">
        Snake in Hardware
      </h1>
      {/* Playable Snake — immediately after the title */}
      <ClientOnly>
        <Suspense
          fallback={
            <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8 mb-8" style={{ minHeight: 400 }}>
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
                <span>Loading Snake game circuit...</span>
              </div>
            </div>
          }
        >
          <div className="mb-8">
            <SnakeDemo />
          </div>
        </Suspense>
      </ClientOnly>

      <div className="max-w-3xl">
        <p className="text-xl text-gray-500 dark:text-gray-300 leading-relaxed">
          This whole thing runs without a CPU. Every move the snake makes is
          decided by wires and gates, all at once, on each clock tick. It&rsquo;s
          about 100 nodes of logic, registers, and memory, all written in
          TypeScript and simulated live in your browser. The same code exports to
          Verilog. Here&rsquo;s how it works.
        </p>
        <div className="mt-6 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Interactive tutorial</span>
          <span className="text-gray-600">/</span>
          <span>~12 min read</span>
        </div>
      </div>
    </section>
  );
}
