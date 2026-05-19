import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/learn/")({
  head: () =>
    pageHead({
      title: "Learn",
      description:
        "Concept-level walkthroughs of digital design fundamentals. Every embedded circuit is live and editable in place.",
      path: "/learn",
    }),
  component: LearnIndexPage,
});

function LearnIndexPage() {
  return (
    <div className="bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <section className="py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Learn
          </h1>
          <p className="mt-6 text-xl text-gray-400 leading-relaxed max-w-2xl">
            Concept-level walkthroughs of digital design fundamentals.
            Embedded circuits are live and editable in place.
          </p>
        </section>

        <div className="space-y-4">
          <Link
            to="/learn/adders"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  Adders
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  How digital circuits add two numbers &mdash; starting from a
                  single XOR gate, ending with why the obvious design gets
                  slower the wider your inputs are.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-blue-400 transition-colors text-2xl ml-4">
                &rarr;
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs font-medium">
                Arithmetic
              </span>
            </div>
          </Link>

          <Link
            to="/learn/abstraction"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  Abstraction
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  How a cluster of gates becomes a named block you can
                  reuse &mdash; and how the same move scales from a
                  half-adder up to a CPU.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-blue-400 transition-colors text-2xl ml-4">
                &rarr;
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 text-xs font-medium">
                Concepts
              </span>
            </div>
          </Link>

          <Link
            to="/learn/registers"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  Registers
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  How a circuit remembers. From the single-bit D flip-flop
                  to multi-bit registers with write-enable, ending with a
                  counter &mdash; the first useful sequential circuit.
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-blue-400 transition-colors text-2xl ml-4">
                &rarr;
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 text-xs font-medium">
                Sequential
              </span>
            </div>
          </Link>

          <p className="text-gray-500 pt-4">
            More coming &mdash; FSMs, multiplexers.
          </p>
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Simten
          </Link>
        </footer>
      </main>
    </div>
  );
}
