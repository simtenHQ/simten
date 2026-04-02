"use client";

import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { CircuitEmbed } from "@turing-incomplete/embed";

export function RunningCodeSection() {
  const [boardDsl, setBoardDsl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/blog-assets/rv32i-board.dsl")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch: ${r.status}`);
        return r.text();
      })
      .then(setBoardDsl)
      .catch((e) => console.error("Failed to load board DSL:", e));
  }, []);

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The Payoff: Running C
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          That&rsquo;s the whole CPU. A program counter, a decoder, an ALU,
          memory, a register file, pipeline registers between each stage, and
          forwarding/hazard logic to keep it all correct. Around 600 lines of
          circuit description &mdash; registers, muxes, and functional blocks
          wired together structurally, like a real hardware design.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Below is the complete board &mdash; CPU chip, instruction ROM, data RAM,
          memory bus, and UART &mdash; just like a real PCB. Click the{" "}
          <strong className="text-gray-900 dark:text-white">Code</strong> button
          on the ROM node to write C, Rust, or Assembly. The compiler produces a
          RISC-V binary that loads directly into the ROM. Then step the clock and
          watch your code execute through the 5-stage pipeline.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Double-click the CPU to drill into its internals &mdash; you&rsquo;ll
          see every pipeline register, every forwarding mux, every hazard signal.
          Toggle switches, inspect values, rewind time. It&rsquo;s the same
          circuit, all the way down.
        </p>
      </div>

      <div className="mt-8">
        {boardDsl ? (
          <CircuitEmbed
            dsl={boardDsl}
            height={600}
            showControls
            title="RV32I CPU Board"
            description="Click 'Code' on the ROM to load a program, then step the clock."
          />
        ) : (
          <div className="h-[600px] rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
              Loading CPU board&hellip;
            </div>
          </div>
        )}
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
