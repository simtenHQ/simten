
import { Link } from "@tanstack/react-router";

export function CTASection() {
  return (
    <section className="py-16">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Now build your own
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          Every circuit on this page was designed in Simten &mdash; a
          visual circuit simulator with an AI tutor. Start from simple
          components or jump straight to CPU design. The AI helps you wire
          things up, debug issues, and understand what&rsquo;s happening at
          every level.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/learn/rv32i-cpu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Try the CPU debugger &rarr;
          </Link>
          <Link
            to="/editor"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors border border-gray-300 dark:border-gray-700"
          >
            Build from scratch
          </Link>
        </div>
      </div>
    </section>
  );
}
