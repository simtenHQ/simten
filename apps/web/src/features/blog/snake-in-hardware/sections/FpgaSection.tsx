
export function FpgaSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        From Browser to FPGA
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The circuit isn&rsquo;t stuck in the browser. Export it to Verilog,
          synthesize it, and it runs on an actual FPGA. Here it is on a{" "}
          <strong className="text-gray-900 dark:text-white">ULX3S</strong>{" "}
          (Lattice ECP5) drawing to a monitor over HDMI, steered with the
          board&rsquo;s buttons.
        </p>
      </div>

      <figure className="mt-8 mx-auto max-w-md">
        <img
          src="/blog-assets/images/snake-ulx3s.jpg"
          alt="The Snake circuit running on a ULX3S FPGA, drawn on a monitor over HDMI"
          loading="lazy"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-800"
        />
        <figcaption className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          The same circuit from the demo above, synthesized onto a ULX3S (ECP5)
          and running over HDMI.
        </figcaption>
      </figure>

      <div className="mt-8 prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This isn&rsquo;t a Verilog rewrite of Snake. The game logic and
          framebuffer are byte-for-byte the circuit you just played, and a CI
          check fails the build if the browser version and the bitstream ever
          drift apart. Same logic, on silicon.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The video is generated logic too, no display chip in the path. A{" "}
          <a
            href="https://en.wikipedia.org/wiki/Transition-minimized_differential_signaling"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            TMDS encoder
          </a>{" "}
          turns each pixel into the 10-bit DVI signaling the monitor expects.
          That, plus the pixel clock and button inputs, is{" "}
          <a
            href="https://github.com/simtenHQ/simten/blob/main/hardware/ulx3s/projects/snake/snake_top.v"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            plain Verilog
          </a>{" "}
          wrapped around the generated core, and none of it is snake-specific.
          The game is the generated part; this is the standard board wiring to
          get it on a screen.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The flow is open the whole way: Verilog &rarr; Yosys
          (<code className="text-blue-300">synth_ecp5</code>) &rarr; nextpnr
          &rarr; ecppack &rarr; bitstream. About 100 nodes of logic, and nextpnr
          closes timing with plenty of headroom over the 25&nbsp;MHz the design
          actually runs at.
        </p>

        <h3 className="pt-2 text-xl font-semibold text-gray-900 dark:text-white">
          Run it on your own board
        </h3>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Got an FPGA? The Snake core is plain Verilog, so it synthesizes for
          any board. The repo has a complete ULX3S (ECP5) build to copy from,
          plus a{" "}
          <a
            href="https://github.com/simtenHQ/simten/blob/main/hardware/ulx3s/projects/snake/README.md"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            README
          </a>{" "}
          on running it there and porting it elsewhere: you swap the wrapper, the
          constraints, and the toolchain target, while the game logic stays the
          same.
        </p>
      </div>
    </section>
  );
}
