import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [{ title: "Learn | Turing Incomplete" }],
  }),
  component: LearnIndexPage,
});

function LearnIndexPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <section className="py-16 md:py-24">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            &larr; Home
          </Link>
          <h1 className="mt-8 text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Learn
          </h1>
          <p className="mt-6 text-xl text-gray-400 leading-relaxed max-w-2xl">
            Guided lessons that explain how hardware works, one scrollable step
            at a time. Every circuit is live — tick it, poke it, break it.
          </p>
        </section>

        <div className="space-y-4">
          {/* Dual CPU — featured tool */}
          <Link
            to="/learn/dual-cpu"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-purple-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                  RV32I Dual CPU
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  Two independent RISC-V CPUs running in parallel, communicating
                  via a memory-mapped NIC. Watch inter-CPU message passing happen
                  cycle by cycle.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-purple-400 transition-colors text-2xl ml-4">
                &rarr;
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 text-xs font-medium">
                Dual Core
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs font-medium">
                Interactive
              </span>
            </div>
          </Link>

          {/* CPU Debugger — featured tool */}
          <Link
            to="/learn/cpu"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  RV32I CPU Debugger
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  Write C, C++, Rust, or assembly — compile it and watch it
                  execute instruction by instruction on a real 5-stage pipelined
                  RISC-V CPU. See every pipeline stage, register, and clock cycle.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-blue-400 transition-colors text-2xl ml-4">
                &rarr;
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 text-xs font-medium">
                Debugger
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs font-medium">
                Interactive
              </span>
            </div>
          </Link>

        </div>

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Turing Incomplete
          </Link>
        </footer>
      </main>
    </div>
  );
}
