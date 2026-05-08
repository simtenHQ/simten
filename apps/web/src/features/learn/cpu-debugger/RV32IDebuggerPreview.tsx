/**
 * Static, non-interactive snapshot of the RV32I CPU debugger UI.
 *
 * Used as a hero illustration on the landing page. Reuses the same Tailwind
 * palette and panel structure as the real <CPUDebugger />, but skips Monaco
 * and the simulator hook. Stays sharp at any zoom (no PNG pixelation).
 */

import { HighlightedCode } from "@/components/HighlightedCode";

const PIPELINE_COLORS = {
  IF:  "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40",
  ID:  "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40",
  EX:  "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40",
  MEM: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
  WB:  "bg-green-100 text-green-800 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40",
} as const;

const STAGES: { key: keyof typeof PIPELINE_COLORS; label: string; pc: string; instr: string }[] = [
  { key: "IF",  label: "Fetch",   pc: "0x00000010", instr: "Load immediate: set a0 = 55" },
  { key: "ID",  label: "Decode",  pc: "0x0000000c", instr: "Jump: unconditionally jump to 0xc" },
  { key: "EX",  label: "Compute", pc: "0x00000000", instr: "Add upper immediate to PC: sp = PC + (0x20 << 12)" },
  { key: "MEM", label: "Memory",  pc: "0x00000010", instr: "Load immediate: set a0 = 55" },
  { key: "WB",  label: "Save",    pc: "0x0000000c", instr: "Jump: unconditionally jump to 0xc" },
];

const NARRATIVE =
  "Add upper immediate to PC: sp = PC + (0x20 << 12). Used to compute addresses relative to the current instruction.";

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

type DisasmTag = keyof typeof PIPELINE_COLORS;
type DisasmRow =
  | { kind: "label"; text: string }
  | { kind: "instr"; addr: string; text: string; tags?: DisasmTag[]; active?: boolean };

const DISASM: DisasmRow[] = [
  { kind: "label", text: "<_start>:" },
  { kind: "instr", addr: "00000000", text: "auipc sp,0x20",      tags: ["EX"] },
  { kind: "instr", addr: "00000004", text: "mv sp,sp" },
  { kind: "instr", addr: "00000008", text: "jal 10 <main>" },
  { kind: "instr", addr: "0000000c", text: "j c <_start+0xc>", tags: ["ID", "WB"], active: true },
  { kind: "label", text: "<main>:" },
  { kind: "instr", addr: "00000010", text: "li a0,55",          tags: ["IF", "MEM"] },
  { kind: "instr", addr: "00000014", text: "ret" },
];

function PipelineBadge({ stage }: { stage: typeof STAGES[number] }) {
  const color = PIPELINE_COLORS[stage.key];
  return (
    <div className={`flex flex-col rounded-lg border px-3 py-2 min-w-0 flex-1 ${color}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] font-semibold">{stage.label}</span>
        <span className="text-[10px] font-mono opacity-50">{stage.key}</span>
      </div>
      <span className="font-mono text-[11px] tabular-nums opacity-60 mt-0.5">{stage.pc}</span>
      <span className="mt-1 text-[11px] leading-tight truncate">{stage.instr}</span>
    </div>
  );
}

function StageTag({ stage }: { stage: DisasmTag }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-semibold border ${PIPELINE_COLORS[stage]}`}
    >
      {stage}
    </span>
  );
}

export function RV32IDebuggerPreview() {
  return (
    <div
      className="select-none pointer-events-none flex flex-col h-full bg-card text-foreground"
      aria-hidden="true"
    >
      {/* Pipeline strip */}
      <div className="px-4 pt-4 pb-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-2">
          Pipeline
        </div>
        <div className="flex gap-2">
          {STAGES.map((s) => (
            <PipelineBadge key={s.key} stage={s} />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground/80 leading-snug">
          {NARRATIVE}
        </p>
      </div>

      {/* Two-pane body: Rust source + Disassembly */}
      <div className="flex-1 grid grid-cols-[3fr_2fr] gap-px bg-border/40 mt-2 overflow-hidden">
        {/* Rust source */}
        <div className="bg-card overflow-hidden">
          <div className="flex font-mono text-[12px] leading-6">
            {/* Line numbers */}
            <div className="px-3 py-2 text-right text-muted-foreground/40 tabular-nums shrink-0 select-none">
              {RUST_SOURCE.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Highlighted source */}
            <HighlightedCode
              code={RUST_SOURCE}
              className="flex-1 px-2 py-2 m-0 overflow-hidden"
            />
          </div>
        </div>

        {/* Disassembly */}
        <div className="bg-card overflow-hidden">
          <div className="px-4 pt-2 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
            Disassembly
          </div>
          <div className="font-mono text-[12px] leading-6">
            {DISASM.map((row, i) => {
              if (row.kind === "label") {
                return (
                  <div key={i} className="px-4 py-1 text-amber-700 dark:text-amber-400/90">
                    {row.text}
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-0.5 ${
                    row.active ? "bg-blue-500/10" : ""
                  }`}
                >
                  <span className="text-muted-foreground/50 tabular-nums w-[7ch] shrink-0">
                    {row.addr}
                  </span>
                  <span className="flex-1 text-foreground/90">{row.text}</span>
                  {row.tags ? (
                    <span className="flex items-center gap-1 shrink-0">
                      {row.tags.map((t) => (
                        <StageTag key={t} stage={t} />
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
