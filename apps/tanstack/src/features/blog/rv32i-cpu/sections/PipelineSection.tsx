
import { CircuitEmbed } from "@simten/embed";
import { BLOG_CIRCUITS } from "../circuits";

const STAGES = [
  {
    name: "Fetch",
    color: "purple",
    abbr: "IF",
    description:
      "The program counter (PC) holds the address of the current instruction. Each cycle, it reads the instruction from memory and increments by 4 (each instruction is 4 bytes).",
    detail:
      "The simplest stage, but it sets the pace for everything else. If a branch is taken later in the pipeline, the PC gets overwritten and the fetched instruction is flushed.",
  },
  {
    name: "Decode",
    color: "blue",
    abbr: "ID",
    description:
      "The 32-bit instruction is split apart: opcode, source registers, destination register, immediate value, and function codes. The register file reads out the source values.",
    detail:
      "This is where the CPU figures out what operation to perform. A RISC-V instruction packs all of this into a fixed 32-bit format — the decode logic is just wire slicing.",
  },
  {
    name: "Execute",
    color: "cyan",
    abbr: "EX",
    description:
      "The ALU performs the operation — add, subtract, shift, compare, or compute a branch target address. This is where the actual computation happens.",
    detail:
      "The forwarding unit also lives here. If the previous instruction's result hasn't been written back yet, the forwarding mux grabs it directly instead of reading a stale value from the register file.",
  },
  {
    name: "Memory",
    color: "amber",
    abbr: "MEM",
    description:
      "Load and store instructions access data memory here. For non-memory instructions (add, shift, branch), this stage just passes values through.",
    detail:
      "Our CPU maps memory-mapped peripherals here too: a UART for serial output and a network interface for inter-CPU communication.",
  },
  {
    name: "Write Back",
    color: "green",
    abbr: "WB",
    description:
      "The result — whether from the ALU or a memory load — is written back to the destination register in the register file. The instruction is now complete.",
    detail:
      "Five stages means five instructions are in flight simultaneously. While one instruction writes back, the next is accessing memory, the next is computing, the next is decoding, and the next is being fetched.",
  },
];

const STAGE_COLORS: Record<string, string> = {
  purple: "bg-purple-500/10 border-purple-500/30 text-purple-300",
  blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  green: "bg-green-500/10 border-green-500/30 text-green-300",
};

const ABBR_COLORS: Record<string, string> = {
  purple: "bg-purple-500/20 text-purple-300",
  blue: "bg-blue-500/20 text-blue-300",
  cyan: "bg-cyan-500/20 text-cyan-300",
  amber: "bg-amber-500/20 text-amber-300",
  green: "bg-green-500/20 text-green-300",
};

export function PipelineSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        The 5-Stage Pipeline
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A single-cycle CPU executes one instruction per clock cycle &mdash;
          fetch, decode, execute, memory, writeback, all at once. Simple, but
          slow. The clock can only tick as fast as the{" "}
          <strong className="text-gray-900 dark:text-white">slowest instruction</strong> allows.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          A pipelined CPU splits execution into{" "}
          <strong className="text-gray-900 dark:text-white">stages</strong>, separated by
          registers. Each stage does one piece of the work, then passes its
          result to the next stage on the clock edge. Like an assembly line:
          while one instruction is being executed, the next is being decoded,
          and the one after that is being fetched.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The result: <strong className="text-gray-900 dark:text-white">5 instructions in flight at once</strong>.
          The clock can tick as fast as the slowest <em>stage</em>, not the
          slowest instruction. In practice, this roughly quintuples throughput.
        </p>
      </div>

      {/* Pipeline stage cards */}
      <div className="mt-8 space-y-4">
        {STAGES.map((stage) => (
          <div
            key={stage.abbr}
            className={`rounded-xl border p-5 ${STAGE_COLORS[stage.color]}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold ${ABBR_COLORS[stage.color]}`}
              >
                {stage.abbr}
              </span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {stage.name}
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
              {stage.description}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed mt-2">
              {stage.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Program Counter circuit */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          The Program Counter
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          The simplest piece of the pipeline: a register that counts up by 4
          each cycle. Toggle the stall switch to freeze it &mdash; that&rsquo;s
          what happens when a hazard is detected.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          In the full CPU, the PC doesn&rsquo;t always increment by 4. A mux selects
          between three sources: <strong className="text-gray-900 dark:text-gray-200">PC + 4</strong> for
          sequential execution, <strong className="text-gray-900 dark:text-gray-200">PC + immediate</strong> for
          branches and JAL, or <strong className="text-gray-900 dark:text-gray-200">register + immediate</strong> for
          JALR (indirect jumps). When a branch is taken, the pipeline flushes the
          wrongly-fetched instructions and redirects to the target address.
        </p>
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.programCounter.circuit}
          height={300}
          title="Program Counter"
          description="Increments by 4 each clock cycle. Stall freezes the count."
        />

        <div className="mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Here&rsquo;s the full version with the mux. Toggle <strong className="text-gray-900 dark:text-gray-200">branch</strong> to
            redirect the PC to address 0x100, <strong className="text-gray-900 dark:text-gray-200">jump</strong> to
            redirect to 0x400, or <strong className="text-gray-900 dark:text-gray-200">stall</strong> to freeze it entirely (like a load-use hazard).
            Turn them off and the PC resumes incrementing by 4 from wherever it landed.
          </p>
          <CircuitEmbed
            circuit={BLOG_CIRCUITS.pcWithMux.circuit}
            height={340}
            showControls
            title="PC with Next-PC Mux"
            description="Toggle stall/branch/jump to see the three PC control paths."
          />
        </div>
      </div>

      {/* Pipeline Register circuit */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Pipeline Registers
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Between every stage sits a pipeline register. It latches the
          output of one stage on the clock edge, holding it stable for the
          next stage to read. The flush input zeros the register &mdash;
          used when a branch is taken and the partially-fetched instruction
          must be discarded.
        </p>
        <CircuitEmbed
          circuit={BLOG_CIRCUITS.pipelineRegister.circuit}
          height={300}
          title="Pipeline Register"
          description="Latches data between stages. Flush clears to zero."
        />
      </div>
    </section>
  );
}
