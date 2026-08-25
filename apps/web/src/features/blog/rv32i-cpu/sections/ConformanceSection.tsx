export function ConformanceSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Does it actually implement RISC-V?
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          &ldquo;It runs my C program&rdquo; is a weak claim. A CPU can run a lot of code correctly
          and still get an edge case wrong: a shift by 32, a signed comparison at the boundary, a
          branch offset that wraps. The industry answer to that is a conformance suite, so we ran
          one.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The core passes all 38 of the official{' '}
          <a
            href="https://github.com/riscv/riscv-arch-test"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            riscv-arch-test
          </a>{' '}
          RV32I-I tests, with its signature compared byte-for-byte against{' '}
          <a
            href="https://github.com/riscv-software-src/riscv-isa-sim"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Spike
          </a>
          , the reference RISC-V simulator. What gets tested is the elaborated gate-level netlist
          (the same circuit shown above, flattened to primitives), not a behavioural model written
          alongside it. The core needed no changes to pass.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 p-4 text-sm text-gray-800 dark:text-gray-200">
          <code>38/38 attempted pass vs Spike · 38/38 trap-free (pure RV32I) · 0 skipped</code>
        </pre>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A green test run only means something if it can go red. The harness includes a fault check
          that patches an <code>add</code> into a <code>sub</code> in the instruction stream and
          confirms the signature then diverges from Spike, so passing is evidence rather than a
          formality.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Two honest limits: this is simulation, not silicon (the suite has not been run on the
          FPGA), and passing arch-test is not the same as being certified.
        </p>
      </div>

      <div className="mt-6 text-center">
        <a
          href="https://github.com/simtenHQ/simten/tree/main/hardware/ulx3s/projects/cpu/archtest"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          The conformance harness on GitHub &rarr;
        </a>
      </div>
    </section>
  );
}
