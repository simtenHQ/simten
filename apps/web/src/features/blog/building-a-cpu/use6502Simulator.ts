import { useState, useEffect, useCallback, useRef } from 'react';
import { useCircuitSimulator } from '@simten/embed';
import { System6502 } from './cpu6502-system.circuit';

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

/**
 * Convert a binary ROM file (Uint8Array) into the initialMemory format.
 * The ROM binary maps to addresses starting at 0 — the simulator's ROM nodes
 * (matched by "rom" substring) receive this data.
 */
function romToMemoryMap(data: Uint8Array): Map<string, Map<number, number>> {
  const addressMap = new Map<number, number>();
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 0) {
      addressMap.set(i, data[i]);
    }
  }
  const memoryMap = new Map<string, Map<number, number>>();
  memoryMap.set('rom', addressMap);
  return memoryMap;
}

interface Use6502SimulatorState {
  romData: Map<string, Map<number, number>> | null;
  sourceCode: string;
  loading: boolean;
  loadError: string | null;
  currentProgram: Program;
}

export function use6502Simulator() {
  const [state, setState] = useState<Use6502SimulatorState>({
    romData: null,
    sourceCode: '',
    loading: true,
    loadError: null,
    currentProgram: PROGRAMS[0],
  });

  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50); // ms between ticks
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load ROM + source when program changes
  const loadProgram = useCallback(async (program: Program) => {
    setState((s) => ({
      ...s,
      loading: true,
      loadError: null,
      currentProgram: program,
      romData: null,
    }));
    setIsRunning(false);

    try {
      const [romResponse, sourceResponse] = await Promise.all([
        fetch(program.romPath),
        fetch(program.sourcePath),
      ]);

      if (!romResponse.ok) throw new Error(`Failed to fetch ROM: ${romResponse.status}`);
      if (!sourceResponse.ok) throw new Error(`Failed to fetch source: ${sourceResponse.status}`);

      const [romBuffer, sourceText] = await Promise.all([
        romResponse.arrayBuffer(),
        sourceResponse.text(),
      ]);

      const romData = romToMemoryMap(new Uint8Array(romBuffer));

      setState((s) => ({
        ...s,
        romData,
        sourceCode: sourceText,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        loadError: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  // Load initial program on mount
  const loadedInitialRef = useRef(false);
  useEffect(() => {
    if (loadedInitialRef.current) return;
    loadedInitialRef.current = true;
    loadProgram(state.currentProgram);
  }, [loadProgram, state.currentProgram]);

  const sim = useCircuitSimulator(System6502);

  // Load ROM data when ready
  useEffect(() => {
    if (!sim.ready || !state.romData) return;
    for (const [nodeId, data] of state.romData) {
      sim.setNodeValue(nodeId, data);
    }
    sim.runCombinational();
  }, [sim.ready, state.romData]);

  // Extract console text from sequential state
  const consoleText = (() => {
    if (!sim.sequentialState?.currentState) return '';
    for (const [key, value] of sim.sequentialState.currentState) {
      if (key.toLowerCase().includes('console') && typeof value === 'string') {
        return value;
      }
    }
    return '';
  })();

  // Auto-run interval
  useEffect(() => {
    if (isRunning && sim.ready) {
      intervalRef.current = setInterval(
        () => {
          // Run multiple ticks per interval for speed
          const ticksPerInterval = Math.max(1, Math.floor(10 / Math.max(speed, 1)));
          for (let i = 0; i < ticksPerInterval; i++) {
            sim.tick();
          }
        },
        Math.max(speed, 10),
      );
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, sim.ready, speed, sim.tick]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    // Re-load the current program to fully reset
    loadProgram(state.currentProgram);
  }, [loadProgram, state.currentProgram]);

  // Load a custom binary (from the in-browser compiler).
  // useCircuitSimulator now depends on initialMemory, so setting new romData
  // directly triggers a simulator rebuild.
  const loadCustomBinary = useCallback((binary: Uint8Array, source: string) => {
    setIsRunning(false);
    const romData = romToMemoryMap(binary);
    setState((s) => ({
      ...s,
      romData,
      sourceCode: source,
      loading: false,
      loadError: null,
    }));
  }, []);

  const selectProgram = useCallback(
    (programId: string) => {
      const program = PROGRAMS.find((p) => p.id === programId);
      if (program) {
        loadProgram(program);
      }
    },
    [loadProgram],
  );

  return {
    // Loading state
    loading: state.loading,
    loadError: state.loadError,

    // Simulator
    sim,
    consoleText,

    // Program
    currentProgram: state.currentProgram,
    sourceCode: state.sourceCode,
    programs: PROGRAMS,
    selectProgram,

    // Controls
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,

    // Custom binary loading (for in-browser compiler)
    loadCustomBinary,
  };
}
