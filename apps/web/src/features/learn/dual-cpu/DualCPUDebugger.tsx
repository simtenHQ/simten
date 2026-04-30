
import { useState, useRef, useEffect } from "react";
import { useRV32IDualCPU, type NicMessage } from "./useRV32IDualCPU";

const LANGUAGES = [
  { id: "c",    label: "C" },
  { id: "cpp",  label: "C++" },
  { id: "asm",  label: "Assembly" },
  { id: "rust", label: "Rust" },
] as const;

const CPU0_STARTER = `// Computer 0: sends 42 to Computer 1
int main() {
    volatile int *tx  = (volatile int *)0x80001000;
    volatile int *end = (volatile int *)0x8000100C;
    volatile int *rx    = (volatile int *)0x80002000;
    volatile int *pop   = (volatile int *)0x80002004;
    volatile int *count = (volatile int *)0x80002008;

    *tx = 42;   // send
    *end = 1;

    while (*count == 0) {} // wait for reply
    int reply = *rx;
    *pop = 1;

    return reply; // expect 84
}`;

const CPU1_STARTER = `// Computer 1: receives a value, doubles it, sends back
int main() {
    volatile int *rx    = (volatile int *)0x80002000;
    volatile int *pop   = (volatile int *)0x80002004;
    volatile int *count = (volatile int *)0x80002008;
    volatile int *tx    = (volatile int *)0x80001000;
    volatile int *end   = (volatile int *)0x8000100C;

    while (*count == 0) {} // wait
    int val = *rx;
    *pop = 1;

    *tx = val * 2; // send back doubled
    *end = 1;

    return 0;
}`;

// ─── Computer Panel ───────────────────────────────────────────────────────────

function ComputerPanel({
  index,
  cpu,
  language,
  source,
  onLanguageChange,
  onSourceChange,
  onCompile,
  isRunning,
  cycleCount,
}: {
  index: 0 | 1;
  cpu: ReturnType<typeof useRV32IDualCPU>["cpu0"];
  language: string;
  source: string;
  onLanguageChange: (lang: string) => void;
  onSourceChange: (src: string) => void;
  onCompile: () => void;
  isRunning: boolean;
  cycleCount: number;
}) {
  const isBlue = index === 0;
  const border = isBlue ? "border-blue-800/50" : "border-violet-800/50";
  const headerBg = isBlue ? "bg-blue-950/40" : "bg-violet-950/40";
  const dot = isBlue ? "bg-blue-400" : "bg-violet-400";
  const label = isBlue ? "text-blue-300" : "text-violet-300";
  const compileBg = isBlue ? "bg-blue-700 hover:bg-blue-600" : "bg-violet-700 hover:bg-violet-600";

  const isActive = isRunning && cpu.compiled != null;

  return (
    <div className={`flex flex-col h-full overflow-hidden rounded-xl border ${border}`}>
      {/* Header */}
      <div className={`shrink-0 flex items-center gap-2.5 px-4 py-3 ${headerBg} border-b ${border}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${dot} ${isActive ? "animate-pulse" : ""}`} />
        <span className={`text-sm font-bold ${label}`}>Computer {index}</span>
        <div className="flex gap-0.5 ml-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => onLanguageChange(l.id)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                language === l.id
                  ? "bg-gray-600 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={onCompile}
          disabled={cpu.compiling}
          className={`ml-auto px-3 py-1 rounded text-xs font-semibold ${compileBg} text-white transition-colors disabled:opacity-40`}
        >
          {cpu.compiling ? "Compiling…" : "Compile"}
        </button>
      </div>

      {/* Code editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <textarea
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-gray-950 font-mono text-[10px] text-gray-300 p-3 leading-relaxed focus:outline-none"
        />
        {cpu.compileError && (
          <div className="shrink-0 border-t border-red-800/40 bg-red-950/20 px-3 py-2">
            <pre className="font-mono text-[9px] text-red-400 whitespace-pre-wrap max-h-16 overflow-auto">
              {cpu.compileError}
            </pre>
          </div>
        )}
      </div>

      {/* Status footer */}
      <div className={`shrink-0 border-t ${border} px-4 py-2 flex items-center gap-2`}>
        {cpu.compiled ? (
          isActive ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">running</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span className="text-[10px] text-gray-500">ready</span>
            </>
          )
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
            <span className="text-[10px] text-gray-600">not compiled</span>
          </>
        )}
        {cpu.compiled && (
          <span className="ml-auto text-[9px] text-gray-600 font-mono">
            {cycleCount} cycles
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Message Wire ─────────────────────────────────────────────────────────────

function MessageWire({ messages }: { messages: NicMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-gray-700/50 bg-gray-900/30">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-3 py-3 border-b border-gray-800">
        <div className={`w-1.5 h-1.5 rounded-full ${messages.length > 0 ? "bg-green-400" : "bg-gray-600"}`} />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Network
        </span>
      </div>

      {/* Wire diagram */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-800/60">
        <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
        <div className="flex-1 relative h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 via-gray-500/30 to-violet-500/50" />
        </div>
        <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
      </div>

      {/* Message log */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <div className="text-2xl opacity-20">📡</div>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Compile both computers<br />and run to see messages
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: NicMessage }) {
  const fromLeft = msg.from === 0;
  return (
    <div className={`flex flex-col gap-0.5 ${fromLeft ? "items-start" : "items-end"}`}>
      <div className="flex items-center gap-1 px-1">
        <span className={`text-[8px] font-medium ${fromLeft ? "text-blue-500" : "text-violet-500"}`}>
          {fromLeft ? "C0 → C1" : "C1 → C0"}
        </span>
        <span className="text-[8px] text-gray-700">c{msg.cycle}</span>
      </div>
      <div
        className={`px-3 py-1.5 rounded-xl font-mono ${
          fromLeft
            ? "bg-blue-900/60 border border-blue-700/40 rounded-tl-sm"
            : "bg-violet-900/60 border border-violet-700/40 rounded-tr-sm"
        }`}
      >
        <span className={`text-base font-bold ${fromLeft ? "text-blue-200" : "text-violet-200"}`}>
          {msg.value >>> 0}
        </span>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function DualCPUDebugger() {
  const state = useRV32IDualCPU();
  const { sim, isRunning, setIsRunning, reset, nicMessages } = state;

  const [cpu0Lang, setCpu0Lang] = useState("c");
  const [cpu0Src, setCpu0Src] = useState(CPU0_STARTER);
  const [cpu1Lang, setCpu1Lang] = useState("c");
  const [cpu1Src, setCpu1Src] = useState(CPU1_STARTER);

  const loading = state.bothCompiled && !sim.ready;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-gray-900 px-5 py-2.5">
        <span className="text-sm font-semibold text-gray-200">RV32I Dual CPU</span>
        <span className="text-xs text-gray-600 hidden sm:block">Two RISC-V computers connected by a NIC</span>

        {sim.ready && (
          <>
            <div className="h-4 w-px bg-gray-800 ml-auto" />
            <button
              onClick={sim.tick}
              disabled={isRunning}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-40"
            >
              Step
            </button>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                isRunning
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white"
              }`}
            >
              {isRunning ? "Pause" : "Run"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              Reset
            </button>
            <span className="font-mono text-xs text-gray-500 tabular-nums w-20 text-right">
              {sim.cycleCount.toLocaleString()} cycles
            </span>
          </>
        )}

        {!sim.ready && (
          <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
            {loading && <div className="h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />}
            {state.bothCompiled ? "Building simulator…" : "Compile both computers to start"}
          </div>
        )}
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3">
        <div className="flex flex-col flex-1 min-w-0">
          <ComputerPanel
            index={0}
            cpu={state.cpu0}
            language={cpu0Lang}
            source={cpu0Src}
            onLanguageChange={setCpu0Lang}
            onSourceChange={setCpu0Src}
            onCompile={() => state.compile(0, cpu0Src, cpu0Lang)}
            isRunning={isRunning}
            cycleCount={sim.cycleCount}
          />
        </div>

        <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: "220px" }}>
          <MessageWire messages={nicMessages} />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <ComputerPanel
            index={1}
            cpu={state.cpu1}
            language={cpu1Lang}
            source={cpu1Src}
            onLanguageChange={setCpu1Lang}
            onSourceChange={setCpu1Src}
            onCompile={() => state.compile(1, cpu1Src, cpu1Lang)}
            isRunning={isRunning}
            cycleCount={sim.cycleCount}
          />
        </div>
      </div>
    </div>
  );
}
