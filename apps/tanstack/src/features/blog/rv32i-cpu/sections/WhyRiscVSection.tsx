"use client";

export function WhyRiscVSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        Why RISC-V?
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Most CPUs are black boxes. You write code, it runs, and somewhere
          inside a billion transistors do&hellip; something. RISC-V changes that.
          It&rsquo;s an <strong className="text-white">open instruction set</strong> &mdash;
          anyone can read the spec, build a processor, and understand exactly
          what happens when your code executes.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The base integer instruction set, <strong className="text-white">RV32I</strong>,
          has just 47 instructions. That&rsquo;s enough to run a C compiler, an
          operating system, or a web server. ARM has thousands. x86 has
          thousands more. RISC-V proves you don&rsquo;t need them.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The CPU on this page implements all of RV32I. It has a 5-stage
          pipeline, data forwarding, hazard detection, 64KB of instruction
          memory, 64KB of data RAM, and a UART for output. You can compile C
          with GCC, load the binary, and step through it cycle by cycle.
        </p>
      </div>
    </section>
  );
}
