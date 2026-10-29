import type { MemoryContents } from '@simten/core/internal';
import { useSimulation } from '@simten/react/sandbox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoRun } from '@/lib/auto-run';
import { RV32I_CPU } from './rv32i-cpu.circuit';

// ABI register names for RV32I
export const ABI_NAMES: Record<number, string> = {
  0: 'zero',
  1: 'ra',
  2: 'sp',
  3: 'gp',
  4: 'tp',
  5: 't0',
  6: 't1',
  7: 't2',
  8: 's0',
  9: 's1',
  10: 'a0',
  11: 'a1',
  12: 'a2',
  13: 'a3',
  14: 'a4',
  15: 'a5',
  16: 'a6',
  17: 'a7',
  18: 's2',
  19: 's3',
  20: 's4',
  21: 's5',
  22: 's6',
  23: 's7',
  24: 's8',
  25: 's9',
  26: 's10',
  27: 's11',
  28: 't3',
  29: 't4',
  30: 't5',
  31: 't6',
};

export interface DisasmLine {
  address: number;
  label?: string;
  instruction: string;
}

export interface PipelineStages {
  IF: number | null; // pc.q (the PC being fetched)
  ID: number | null; // ifid_pc.q
  EX: number | null; // idex_pc.q
  MEM: number | null; // exmem_pc4.q - 4
  WB: number | null; // memwb_pc4.q - 4
}

/** Parse objdump -d output into structured lines */
function parseDisassembly(text: string): DisasmLine[] {
  const lines: DisasmLine[] = [];
  for (const raw of text.split('\n')) {
    // Label line: "00000000 <main>:"
    const labelMatch = raw.match(/^([0-9a-f]+)\s+<([^>]+)>:/);
    if (labelMatch) {
      lines.push({
        address: parseInt(labelMatch[1], 16),
        label: labelMatch[2],
        instruction: '',
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

/** Convert base64-encoded binary to instruction-memory contents, byte by byte. */
function binaryToROM(base64: string): MemoryContents {
  const raw = atob(base64);
  const contents: MemoryContents = {};
  for (let i = 0; i < raw.length; i++) {
    const b = raw.charCodeAt(i);
    if (b !== 0) contents[i] = b;
  }
  return contents;
}

/** Read one of the CPU's 32-bit outputs, off the display the harness gives it. */
function readOutput(portValues: ReadonlyMap<string, number> | null, name: string): number | null {
  const val = portValues?.get(`${name}.in`);
  return val === undefined ? null : val >>> 0;
}

/** The CPU's node in the harness; its memories are under this path. */
const CPU = 'dut';

interface CompileResult {
  binary: string; // base64
  disassembly: string;
}

export function useRV32IDebugger() {
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [romData, setRomData] = useState<MemoryContents | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Harnessed, so `debug_addr` is an Input node the debugger can scan, as a
  // JTAG probe would. The program is part of what the simulation is built
  // from: a new program opens a new session at cycle 0, as loading a program
  // does on real hardware.
  // Run executes 10 cycles a second, slow enough to watch the pipeline.
  const options = useMemo(
    () => ({
      harness: true,
      memory: romData ? { [`${CPU}.imem`]: romData } : undefined,
      speed: 10,
    }),
    [romData],
  );
  const sim = useSimulation(RV32I_CPU, options);
  const { state, actions } = sim;
  const { isRunning, setIsRunning } = useAutoRun(sim);

  const compile = useCallback(
    async (source: string, language: string) => {
      setCompiling(true);
      setCompileError(null);
      void actions.pause();
      try {
        const resp = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, language, disassemble: true }),
        });
        const data = (await resp.json()) as {
          success: boolean;
          binary?: string; // Go []byte → base64 in JSON
          disassembly?: string;
          stderr?: string;
          error?: string;
        };
        if (!data.success || !data.binary) {
          setCompileError(data.stderr ?? data.error ?? 'Compilation failed');
          return;
        }
        const result: CompileResult = {
          binary: data.binary,
          disassembly: data.disassembly ?? '',
        };
        setCompiled(result);
        setRomData(binaryToROM(data.binary));
      } catch (e) {
        setCompileError(e instanceof Error ? e.message : String(e));
      } finally {
        setCompiling(false);
      }
    },
    [actions],
  );

  const reset = useCallback(() => {
    void actions.pause();
    void actions.reset();
  }, [actions]);

  // Pipeline-stage PCs read from RV32I_Core's debug outputs (top-level ports),
  // the pipeline registers now live inside the `cpu` sub-node, so we no longer
  // reach internal node labels. MEM/WB outputs are PC+4 of the in-flight
  // instruction; subtract 4 to recover the stage PC.
  const pipelineStages: PipelineStages = {
    IF: readOutput(state.portValues, 'if_pc'),
    ID: readOutput(state.portValues, 'id_pc'),
    EX: readOutput(state.portValues, 'ex_pc'),
    MEM: (() => {
      const v = readOutput(state.portValues, 'mem_pc4');
      return v != null ? (v - 4) >>> 0 : null;
    })(),
    WB: (() => {
      const v = readOutput(state.portValues, 'wb_pc4');
      return v != null ? (v - 4) >>> 0 : null;
    })(),
  };

  // Scan the regfile via the JTAG-style debug port in one sandbox round-trip.
  // The sandbox loops debug_addr 0..31 internally and returns all values at
  // once, which avoids a 32× round-trip race during Run mode. Models how real
  // debug hardware (RV Debug Abstract Commands, ARM CoreSight) reads
  // architectural state while the core is halted.
  const [registers, setRegisters] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!state.ready) return;
    let cancelled = false;
    (async () => {
      const values = await actions.scan('debug_addr', 'debug_value.in', 32);
      if (cancelled || values.length === 0) return;
      const map = new Map<number, number>();
      for (let i = 0; i < values.length; i++) map.set(i, values[i] >>> 0);
      setRegisters(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.ready, state.cycle, actions]);

  // Track which registers changed last tick
  const prevRegistersRef = useRef<Map<number, number>>(new Map());
  const changedRegisters = new Set<number>();
  for (const [idx, val] of registers) {
    if (prevRegistersRef.current.get(idx) !== val) changedRegisters.add(idx);
  }
  prevRegistersRef.current = new Map(registers);

  const disasmLines = compiled ? parseDisassembly(compiled.disassembly) : [];

  return {
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
