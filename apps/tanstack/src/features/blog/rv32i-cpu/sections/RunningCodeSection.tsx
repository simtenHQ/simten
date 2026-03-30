"use client";

import { Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";

const CPUDebugger = lazy(() =>
  import("@/features/learn/cpu-debugger/CPUDebugger").then((m) => ({
    default: m.CPUDebugger,
  }))
);

function DebuggerSkeleton() {
  return (
    <div className="h-[700px] rounded-xl border border-gray-800 bg-gray-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        Loading CPU&hellip;
      </div>
    </div>
  );
}

export function RunningCodeSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-white mb-4">
        The Payoff: Running C
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-300 leading-relaxed">
          That&rsquo;s the whole CPU. A program counter, a decoder, an ALU,
          memory, a register file, pipeline registers between each stage, and
          forwarding/hazard logic to keep it all correct. Around 600 lines of
          circuit description &mdash; registers, muxes, and functional blocks
          wired together structurally, like a real hardware design.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Now for the part that matters: <strong className="text-white">it runs
          real programs</strong>. The debugger below compiles C (or C++, Rust,
          Assembly) with{" "}
          <code className="text-white bg-gray-800 px-1.5 py-0.5 rounded text-sm">riscv-none-elf-gcc</code>
          {" "}&mdash; the same GCC cross-compiler used for bare-metal RISC-V
          development &mdash; loads the binary into the CPU&rsquo;s instruction
          memory, and lets you step through execution one cycle at a time.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Watch the pipeline badges &mdash; five instructions in flight, each
          in a different stage. Watch the registers change as results are
          written back. Hover over any instruction in the disassembly to see
          what it does.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-gray-800 overflow-hidden">
        <Suspense fallback={<DebuggerSkeleton />}>
          <div className="h-[700px]">
            <CPUDebugger />
          </div>
        </Suspense>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/learn/cpu"
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          Open full-screen debugger &rarr;
        </Link>
      </div>
    </section>
  );
}
