"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCircuitSimulator } from "@turing-incomplete/embed";

// ABI register names for RV32I
export const ABI_NAMES: Record<number, string> = {
  0: "zero", 1: "ra",   2: "sp",   3: "gp",
  4: "tp",   5: "t0",   6: "t1",   7: "t2",
  8: "s0",   9: "s1",   10: "a0",  11: "a1",
  12: "a2",  13: "a3",  14: "a4",  15: "a5",
  16: "a6",  17: "a7",  18: "s2",  19: "s3",
  20: "s4",  21: "s5",  22: "s6",  23: "s7",
  24: "s8",  25: "s9",  26: "s10", 27: "s11",
  28: "t3",  29: "t4",  30: "t5",  31: "t6",
};

export interface DisasmLine {
  address: number;
  label?: string;
  instruction: string;
}

export interface PipelineStages {
  IF: number | null;  // pc.q (the PC being fetched)
  ID: number | null;  // ifid_pc.q
  EX: number | null;  // idex_pc.q
  MEM: number | null; // exmem_pc4.q - 4
  WB: number | null;  // memwb_pc4.q - 4
}

/** Parse objdump -d output into structured lines */
export function parseDisassembly(text: string): DisasmLine[] {
  const lines: DisasmLine[] = [];
  for (const raw of text.split("\n")) {
    // Label line: "00000000 <main>:"
    const labelMatch = raw.match(/^([0-9a-f]+)\s+<([^>]+)>:/);
    if (labelMatch) {
      lines.push({
        address: parseInt(labelMatch[1], 16),
        label: labelMatch[2],
        instruction: "",
      });
      continue;
    }
    // Instruction line: "   0:	li      a0,7"
    const instrMatch = raw.match(/^\s+([0-9a-f]+):\s+(.+)$/);
    if (instrMatch) {
      lines.push({
        address: parseInt(instrMatch[1], 16),
        instruction: instrMatch[2].trim(),
      });
    }
  }
  return lines;
}

/** Convert base64-encoded binary to a Map for loading into ROM via setNodeValue */
function binaryToROM(base64: string): Map<number, number> {
  const raw = atob(base64);
  const m = new Map<number, number>();
  for (let i = 0; i < raw.length; i++) {
    const b = raw.charCodeAt(i);
    if (b !== 0) m.set(i, b);
  }
  return m;
}

/** Read a 32-bit port value from portValues by node label + port name.
 *  Node IDs are mangled: RV32I_CPU_ifid_pc_<timestamp>_<random>.q
 *  so we match by _nodeLabel_ substring + .portName suffix.
 */
function readPort(
  portValues: ReadonlyMap<string, boolean | number> | null,
  nodeLabel: string,
  portName: string
): number | null {
  if (!portValues) return null;
  const val = portValues.get(`${nodeLabel}.${portName}`);
  if (val === undefined) return null;
  return typeof val === "number" ? (val >>> 0) : null;
}

export interface CompileResult {
  binary: string; // base64
  disassembly: string;
}

export function useRV32IDebugger() {
  const dslCacheRef = useRef<string | null>(null);
  const [dslCode, setDslCode] = useState<string | null>(null);
  const [dslError, setDslError] = useState<string | null>(null);

  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [romData, setRomData] = useState<Map<number, number> | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch CPU circuit once
  useEffect(() => {
    if (dslCacheRef.current) return;
    fetch("/blog-assets/rv32i-cpu.circuit.ts")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load CPU: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        dslCacheRef.current = text;
        setDslCode(text);
      })
      .catch((e) => setDslError(e.message));
  }, []);

  const sim = useCircuitSimulator(dslCode ?? "");

  // Load ROM data into imem via setNodeValue when ready
  useEffect(() => {
    if (!sim.ready || !romData) return;
    sim.setNodeValue("imem", romData);
    sim.runCombinational();
  }, [sim.ready, romData]);

  // Auto-run
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(() => sim.tick(), 100);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, sim.ready, sim.tick]);

  const compile = useCallback(async (source: string, language: string) => {
    setCompiling(true);
    setCompileError(null);
    setIsRunning(false);
    try {
      const resp = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, language, disassemble: true }),
      });
      const data = await resp.json() as {
        success: boolean;
        binary?: string; // Go []byte → base64 in JSON
        disassembly?: string;
        stderr?: string;
        error?: string;
      };
      if (!data.success || !data.binary) {
        setCompileError(data.stderr ?? data.error ?? "Compilation failed");
        return;
      }
      const result: CompileResult = {
        binary: data.binary,
        disassembly: data.disassembly ?? "",
      };
      setCompiled(result);
      setRomData(binaryToROM(data.binary));
    } catch (e) {
      setCompileError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompiling(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    sim.reset();
  }, [sim.reset]);

  // Extract pipeline stage PCs from portValues
  const pipelineStages: PipelineStages = {
    IF:  readPort(sim.portValues, "pc",         "q"),
    ID:  readPort(sim.portValues, "ifid_pc",    "q"),
    EX:  readPort(sim.portValues, "idex_pc",    "q"),
    MEM: (() => { const v = readPort(sim.portValues, "exmem_pc4",  "q"); return v != null ? (v - 4) >>> 0 : null; })(),
    WB:  (() => { const v = readPort(sim.portValues, "memwb_pc4",  "q"); return v != null ? (v - 4) >>> 0 : null; })(),
  };

  // Extract register file from sequential state
  const registers: Map<number, number> = (() => {
    if (!sim.sequentialState?.currentState) return new Map();
    const value = sim.sequentialState.currentState.get("regfile");
    if (!value) return new Map();
    if (value instanceof Map) return value as Map<number, number>;
    if (typeof value === "object") {
      const m = new Map<number, number>();
      for (const [k, v] of Object.entries(value as Record<string, number>)) {
        m.set(Number(k), v);
      }
      return m;
    }
    return new Map();
  })();

  // Track which registers changed last tick
  const prevRegistersRef = useRef<Map<number, number>>(new Map());
  const changedRegisters = new Set<number>();
  for (const [idx, val] of registers) {
    if (prevRegistersRef.current.get(idx) !== val) changedRegisters.add(idx);
  }
  prevRegistersRef.current = new Map(registers);

  const disasmLines = compiled ? parseDisassembly(compiled.disassembly) : [];

  return {
    // Loading
    dslError,
    dslLoaded: !!dslCode,

    // Compile
    compile,
    compiling,
    compileError,
    compiled,

    // Simulator
    sim,
    isRunning,
    setIsRunning,
    reset,

    // CPU state
    pipelineStages,
    registers,
    changedRegisters,
    disasmLines,
  };
}
