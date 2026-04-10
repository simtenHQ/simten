
import { useState, useEffect, useCallback, useRef } from "react";
import { useCircuitSimulator } from "@simten/embed";
import { ABI_NAMES, parseDisassembly, type DisasmLine, type PipelineStages } from "../cpu-debugger/useRV32IDebugger";
import { RV32I_DualCPU } from "./rv32i-dual-cpu.circuit";

export { ABI_NAMES };
export type { DisasmLine, PipelineStages };

export interface NicMessage {
  from: 0 | 1;
  to: 0 | 1;
  value: number;
  cycle: number;
}

/** Read a 32-bit port value, matching by cpu prefix + node label.
 *  Node IDs in a dual-CPU circuit are mangled like:
 *  cpu0_RV32I_CPU_ifid_pc_<timestamp>_<random>.q
 *  so we need to match both _cpuLabel_ (e.g. _cpu0_) and _nodeLabel_ (e.g. _ifid_pc_).
 */
function readPort(
  portValues: ReadonlyMap<string, boolean | number> | null,
  cpuLabel: string,
  nodeLabel: string,
  portName: string,
): number | null {
  if (!portValues) return null;
  // Try hierarchical key: "cpuLabel.nodeLabel.portName"
  const val = portValues.get(`${cpuLabel}.${nodeLabel}.${portName}`)
    ?? portValues.get(`${nodeLabel}.${portName}`);
  if (val === undefined) return null;
  return typeof val === "number" ? (val >>> 0) : null;
}

function extractRegisters(
  sequentialState: ReadonlyMap<string, unknown> | null | undefined,
  cpuLabel: string,
): Map<number, number> {
  if (!sequentialState) return new Map();

  // Primary match: key contains both cpuLabel segment and regfile segment
  for (const [key, value] of sequentialState) {
    if (key.includes(`_${cpuLabel}_`) && key.includes("_regfile_")) {
      if (value instanceof Map) return value as Map<number, number>;
      if (value && typeof value === "object") {
        const m = new Map<number, number>();
        for (const [k, v] of Object.entries(value as Record<string, number>)) {
          m.set(Number(k), v);
        }
        return m;
      }
    }
  }

  // Fallback: match by regfile key that also starts with cpuLabel prefix
  for (const [key, value] of sequentialState) {
    if (key.startsWith(`${cpuLabel}_`) && key.includes("regfile")) {
      if (value instanceof Map) return value as Map<number, number>;
      if (value && typeof value === "object") {
        const m = new Map<number, number>();
        for (const [k, v] of Object.entries(value as Record<string, number>)) {
          m.set(Number(k), v);
        }
        return m;
      }
    }
  }

  return new Map();
}

function extractPipelineStages(
  portValues: ReadonlyMap<string, boolean | number> | null,
  cpuLabel: string,
): PipelineStages {
  return {
    IF:  readPort(portValues, cpuLabel, "pc",         "q"),
    ID:  readPort(portValues, cpuLabel, "ifid_pc",    "q"),
    EX:  readPort(portValues, cpuLabel, "idex_pc",    "q"),
    MEM: (() => {
      const v = readPort(portValues, cpuLabel, "exmem_pc4", "q");
      return v != null ? (v - 4) >>> 0 : null;
    })(),
    WB:  (() => {
      const v = readPort(portValues, cpuLabel, "memwb_pc4", "q");
      return v != null ? (v - 4) >>> 0 : null;
    })(),
  };
}

function binaryToMemory(base64: string, memKey: string): Map<string, Map<number, number>> {
  const raw = atob(base64);
  const addressMap = new Map<number, number>();
  for (let i = 0; i < raw.length; i++) {
    const b = raw.charCodeAt(i);
    if (b !== 0) addressMap.set(i, b);
  }
  return new Map([[memKey, addressMap]]);
}

export interface CompileResult {
  binary: string;
  disassembly: string;
}

export function useRV32IDualCPU() {
  const [cpu0Compiled, setCpu0Compiled] = useState<CompileResult | null>(null);
  const [cpu1Compiled, setCpu1Compiled] = useState<CompileResult | null>(null);
  const [memory, setMemory] = useState<Map<string, Map<number, number>> | null>(null);

  const [cpu0Compiling, setCpu0Compiling] = useState(false);
  const [cpu1Compiling, setCpu1Compiling] = useState(false);
  const [cpu0CompileError, setCpu0CompileError] = useState<string | null>(null);
  const [cpu1CompileError, setCpu1CompileError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [nicMessages, setNicMessages] = useState<NicMessage[]>([]);

  const sim = useCircuitSimulator(RV32I_DualCPU);

  // Load ROM data when ready
  useEffect(() => {
    if (!sim.ready || !memory) return;
    for (const [nodeId, data] of memory) {
      sim.setNodeValue(nodeId, data);
    }
    sim.runCombinational();
  }, [sim.ready, memory]);


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

  // NIC message detection via port values.
  // When NIC_FIFO drains, it asserts net_tx_valid=true and sets net_tx_data=word for one tick.
  // Port keys look like: "...cpu0..._nic_...TIMESTAMP.net_tx_valid"
  // We capture a message each tick that net_tx_valid is high.
  useEffect(() => {
    if (!sim.ready || !sim.portValues) return;
    const newMessages: NicMessage[] = [];

    for (const [key, val] of sim.portValues) {
      if (!key.endsWith(".net_tx_valid")) continue;
      if (!val) continue; // not asserted this cycle

      // Find matching net_tx_data port (same node prefix)
      const prefix = key.slice(0, -"net_tx_valid".length);
      const dataVal = sim.portValues.get(`${prefix}net_tx_data`);
      const wordValue = (typeof dataVal === "number" ? dataVal : 0) >>> 0;

      const isCpu0 = key.includes("_cpu0_") || key.startsWith("cpu0");
      const from: 0 | 1 = isCpu0 ? 0 : 1;

      newMessages.push({ from, to: (from === 0 ? 1 : 0) as 0 | 1, value: wordValue, cycle: sim.cycleCount });
    }

    if (newMessages.length > 0) {
      setNicMessages((prev) => [...prev, ...newMessages]);
    }
  }, [sim.cycleCount, sim.ready, sim.portValues]);

  const compile = useCallback(async (
    cpuIndex: 0 | 1,
    source: string,
    language: string,
  ) => {
    const setCompiling = cpuIndex === 0 ? setCpu0Compiling : setCpu1Compiling;
    const setError = cpuIndex === 0 ? setCpu0CompileError : setCpu1CompileError;
    const setCompiled = cpuIndex === 0 ? setCpu0Compiled : setCpu1Compiled;

    setCompiling(true);
    setError(null);
    setIsRunning(false);

    try {
      const resp = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, language, disassemble: true }),
      });
      const data = await resp.json() as {
        success: boolean;
        binary?: string;
        disassembly?: string;
        stderr?: string;
        error?: string;
      };
      if (!data.success || !data.binary) {
        setError(data.stderr ?? data.error ?? "Compilation failed");
        return;
      }
      const result: CompileResult = { binary: data.binary, disassembly: data.disassembly ?? "" };
      setCompiled(result);

      // Load into the correct CPU's imem using cpu0/cpu1 label matching
      const memKey = cpuIndex === 0 ? "cpu0*imem" : "cpu1*imem";
      const newMem = binaryToMemory(data.binary, memKey);

      setMemory((prev) => {
        if (!prev) return newMem;
        const merged = new Map(prev);
        for (const key of merged.keys()) {
          if (key.includes(cpuIndex === 0 ? "cpu0" : "cpu1")) merged.delete(key);
        }
        for (const [k, v] of newMem) merged.set(k, v);
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompiling(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setNicMessages([]);
    sim.reset();
  }, [sim.reset]);

  // Extract per-CPU state
  const portValues = sim.portValues;
  const seqState = sim.sequentialState?.currentState ?? null;

  const cpu0Stages = extractPipelineStages(portValues, "cpu0");
  const cpu1Stages = extractPipelineStages(portValues, "cpu1");

  const cpu0Registers = extractRegisters(seqState, "cpu0");
  const cpu1Registers = extractRegisters(seqState, "cpu1");

  const prevCpu0Ref = useRef<Map<number, number>>(new Map());
  const prevCpu1Ref = useRef<Map<number, number>>(new Map());

  const cpu0Changed = new Set<number>();
  const cpu1Changed = new Set<number>();
  for (const [idx, val] of cpu0Registers) {
    if (prevCpu0Ref.current.get(idx) !== val) cpu0Changed.add(idx);
  }
  for (const [idx, val] of cpu1Registers) {
    if (prevCpu1Ref.current.get(idx) !== val) cpu1Changed.add(idx);
  }
  prevCpu0Ref.current = new Map(cpu0Registers);
  prevCpu1Ref.current = new Map(cpu1Registers);

  const cpu0DisasmLines = cpu0Compiled ? parseDisassembly(cpu0Compiled.disassembly) : [];
  const cpu1DisasmLines = cpu1Compiled ? parseDisassembly(cpu1Compiled.disassembly) : [];

  const bothCompiled = !!(cpu0Compiled && cpu1Compiled);

  return {
    sim,
    isRunning,
    setIsRunning,
    reset,
    compile,
    nicMessages,
    cpu0: {
      compiling: cpu0Compiling,
      compileError: cpu0CompileError,
      compiled: cpu0Compiled,
      stages: cpu0Stages,
      registers: cpu0Registers,
      changedRegisters: cpu0Changed,
      disasmLines: cpu0DisasmLines,
    },
    cpu1: {
      compiling: cpu1Compiling,
      compileError: cpu1CompileError,
      compiled: cpu1Compiled,
      stages: cpu1Stages,
      registers: cpu1Registers,
      changedRegisters: cpu1Changed,
      disasmLines: cpu1DisasmLines,
    },
    bothCompiled,
  };
}
