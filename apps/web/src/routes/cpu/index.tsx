import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/cpu/')({
  head: () =>
    pageHead({
      title: 'CPUs',
      description:
        'Interactive CPU debuggers built in simten. Pick a processor and step through execution cycle by cycle, with every register and pipeline stage visible.',
      path: '/cpu',
    }),
  component: CPUIndexPage,
});

function CPUIndexPage() {
  return (
    <div className="bg-gray-950 text-gray-100">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <section className="py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            CPUs
          </h1>
          <p className="mt-6 text-xl text-gray-400 leading-relaxed max-w-2xl">
            Interactive CPU debuggers built in simten. Pick a processor and step through execution
            cycle by cycle.
          </p>
        </section>

        <div className="space-y-4">
          <Link
            to="/cpu/rv32i"
            className="block p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-gray-900/80 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  RV32I
                </h2>
                <p className="mt-2 text-gray-400 leading-relaxed">
                  Write C, C++, Rust, or assembly, then compile it and watch it execute instruction
                  by instruction on a real 5-stage pipelined RISC-V CPU. See every pipeline stage,
                  register, and clock cycle.
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
          <Link to="/" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            Simten
          </Link>
        </footer>
      </main>
    </div>
  );
}
