export function WhyRiscVSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why RISC-V?</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Most CPUs are black boxes. You write code, it runs, and somewhere inside a billion
          transistors do&hellip; something. RISC-V changes that. It&rsquo;s an{' '}
          <strong className="text-gray-900 dark:text-white">open instruction set</strong>: anyone
          can read the spec, build a processor, and understand exactly what happens when your code
          executes.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The base integer instruction set,{' '}
          <strong className="text-gray-900 dark:text-white">RV32I</strong>, has just 47
          instructions. That&rsquo;s enough to run a C compiler, an operating system, or a web
          server. ARM has thousands. x86 has thousands more. RISC-V proves you don&rsquo;t need
          them.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The CPU on this page implements all of RV32I using a{' '}
          <strong className="text-gray-900 dark:text-white">classic 5-stage pipeline</strong>, the
          same architecture used in{' '}
          <a
            href="https://www.sifive.com/cores/e31"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            SiFive&rsquo;s E31
          </a>{' '}
          and described in Patterson &amp; Hennessy&rsquo;s{' '}
          <em>Computer Organization and Design</em>, the standard computer architecture textbook. It
          has data forwarding, hazard detection, 64KB of instruction memory, 64KB of data RAM, and a
          UART for output.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          To keep things understandable, we&rsquo;ve left out a few things that a production core
          would have:
        </p>
        <ul className="text-gray-500 dark:text-gray-400 text-sm space-y-2 list-none">
          <li className="flex gap-2">
            <span className="text-gray-600 shrink-0">&bull;</span>
            <span>
              <strong className="text-gray-600 dark:text-gray-300">No branch predictor</strong>: we
              always flush on taken branches. A real core would predict branch outcomes to avoid the
              penalty.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-600 shrink-0">&bull;</span>
            <span>
              <strong className="text-gray-600 dark:text-gray-300">No caches</strong>: we access
              memory directly. A production CPU would have L1 instruction and data caches to hide
              memory latency.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-600 shrink-0">&bull;</span>
            <span>
              <strong className="text-gray-600 dark:text-gray-300">
                No interrupts or exceptions
              </strong>
              : real cores need these for I/O, timers, and error handling.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-600 shrink-0">&bull;</span>
            <span>
              <strong className="text-gray-600 dark:text-gray-300">No CSRs</strong>: control and
              status registers for privilege levels, counters, and configuration.
            </span>
          </li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each of these could be added as an extension to the existing pipeline. The 5-stage
          structure doesn&rsquo;t change. Branch prediction adds logic to the Fetch stage, caches
          sit in front of memory, and interrupts add a new control path into Decode.
        </p>
      </div>
    </section>
  );
}
