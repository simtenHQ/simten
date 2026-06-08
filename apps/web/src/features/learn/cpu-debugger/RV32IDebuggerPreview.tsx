/**
 * Choreographed RV32I CPU debugger teaser for the landing page.
 *
 * Not the real simulator (that lives at /cpu/rv32i) — a lightweight, canned
 * loop that tells a legible 3-act story so a visitor understands what they're
 * seeing without CPU knowledge:
 *   1. Compile  — Rust → RISC-V (spinner beat)
 *   2. Execute  — instructions step through the 5-stage pipeline; the active
 *                 disassembly line advances; a plain-English narration line
 *                 says what each instruction does
 *   3. Result   — the payoff: a0 = 55
 * No Monaco, no simulator hook. Responsive: desktop shows the full debugger
 * (pipeline + Rust source beside the disassembly); mobile drops the source.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { HighlightedCode } from "@/components/HighlightedCode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PIPELINE_COLORS = {
  IF:  "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40",
  ID:  "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40",
  EX:  "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40",
  MEM: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
  WB:  "bg-green-100 text-green-800 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40",
} as const;

type StageKey = keyof typeof PIPELINE_COLORS;

const STAGE_META: { key: StageKey; label: string; desc: string }[] = [
  { key: "IF",  label: "Fetch",   desc: "Instruction Fetch — read the next instruction word from memory at the program counter." },
  { key: "ID",  label: "Decode",  desc: "Instruction Decode — split the instruction into opcode, register operands, and immediate; read source registers." },
  { key: "EX",  label: "Execute", desc: "Execute — the ALU computes results, branches evaluate, and memory addresses are calculated." },
  { key: "MEM", label: "Memory",  desc: "Memory Access — load from or store to data memory." },
  { key: "WB",  label: "Save",    desc: "Write Back — write the result into the destination register." },
];

type DisasmRow =
  | { kind: "label"; text: string }
  | { kind: "instr"; addr: string; text: string; note: string };

const DISASM: DisasmRow[] = [
  { kind: "label", text: "<_start>:" },
  { kind: "instr", addr: "00000000", text: "auipc sp,0x20",     note: "Compute the stack pointer from the program counter" },
  { kind: "instr", addr: "00000004", text: "mv sp,sp",          note: "Finish setting up the stack pointer" },
  { kind: "instr", addr: "00000008", text: "jal 10 <main>",     note: "Jump and link into main()" },
  { kind: "instr", addr: "0000000c", text: "j c <_start+0xc>",  note: "Loop" },
  { kind: "label", text: "<main>:" },
  { kind: "instr", addr: "00000010", text: "li a0,55",          note: "Load the value 55 into register a0" },
  { kind: "instr", addr: "00000014", text: "ret",               note: "Return — a0 holds the result" },
];

// Execution order: DISASM indices of the instructions actually run, in order.
const EXEC = [1, 2, 3, 6, 7];

const RUST_SOURCE = `// Bare-metal Rust — no OS, no stdlib.
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
    for _ in 0..10 {`;

const mod_ = (n: number, m: number) => ((n % m) + m) % m;

function instrAt(disasmIndex: number) {
  return DISASM[disasmIndex] as Extract<DisasmRow, { kind: "instr" }>;
}

// 3-act timeline, in ticks. compile → execute (one tick per instruction) → result.
const TICK_MS = 1200;
const COMPILE_TICKS = 2;
const RESULT_TICKS = 2;
const CYCLE = COMPILE_TICKS + EXEC.length + RESULT_TICKS;

type Phase = "compiling" | "executing" | "done";

function phaseFor(tick: number): { phase: Phase; step: number } {
  const t = mod_(tick, CYCLE);
  if (t < COMPILE_TICKS) return { phase: "compiling", step: 0 };
  if (t < COMPILE_TICKS + EXEC.length) return { phase: "executing", step: t - COMPILE_TICKS };
  return { phase: "done", step: EXEC.length - 1 };
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />;
}

export function RV32IDebuggerPreview() {
  const [tick, setTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Only run while the demo is on screen, and restart the story from act 1
  // each time it scrolls into view — so a visitor always catches the full
  // compile → execute → result arc rather than landing mid-cycle.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let id: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (id) { clearInterval(id); id = null; }
    };
    const start = () => {
      if (id) return;
      if (reduce) { setTick(COMPILE_TICKS); return; } // park on a static frame
      setTick(0);
      id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    };

    const obs = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => { stop(); obs.disconnect(); };
  }, []);

  const { phase, step } = phaseFor(tick);
  const showPipeline = phase !== "compiling";

  // 5 instructions in flight: stage i holds the instruction fetched i ticks ago.
  const stageInstr = STAGE_META.map((_, i) =>
    showPipeline ? instrAt(EXEC[mod_(step - i, EXEC.length)]) : null,
  );
  const activeIndex = phase === "executing" ? EXEC[step] : -1;

  // Plain-English narration of the current step.
  const narration =
    phase === "compiling"
      ? { node: <Spinner />, text: "Compiling Rust to RISC-V…" }
      : phase === "done"
        ? { node: <span className="text-emerald-500">✓</span>, text: "Done — a0 = 55 (0x00000037)" }
        : { node: <span className="text-blue-500">▸</span>, text: instrAt(EXEC[step]).note };

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={rootRef} className="select-none flex flex-col h-full bg-card text-foreground">
        {/* ---- Desktop pipeline badges ---- */}
        <div className="hidden sm:block px-4 pt-4 pb-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-2">
            Pipeline
          </div>
          <div className="flex gap-2">
            {STAGE_META.map((s, i) => (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex flex-col rounded-lg border px-3 py-2 min-w-0 flex-1 cursor-help transition-all ${PIPELINE_COLORS[s.key]} ${stageInstr[i] ? "" : "opacity-40"} ${stageInstr[i] && i === 0 ? "ring-2 ring-offset-1 ring-offset-card ring-current/40" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold">{s.label}</span>
                      <span className="text-[10px] font-mono opacity-50">{s.key}</span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums opacity-60 mt-0.5">
                      {stageInstr[i] ? `0x${stageInstr[i]!.addr}` : "—"}
                    </span>
                    <span className="mt-1 text-[11px] leading-tight truncate font-mono">
                      {stageInstr[i] ? stageInstr[i]!.text : " "}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  {s.desc}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {/* Narration line — plain English, what's happening right now */}
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground/90 leading-snug">
            {narration.node}
            <span>{narration.text}</span>
          </p>
        </div>

        {/* ---- Mobile pipeline chips + narration ---- */}
        <div className="sm:hidden px-4 pt-4 pb-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-2">
            Pipeline
          </div>
          <div className="flex gap-1.5">
            {STAGE_META.map((s, i) => (
              <span
                key={s.key}
                className={`flex-1 text-center rounded-md border py-1 text-[11px] font-mono font-semibold transition-all ${PIPELINE_COLORS[s.key]} ${stageInstr[i] ? (i === 0 ? "ring-2 ring-current/40" : "opacity-60") : "opacity-30"}`}
              >
                {s.key}
              </span>
            ))}
          </div>
          <p className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground/90">
            {narration.node}
            <span>{narration.text}</span>
          </p>
        </div>

        {/* ---- Body: source (desktop only) + disassembly / compile spinner ---- */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-px bg-border/40 sm:mt-2 overflow-hidden">
          {/* Rust source — desktop only */}
          <div className="hidden sm:block bg-card overflow-hidden">
            <div className="flex font-mono text-[12px] leading-6">
              <div className="px-3 py-2 text-right text-muted-foreground/40 tabular-nums shrink-0 select-none">
                {RUST_SOURCE.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <HighlightedCode code={RUST_SOURCE} className="flex-1 px-2 py-2 m-0 overflow-hidden" />
            </div>
          </div>

          {/* Disassembly — or the compile spinner during act 1 */}
          <div className="bg-card overflow-hidden min-h-[180px]">
            <div className="px-4 pt-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
              Disassembly
            </div>
            {phase === "compiling" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground/70">
                <Spinner />
                <span className="text-[12px] font-mono">Compiling to RISC-V…</span>
              </div>
            ) : (
              <div className="font-mono text-[12px] leading-5 pb-2">
                {DISASM.map((row, i) => {
                  if (row.kind === "label") {
                    return (
                      <div key={i} className="px-4 py-0.5 text-amber-700 dark:text-amber-400/90">
                        {row.text}
                      </div>
                    );
                  }
                  const isActive = i === activeIndex;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-4 whitespace-nowrap transition-colors ${isActive ? "bg-blue-500/10" : ""}`}
                    >
                      <span className={`tabular-nums shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/50"}`}>
                        {isActive ? "▸" : " "} {row.addr}
                      </span>
                      <span className={isActive ? "flex-1 text-foreground font-medium" : "flex-1 text-foreground/90"}>
                        {row.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
