
import { Link } from "@tanstack/react-router";
import { CircuitEmbed } from "@simten/embed";
import { RV32I_Board } from "../rv32i-board.circuit";

export function RunningCodeSection() {
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
        <CircuitEmbed
          circuit={RV32I_Board}
          showControls
          title="RV32I CPU Board"
          description="Click 'Code' on the ROM to load a program, then step the clock."
        />
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/cpu/rv32i"
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          Open full-screen debugger &rarr;
        </Link>
      </div>
    </section>
  );
}
