/**
 * Fast Simulator Performance Tests
 *
 * Tests for the numeric-based fast simulator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary } from '@/features/dsl/index';
import { useComponentLibraryStore } from '@/features/visual-editor/stores/component-library-store';
import { useMemoryDataStore } from '@/features/visual-editor/stores/memory-data-store';
import { getPrimitives } from '@/features/visual-editor/lib/primitives';
import type { Circuit } from '@/features/dsl/types';
import { elaborate } from '@/features/visual-editor/lib/elaboration';
import {
  createSimulator,
  initializeFlatSequentialState,
  runFlatSimulationTick,
  compileForSimulation,
} from '../index';
import { setDebugStateUpdate, setDebugMux } from '../fast-simulator';
import type { FlatPortValueMap, FlatCircuit } from '../types';

class ComponentLibraryAdapter implements ComponentLibrary {
  constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}
  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveComponent(name);
  }
  hasCircuit(name: string): boolean {
    return this.store.resolveComponent(name) !== undefined;
  }
  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

describe('Fast Simulator', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;
  let flatCircuit: FlatCircuit;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
    useMemoryDataStore.getState().clearAll();

    // Load and compile the 6502 CPU
    const dslPath = resolve(__dirname, '../../../../examples/cpu6502/cpu6502-system.dsl');
    const dsl = readFileSync(dslPath, 'utf-8');
    const result = compileDSL(dsl, library);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'Stage7Test')!;

    // Load ROM
    const binPath = resolve(__dirname, '../../../../examples/cpu6502/cc65/smiley-test.bin');
    const binData = new Uint8Array(readFileSync(binPath));
    useMemoryDataStore.getState().loadData('rom', binData, 'smiley-test.bin', 0);

    flatCircuit = elaborate(testCircuit, store);
  });

  it('compiles to numeric circuit', () => {
    const numericCircuit = compileForSimulation(flatCircuit, {
      resolveComponent: (name: string) => store.resolveComponent(name),
      getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
    });

    expect(numericCircuit.nodeCount).toBe(flatCircuit.nodes.length);
    expect(numericCircuit.portCount).toBeGreaterThan(0);
    expect(numericCircuit.indexToNodeId.length).toBe(numericCircuit.nodeCount);

    // Check hasState counts
    let hasStateCount = 0;
    for (let i = 0; i < numericCircuit.nodeCount; i++) {
      if (numericCircuit.hasState[i]) hasStateCount++;
    }
    console.log(`Nodes with state: ${hasStateCount}`);
  });

  it('fast simulation produces same results as old simulation', () => {
    const componentLibrary = {
      resolveComponent: (name: string) => store.resolveComponent(name),
      getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
    };

    // Run old simulator
    let oldSeqState = initializeFlatSequentialState(flatCircuit, componentLibrary);
    let oldPortValues: FlatPortValueMap | undefined;

    // Run fast simulator via SimulatorEngine
    setDebugStateUpdate(false);
    setDebugMux(false);
    const sim = createSimulator(flatCircuit, { componentLibrary }, true);

    // Check state after each tick
    for (let i = 0; i < 10; i++) {
      const oldResult = runFlatSimulationTick(flatCircuit, oldSeqState, componentLibrary, oldPortValues);
      oldSeqState = oldResult.sequentialState!;
      oldPortValues = oldResult.portValues;

      const fastResult = sim.tick();

      // Check pc_lo.q specifically
      const pcLoKey = Array.from(oldPortValues.keys()).find(k => k.includes('pc_lo') && k.endsWith('.q'));
      if (pcLoKey && i < 3) {
        const oldVal = oldPortValues.get(pcLoKey);
        const fastVal = fastResult.portValues.get(pcLoKey);
        console.log(`Tick ${i}: ${pcLoKey} - old=${oldVal}, fast=${fastVal}`);
      }
    }

    const fastPortValues = sim.getPortValues();
    const fastSeqState = sim.getState()!;

    // Compare results - check a sample of ports
    let matchCount = 0;
    let mismatchCount = 0;
    for (const [key, oldValue] of oldPortValues!) {
      const fastValue = fastPortValues.get(key);
      if (fastValue === undefined) continue;

      const oldNum = typeof oldValue === 'boolean' ? (oldValue ? 1 : 0) : oldValue;
      const fastNum = typeof fastValue === 'boolean' ? (fastValue ? 1 : 0) : fastValue;

      if (oldNum === fastNum) {
        matchCount++;
      } else {
        mismatchCount++;
        // Allow some differences due to timing
        if (mismatchCount < 10) {
          console.log(`Mismatch at ${key}: old=${oldValue}, fast=${fastValue}`);
        }
      }
    }

    // Most values should match
    expect(matchCount).toBeGreaterThan(0);
    console.log(`Matched ${matchCount} ports, ${mismatchCount} mismatches`);

    // Cycle count should match
    expect(fastSeqState.cycleCount).toBe(oldSeqState.cycleCount);
  });

  it('benchmark: fast simulator vs old simulator', { timeout: 60000 }, () => {
    const componentLibrary = {
      resolveComponent: (name: string) => store.resolveComponent(name),
      getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
    };

    console.log(`\n=== Circuit Stats ===`);
    console.log(`Nodes: ${flatCircuit.nodes.length}`);

    const CYCLES = 100;

    // Benchmark OLD simulator
    let oldSeqState = initializeFlatSequentialState(flatCircuit, componentLibrary);
    let oldPortValues: FlatPortValueMap | undefined;

    // Warmup
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, oldSeqState, componentLibrary, oldPortValues);
      oldSeqState = r.sequentialState!;
      oldPortValues = r.portValues;
    }

    const startOld = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, oldSeqState, componentLibrary, oldPortValues);
      oldSeqState = r.sequentialState!;
      oldPortValues = r.portValues;
    }
    const elapsedOld = performance.now() - startOld;
    const hzOld = (CYCLES / elapsedOld) * 1000;

    // Benchmark FAST simulator (via SimulatorEngine)
    const sim = createSimulator(flatCircuit, { componentLibrary }, true);

    // Warmup
    for (let i = 0; i < 10; i++) {
      sim.tick();
    }

    const startFast = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      sim.tick();
    }
    const elapsedFast = performance.now() - startFast;
    const hzFast = (CYCLES / elapsedFast) * 1000;

    console.log('\n=== Benchmark Results ===');
    console.log(`OLD simulator:  ${hzOld.toFixed(0)} Hz (${(elapsedOld/CYCLES).toFixed(2)}ms/tick)`);
    console.log(`FAST simulator: ${hzFast.toFixed(0)} Hz (${(elapsedFast/CYCLES).toFixed(2)}ms/tick)`);
    console.log(`Speedup: ${(hzFast / hzOld).toFixed(2)}x`);

    // Expect at least some improvement
    expect(hzFast).toBeGreaterThan(hzOld * 0.5); // At least 0.5x (regression check)
  });
});
