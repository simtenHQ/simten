"use client";

export function TryItSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Things to Try
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The debugger above isn&rsquo;t a recording &mdash; it&rsquo;s a live
          simulation. Here are some experiments that reveal how the pipeline
          actually works:
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            1. Spot a data hazard
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Write two instructions where the second uses the result of the
            first. Step through and watch the forwarding mux kick in &mdash;
            the EX or MEM result gets bypassed directly instead of waiting for
            writeback.
          </p>
          <pre className="mt-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 font-mono text-xs text-gray-500 dark:text-gray-300">
{`int x = 5;
int y = x + 3; // needs x immediately`}
          </pre>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            2. Trigger a pipeline flush
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Add an <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">if</code> statement.
            When the branch is taken, watch the pipeline badges &mdash;
            instructions that were already fetched get flushed and replaced
            with NOPs.
          </p>
          <pre className="mt-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 font-mono text-xs text-gray-500 dark:text-gray-300">
{`int x = 10;
if (x > 5) {
    x = x * 2;
}`}
          </pre>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            3. Compare C vs Assembly
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Write something simple in C, compile it, then switch to Assembly
            and write the same thing by hand. Compare how many instructions
            GCC generates vs your hand-written version.
          </p>
          <pre className="mt-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 font-mono text-xs text-gray-500 dark:text-gray-300">
{`// C: how many instructions?
int result = (3 + 4) * 2;`}
          </pre>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            4. Try a different language
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Switch to Rust and compile the same Fibonacci. The disassembly
            will look different &mdash; different compilers make different
            choices &mdash; but the pipeline doesn&rsquo;t care. Same stages,
            same forwarding, same hazards.
          </p>
        </div>
      </div>
    </section>
  );
}
