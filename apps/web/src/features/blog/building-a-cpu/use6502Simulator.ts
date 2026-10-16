import { useCircuitSimulator } from '@simten/embed';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Blog6502Computer, romImage } from './computer6502.circuit';

export interface Program {
  id: string;
  name: string;
  description: string;
  romPath: string;
  sourcePath: string;
}

export const PROGRAMS: Program[] = [
  {
    id: 'simple',
    name: 'Hello Chaz!',
    description: 'Writes "Hello Chaz!" to the console',
    romPath: '/blog-assets/roms/simple.bin',
    sourcePath: '/blog-assets/sources/simple.c',
  },
  {
    id: 'fib-simple',
    name: 'Fibonacci',
    description: 'Computes the first 10 Fibonacci numbers',
    romPath: '/blog-assets/roms/fib-simple.bin',
    sourcePath: '/blog-assets/sources/fib-simple.c',
  },
  {
    id: 'smiley-test',
    name: 'Smiley',
    description: 'Prints ":) YAY :)" using function calls',
    romPath: '/blog-assets/roms/smiley-test.bin',
    sourcePath: '/blog-assets/sources/smiley-test.c',
  },
];

/** Cycles per batch at each end of the speed slider. */
const SLOWEST = 1;
const FASTEST = 5000;

interface ProgramState {
  rom: Uint8Array | null;
  sourceCode: string;
  loading: boolean;
  loadError: string | null;
  currentProgram: Program;
}

export function use6502Simulator() {
  const [state, setState] = useState<ProgramState>({
    rom: null,
    sourceCode: '',
    loading: true,
    loadError: null,
    currentProgram: PROGRAMS[0],
  });
  const [isRunning, setIsRunning] = useState(false);
  const [halted, setHalted] = useState(false);
  // 1-100, mapped onto cycles per batch on a log scale.
  const [speed, setSpeed] = useState(70);
  // Bumped by Reset so the circuit (and the simulation) restarts from power-on.
  const [generation, setGeneration] = useState(0);

  const loadProgram = useCallback(async (program: Program) => {
    setIsRunning(false);
    setState((s) => ({ ...s, loading: true, loadError: null, currentProgram: program, rom: null }));
    try {
      const [romResponse, sourceResponse] = await Promise.all([
        fetch(program.romPath),
        fetch(program.sourcePath),
      ]);
      if (!romResponse.ok) throw new Error(`Failed to fetch ROM: ${romResponse.status}`);
      if (!sourceResponse.ok) throw new Error(`Failed to fetch source: ${sourceResponse.status}`);
      const [romBuffer, sourceCode] = await Promise.all([
        romResponse.arrayBuffer(),
        sourceResponse.text(),
      ]);
      setState((s) => ({ ...s, rom: new Uint8Array(romBuffer), sourceCode, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        loadError: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const loadedInitialRef = useRef(false);
  useEffect(() => {
    if (loadedInitialRef.current) return;
    loadedInitialRef.current = true;
    loadProgram(PROGRAMS[0]);
  }, [loadProgram]);

  // The ROM is part of the circuit, so a new program, or a reset, is a new circuit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation forces a rebuild on reset
  const circuit = useMemo(
    () => (state.rom ? Blog6502Computer({ rom: romImage(state.rom) }) : null),
    [state.rom, generation],
  );
  const sim = useCircuitSimulator(circuit);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clears on every new circuit
  useEffect(() => {
    setHalted(false);
  }, [circuit]);

  const consoleText = (() => {
    if (!sim.sequentialState?.currentState) return '';
    for (const [key, value] of sim.sequentialState.currentState) {
      if (key.toLowerCase().includes('console') && typeof value === 'string') return value;
    }
    return '';
  })();

  const pc = sim.outputs.pc ?? 0;
  const recentPcs = useRef<number[]>([]);
  useEffect(() => {
    recentPcs.current = [...recentPcs.current.slice(-3), pc];
  }, [pc]);

  const batch = Math.round(SLOWEST * (FASTEST / SLOWEST) ** ((speed - 1) / 99));
  const batchRef = useRef(batch);
  batchRef.current = batch;

  // Run loop: one sandbox round trip per batch, then a frame for the page to
  // repaint. Pauses itself once the program parks in its final `while(1)`.
  const { tickN, ready } = sim;
  useEffect(() => {
    if (!isRunning || !ready) return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        await tickN(batchRef.current);
        await new Promise((r) => requestAnimationFrame(r));
        // A finished program jumps to itself, so after several large batches
        // in a row the PC is still within a few bytes.
        const recent = recentPcs.current;
        if (
          batchRef.current >= 100 &&
          recent.length === 4 &&
          Math.max(...recent) - Math.min(...recent) <= 2
        ) {
          setHalted(true);
          setIsRunning(false);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRunning, ready, tickN]);

  const restart = useCallback(() => {
    setIsRunning(false);
    recentPcs.current = [];
  }, []);

  const handleReset = useCallback(() => {
    restart();
    setGeneration((g) => g + 1);
  }, [restart]);

  // Load a binary from the in-browser compiler.
  const loadCustomBinary = useCallback(
    (binary: Uint8Array, source: string) => {
      restart();
      setState((s) => ({ ...s, rom: binary, sourceCode: source, loading: false, loadError: null }));
    },
    [restart],
  );

  const selectProgram = useCallback(
    (programId: string) => {
      const program = PROGRAMS.find((p) => p.id === programId);
      if (!program) return;
      restart();
      loadProgram(program);
    },
    [loadProgram, restart],
  );

  return {
    loading: state.loading,
    loadError: state.loadError,

    sim,
    consoleText,
    registers: {
      pc,
      a: sim.outputs.a ?? 0,
      x: sim.outputs.x ?? 0,
      y: sim.outputs.y ?? 0,
      s: sim.outputs.s ?? 0,
      p: sim.outputs.p ?? 0,
    },
    halted,

    currentProgram: state.currentProgram,
    sourceCode: state.sourceCode,
    programs: PROGRAMS,
    selectProgram,

    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    cyclesPerStep: batch,
    handleReset,

    loadCustomBinary,
  };
}
