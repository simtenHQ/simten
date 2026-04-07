
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useRV32IDebugger, ABI_NAMES, type PipelineStages, type DisasmLine } from "./useRV32IDebugger";
import { explainInstruction } from "./rv32i-explain";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

const LANGUAGES = [
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "asm", label: "Assembly", monaco: "plaintext" },
  { id: "rust", label: "Rust", monaco: "rust" },
] as const;

const STARTER: Record<string, string> = {
  c: `// Fibonacci sequence — computes the 10th number.
// When done, register a0 = 55 (0x00000037).
int main() {
    int a = 0;
    int b = 1;
    for (int i = 0; i < 10; i++) {
        int tmp = a + b;
        a = b;
        b = tmp;
    }
    return a; // a0 = 55 (0x37)
}`,
  cpp: `// Fibonacci sequence — computes the 10th number.
// When done, register a0 = 55 (0x00000037).
int main() {
    int a = 0, b = 1;
    for (int i = 0; i < 10; i++) {
        int tmp = a + b;
        a = b;
        b = tmp;
    }
    return a; // a0 = 55 (0x37)
}`,
  asm: `# Simple addition: 3 + 4 = 7
# When done, register a0 = 7 (0x00000007).
.section .text
.global _start
_start:
    li a0, 3       # a0 = 3
    li a1, 4       # a1 = 4
    add a0, a0, a1 # a0 = a0 + a1 = 7 (0x07)
    li a7, 93
    ecall`,
  rust: `// Bare-metal Rust — no OS, no stdlib.
// This runs directly on the CPU hardware.
// When done, register a0 = 55 (0x00000037).
#![no_std]
#![no_main]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn main() -> i32 {
    let mut a: i32 = 0;
    let mut b: i32 = 1;
    for _ in 0..10 {
        let tmp = a + b;
        a = b;
        b = tmp;
    }
    a // returned in a0 = 55 (0x37)
}`,
};

const PIPELINE_DESCRIPTIONS: Record<keyof PipelineStages, { label: string; title: string; desc: string }> = {
  IF:  { label: "Fetch",   title: "Instruction Fetch",   desc: "Read the next instruction from memory at the current program counter (PC)." },
  ID:  { label: "Decode",  title: "Instruction Decode",  desc: "Decode the instruction, read source registers from the register file, and generate control signals." },
  EX:  { label: "Compute", title: "Execute",             desc: "The ALU performs the computation — arithmetic, logic, or address calculation." },
  MEM: { label: "Memory",  title: "Memory Access",       desc: "Load or store data in RAM. For non-memory instructions this stage passes values through unchanged." },
  WB:  { label: "Save",    title: "Write Back",          desc: "Write the result back to the destination register in the register file." },
};

const PIPELINE_COLORS: Record<keyof PipelineStages, string> = {
  IF:  "bg-purple-500/20 text-purple-300 border-purple-500/40",
  ID:  "bg-blue-500/20 text-blue-300 border-blue-500/40",
  EX:  "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  MEM: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  WB:  "bg-green-500/20 text-green-300 border-green-500/40",
};

function hex(n: number): string {
  return "0x" + n.toString(16).padStart(8, "0");
}

/**
 * Generate a plain-English narrative of what the pipeline is doing this cycle.
 * Focuses on the most interesting stage activity.
 */
function describeCurrentCycle(
  stages: PipelineStages,
  disasmLines: DisasmLine[],
  cycleCount: number,
): string | null {
  if (cycleCount === 0) return "Press Step to advance one clock cycle, or Run to execute continuously.";

  const parts: string[] = [];

  // Describe EX stage — this is where computation happens
  if (stages.EX != null) {
    const line = disasmLines.find(l => l.address === stages.EX && l.instruction);
    if (line) {
      const explanation = explainInstruction(line.instruction);
      if (explanation) {
        parts.push(explanation);
      }
    }
  }

  // Mention WB if a register is being written
  if (stages.WB != null) {
    const line = disasmLines.find(l => l.address === stages.WB && l.instruction);
    if (line) {
      const explanation = explainInstruction(line.instruction);
      if (explanation && explanation.includes("=")) {
        // Only mention WB if it's distinct from EX
        if (stages.EX !== stages.WB) {
          parts.push("Writing result to register file.");
        }
      }
    }
  }

  if (parts.length === 0) {
    // Pipeline is filling or flushing
    const activeCount = Object.values(stages).filter(v => v != null).length;
    if (activeCount === 0) return "Pipeline is empty — all instructions have completed.";
    if (activeCount < 5) return "Pipeline is filling — instructions flow through one stage per cycle.";
    return null;
  }

  return parts.join(" ");
}

function PipelineBadge({
  stage,
  pc,
  instruction,
}: {
  stage: keyof PipelineStages;
  pc: number | null;
  instruction: string | null;
}) {
  const color = PIPELINE_COLORS[stage];
  const { label, title, desc } = PIPELINE_DESCRIPTIONS[stage];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex flex-col rounded-lg border px-2 py-1.5 cursor-help min-w-0 flex-1 ${color}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold">{label}</span>
            <span className="text-[9px] font-mono opacity-40">{stage}</span>
          </div>
          <span className="font-mono text-[10px] tabular-nums opacity-40">
            {pc != null ? hex(pc) : <span className="opacity-30">——</span>}
          </span>
          <span className="mt-0.5 text-[10px] leading-tight">
            {instruction ?? <span className="opacity-20">——</span>}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-80">{desc}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DisasmPane({
  lines,
  stages,
}: {
  lines: DisasmLine[];
  stages: PipelineStages;
}) {
  const activePCs = new Set(
    Object.values(stages).filter((v): v is number => v != null)
  );

  const stageByPC = new Map<number, (keyof PipelineStages)[]>();
  for (const [stage, pc] of Object.entries(stages)) {
    if (pc != null) {
      const existing = stageByPC.get(pc) ?? [];
      existing.push(stage as keyof PipelineStages);
      stageByPC.set(pc, existing);
    }
  }

  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stages.IF]);

  return (
    <TooltipProvider delayDuration={400}>
    <div className="h-full overflow-y-auto font-mono text-xs leading-6">
      {lines.length === 0 ? (
        <div className="flex h-full items-center justify-center text-gray-600">
          Compile code to see disassembly
        </div>
      ) : (
        lines.map((line, i) => {
          if (line.label != null && line.instruction === "") {
            return (
              <div key={i} className="mt-3 px-4 text-amber-400 first:mt-0">
                {"<"}{line.label}{">"}:
              </div>
            );
          }
          const isActive = activePCs.has(line.address);
          const stagesHere = stageByPC.get(line.address) ?? [];
          const explanation = explainInstruction(line.instruction);
          const row = (
            <div
              ref={isActive ? activeRef : undefined}
              className={`flex items-center gap-3 px-4 transition-colors ${
                isActive ? "bg-blue-500/10" : "hover:bg-gray-800/40"
              } ${explanation ? "cursor-help" : ""}`}
            >
              <span className="w-20 shrink-0 text-gray-600 tabular-nums">
                {line.address.toString(16).padStart(8, "0")}
              </span>
              <span className={`flex-1 ${isActive ? "text-white" : "text-gray-400"}`}>
                {line.instruction}
              </span>
              <div className="flex shrink-0 gap-1">
                {stagesHere.map((s) => (
                  <span
                    key={s}
                    className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase border ${PIPELINE_COLORS[s]}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
          if (!explanation) return row;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>{row}</TooltipTrigger>
              <TooltipContent side="right" className="max-w-64">
                {explanation}
              </TooltipContent>
            </Tooltip>
          );
        })
      )}
    </div>
    </TooltipProvider>
  );
}

function RegisterFile({ registers, changed }: { registers: Map<number, number>; changed: Set<number> }) {
  // Show a0-a7 + t0-t6 + sp/ra first, then the rest
  const PRIORITY = [10, 11, 12, 13, 14, 15, 16, 17, 5, 6, 7, 1, 2, 28, 29, 30, 31];
  const REST = Array.from({ length: 32 }, (_, i) => i).filter(
    (i) => i !== 0 && !PRIORITY.includes(i)
  );
  const ordered = [0, ...PRIORITY, ...REST];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
      {ordered.map((i) => {
        const val = i === 0 ? 0 : (registers.get(i) ?? 0);
        const nonzero = val !== 0;
        const isChanged = changed.has(i);
        return (
          <div key={i} className={`flex items-center gap-1.5 py-0.5 rounded px-1 -mx-1 transition-colors ${isChanged ? "bg-green-500/10" : ""}`}>
            <span className={`w-7 shrink-0 text-[11px] ${isChanged ? "text-green-400" : "text-gray-500"}`}>{ABI_NAMES[i]}</span>
            <span className={`tabular-nums truncate ${isChanged ? "text-green-300" : nonzero ? "text-gray-200" : "text-gray-700"}`}>
              {hex(val)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CPUDebugger() {
  const {
    compile,
    compiling,
    compileError,
    compiled,
    sim,
    isRunning,
    setIsRunning,
    reset,
    pipelineStages,
    registers,
    changedRegisters,
    disasmLines,
  } = useRV32IDebugger();

  const [language, setLanguage] = useState<string>("c");
  const [source, setSource] = useState(STARTER.c);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setSource(STARTER[lang] ?? "");
  };

  const handleCompile = () => compile(source, language);

  const loading = !!compiled && !sim.ready;
  const narrative = sim.ready
    ? describeCurrentCycle(pipelineStages, disasmLines, sim.cycleCount)
    : null;

  return (
    <div className="flex h-full flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Intro banner — shown before first compile */}
      {!compiled && !compiling && (
        <div className="shrink-0 border-b border-blue-900/30 bg-blue-950/20 px-4 py-3">
          <p className="text-sm text-blue-200/90">
            <span className="font-semibold text-blue-100">This is a real CPU</span>
            {" "}&mdash; built from registers, ALUs, muxes, and memory, simulated cycle by cycle in your browser.
            Write code in C, C++, Rust, or assembly, compile it,
            then step through each clock cycle and watch instructions flow through the pipeline.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-2 flex-wrap border-b border-gray-800 bg-gray-900 px-3 py-2">
        <span className="text-sm font-semibold text-gray-200">RV32I CPU</span>
        <div className="h-4 w-px bg-gray-700" />

        {/* Language selector */}
        <div className="flex gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLanguageChange(l.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                language === l.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Compile button */}
        <button
          onClick={handleCompile}
          disabled={compiling}
          className="px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
        >
          {compiling ? "Compiling…" : "Compile"}
        </button>

        {/* Simulator controls — only when loaded */}
        {sim.ready && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            <button
              onClick={sim.tick}
              disabled={isRunning}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
            >
              Step
            </button>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isRunning
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-green-700 hover:bg-green-600 text-white"
              }`}
            >
              {isRunning ? "Pause" : "Run"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              Reset
            </button>
            <span className="ml-1 font-mono text-xs text-gray-500 tabular-nums">
              Cycle {sim.cycleCount.toLocaleString()}
            </span>
          </>
        )}

        {loading && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
              Building simulator…
            </div>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: code editor */}
        <div className="flex w-[35%] flex-col border-r border-gray-800">
          <div className="flex-1 min-h-0">
            <Suspense fallback={
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                className="h-full w-full resize-none bg-gray-950 font-mono text-xs text-gray-300 p-4 leading-relaxed focus:outline-none"
              />
            }>
              <MonacoEditor
                height="100%"
                language={LANGUAGES.find((l) => l.id === language)?.monaco ?? "c"}
                value={source}
                onChange={(v) => setSource(v ?? "")}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "none",
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  scrollbar: { vertical: "hidden", horizontal: "hidden" },
                  padding: { top: 12 },
                  wordWrap: "on",
                  tabSize: 4,
                  automaticLayout: true,
                }}
              />
            </Suspense>
          </div>
          {compileError && (
            <div className="shrink-0 border-t border-red-800/50 bg-red-950/20 p-3">
              <pre className="font-mono text-xs text-red-400 whitespace-pre-wrap max-h-40 overflow-auto">
                {compileError}
              </pre>
            </div>
          )}
        </div>

        {/* Right: CPU state */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Pipeline stages */}
          <div className="shrink-0 border-b border-gray-800 px-3 py-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Pipeline
            </div>
            <TooltipProvider delayDuration={300}>
              <div className="flex gap-1.5 overflow-x-auto">
                {(["IF", "ID", "EX", "MEM", "WB"] as (keyof PipelineStages)[]).map((s) => {
                  const pc = pipelineStages[s];
                  const rawInstr = pc != null
                    ? (disasmLines.find((l) => l.address === pc && l.instruction)?.instruction ?? null)
                    : null;
                  const explanation = rawInstr ? explainInstruction(rawInstr) : null;
                  const short = explanation ? explanation.split(".")[0] : (rawInstr ?? null);
                  return <PipelineBadge key={s} stage={s} pc={pc} instruction={short} />;
                })}
              </div>
            </TooltipProvider>
            {/* Narrative: what just happened this cycle */}
            {narrative && (
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                {narrative}
              </p>
            )}
          </div>

          {/* Disassembly + registers split */}
          <div className="flex flex-1 overflow-hidden">
            {/* Disassembly */}
            <div className="flex flex-[4] flex-col overflow-hidden border-r border-gray-800">
              <div className="shrink-0 border-b border-gray-800 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                Disassembly
              </div>
              <DisasmPane lines={disasmLines} stages={pipelineStages} />
            </div>

            {/* Register file */}
            <div className="flex flex-[3] flex-col overflow-hidden">
              <div className="shrink-0 border-b border-gray-800 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                Registers
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <RegisterFile registers={registers} changed={changedRegisters} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
