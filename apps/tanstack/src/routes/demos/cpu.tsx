/**
 * Demo: Compile C → Load into RV32I CPU → Tick → Watch registers
 *
 * Server: compiles C code via the compiler API, returns binary
 * Client: loads binary into CPU simulation, renders register state
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { executeComponentCode } from "@turing-incomplete/core/builder";
import { simulate } from "@turing-incomplete/core/sim";

// ============================================================================
// Server function: compile C → binary
// ============================================================================

const compileFibonacci = createServerFn({ method: "GET" }).handler(async () => {
  const source = `int main() {
    int a = 0;
    int b = 1;
    for (int i = 0; i < 10; i++) {
        int tmp = a + b;
        a = b;
        b = tmp;
    }
    return a; // a0 = 55 (0x37)
}`;

  const resp = await fetch("https://compiler.charles-harris-de.workers.dev/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, language: "c", disassemble: true }),
  });

  const result = await resp.json() as {
    success: boolean;
    binary?: string;
    disassembly?: string;
    error?: string;
  };

  if (!result.success || !result.binary) {
    throw new Error(result.error ?? "Compilation failed");
  }

  return {
    binary: result.binary,
    disassembly: result.disassembly ?? "",
  };
});

// ============================================================================
// Route
// ============================================================================

export const Route = createFileRoute("/demos/cpu")({
  loader: () => compileFibonacci(),
  component: DemoCPUPage,
});

// ============================================================================
// Client: load binary into CPU, tick, show registers
// ============================================================================

const ABI_NAMES: Record<number, string> = {
  0: "zero", 1: "ra", 2: "sp", 3: "gp", 4: "tp",
  5: "t0", 6: "t1", 7: "t2", 8: "s0", 9: "s1",
  10: "a0", 11: "a1", 12: "a2", 13: "a3", 14: "a4",
  15: "a5", 16: "a6", 17: "a7",
  18: "s2", 19: "s3", 20: "s4", 21: "s5", 22: "s6",
  23: "s7", 24: "s8", 25: "s9", 26: "s10", 27: "s11",
  28: "t3", 29: "t4", 30: "t5", 31: "t6",
};

function binaryToMemory(base64: string): Map<number, number> {
  const raw = atob(base64);
  const mem = new Map<number, number>();
  for (let i = 0; i < raw.length; i++) {
    const b = raw.charCodeAt(i);
    if (b !== 0) mem.set(i, b);
  }
  return mem;
}

function DemoCPUPage() {
  const { binary, disassembly } = Route.useLoaderData();

  // Load the RV32I CPU circuit
  const cpuSim = useMemo(() => {
    // Fetch the CPU circuit definition
    return null as any; // Will be set after fetch
  }, []);

  const [sim, setSim] = useState<ReturnType<typeof simulate> | null>(null);
  const [cycle, setCycle] = useState(0);
  const [pc, setPC] = useState(0);
  const [registers, setRegisters] = useState<Map<number, number>>(new Map());
  const [running, setRunning] = useState(false);

  // Load CPU circuit + ROM
  useEffect(() => {
    fetch("/blog-assets/rv32i-cpu.circuit.ts")
      .then(r => r.text())
      .then(code => {
        const result = executeComponentCode(code);
        if (result.error || !result.circuit) {
          console.error("Failed to load CPU:", result.error);
          return;
        }
        const comp = result.components[result.components.length - 1];
        const romData = binaryToMemory(binary);
        const s = simulate(comp);
        s.setNode("imem", romData);
        s.session.runCombinational();
        setSim(s);
      });
  }, [binary]);

  const tick = useCallback(() => {
    if (!sim) return;
    sim.tick();
    setCycle(sim.cycle);

    // Read PC from port values
    const pv = sim.session.getState().portValues;
    for (const [key, val] of pv) {
      if (key.endsWith('.q') && (key === 'pc.q' || key.includes('_pc_'))) {
        if (typeof val === 'number') setPC(val >>> 0);
        break;
      }
    }

    // Read registers from sequential state
    const seqState = sim.session.getState().sequentialState;
    if (seqState) {
      for (const [key, value] of seqState.currentState) {
        if (key === 'regfile' || key.includes('regfile')) {
          if (value instanceof Map) {
            setRegisters(new Map(value as Map<number, number>));
          }
          break;
        }
      }
    }
  }, [sim]);

  // Auto-run
  useEffect(() => {
    if (!running || !sim) return;
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [running, sim, tick]);

  const a0 = registers.get(10) ?? 0;
  const done = a0 === 55;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">C → Hardware</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Fibonacci compiled to RISC-V, running on a CPU built with <code className="text-xs bg-muted px-1 rounded">component()</code>
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: source + disassembly */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">C Source</h2>
            <pre className="text-xs font-mono bg-muted rounded p-3 mb-4 overflow-auto">{`int main() {
    int a = 0, b = 1;
    for (int i = 0; i < 10; i++) {
        int tmp = a + b;
        a = b;
        b = tmp;
    }
    return a; // → 55
}`}</pre>

            <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Disassembly</h2>
            <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-64">{disassembly}</pre>
          </div>

          {/* Right: simulation */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Simulation</h2>

            {!sim ? (
              <div className="text-sm text-muted-foreground p-4">Loading CPU...</div>
            ) : (
              <>
                {/* Controls */}
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={tick} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs">
                    Tick
                  </button>
                  <button
                    onClick={() => setRunning(!running)}
                    className={`px-3 py-1.5 rounded text-xs ${running ? "bg-amber-600 text-white" : "bg-muted text-foreground"}`}
                  >
                    {running ? "Stop" : "Run"}
                  </button>
                  <button
                    onClick={() => { sim.reset(); sim.tick(); setCycle(0); setPC(0); setRegisters(new Map()); setRunning(false); }}
                    className="px-3 py-1.5 bg-muted text-foreground rounded text-xs"
                  >
                    Reset
                  </button>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Cycle {cycle}
                  </span>
                </div>

                {/* a0 highlight */}
                <div className={`p-4 rounded-lg mb-4 border ${done ? "border-green-500 bg-green-500/10" : "border-border"}`}>
                  <div className="text-xs text-muted-foreground mb-1">Register a0 (return value)</div>
                  <div className="font-mono text-3xl font-bold">
                    {a0} <span className="text-lg text-muted-foreground">({`0x${(a0 >>> 0).toString(16).padStart(8, "0")}`})</span>
                  </div>
                  {done && <div className="text-xs text-green-500 mt-1">✓ Fibonacci(10) = 55</div>}
                </div>

                {/* PC */}
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-1">Program Counter</div>
                  <div className="font-mono text-sm">{`0x${(pc >>> 0).toString(16).padStart(8, "0")}`}</div>
                </div>

                {/* Register file */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Registers</div>
                  <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                    {Array.from({ length: 32 }, (_, i) => {
                      const val = registers.get(i) ?? 0;
                      const changed = val !== 0;
                      return (
                        <div
                          key={i}
                          className={`px-1.5 py-0.5 rounded ${changed ? "bg-blue-500/20 text-blue-300" : "text-muted-foreground/50"}`}
                        >
                          {ABI_NAMES[i]}: {val}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <h2 className="text-sm font-semibold mb-2">How it works</h2>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`// 1. Server compiles C → RISC-V binary (compiler API)
const binary = await compileFibonacci()

// 2. Client loads CPU circuit (TypeScript component)
const cpu = executeComponentCode(cpuCode)

// 3. Load binary into instruction memory
const sim = simulate(cpu)
sim.setNode("imem", binary)

// 4. Tick and read registers
sim.tick()
sim.get('pc')  // → program counter
// Register a0 = 55 after ~30 cycles`}</pre>
        </div>
      </div>
    </div>
  );
}
