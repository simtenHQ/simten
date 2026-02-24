/**
 * Fast Simulator Performance Tests
 *
 * Tests for the numeric-based fast simulator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary, type Circuit } from '@/features/dsl';
import { useComponentLibraryStore } from '@/features/visual-editor/stores/component-library-store';
import { useMemoryDataStore } from '@/features/visual-editor/stores/memory-data-store';
import { getPrimitives } from '@/features/visual-editor/lib/primitive-registry';
import { elaborate } from '@/features/visual-editor/lib/elaboration';
import {
  createSimulator,
  compileForSimulation,
} from '../index';
import { setDebugStateUpdate } from '../fast-simulator';
import type { FlatCircuit } from '../types';

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
    const dslPath = resolve(__dirname, '../../../../../../examples/cpu6502/cpu6502-system.dsl');
    const dsl = readFileSync(dslPath, 'utf-8');
    const result = compileDSL(dsl, library);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'Stage7Test')!;

    // Load ROM
    const binPath = resolve(__dirname, '../../../../../../examples/cpu6502/cc65/smiley-test.bin');
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

  it('runs simulation and produces valid state', () => {
    const componentLibrary = {
      resolveComponent: (name: string) => store.resolveComponent(name),
      getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
    };

    setDebugStateUpdate(false);
    const sim = createSimulator(flatCircuit, { componentLibrary });

    // Run 10 ticks
    for (let i = 0; i < 10; i++) {
      const result = sim.tick();

      // Check pc_lo.q on first few ticks
      const pcLoKey = Array.from(result.portValues.keys()).find(k => k.includes('pc_lo') && k.endsWith('.q'));
      if (pcLoKey && i < 3) {
        const val = result.portValues.get(pcLoKey);
        console.log(`Tick ${i}: ${pcLoKey} = ${val}`);
      }
    }

    const portValues = sim.getPortValues();
    const seqState = sim.getState()!;

    // Check we have port values
    expect(portValues.size).toBeGreaterThan(0);

    // Check cycle count
    expect(seqState.cycleCount).toBe(10);

    console.log(`Port values: ${portValues.size}, Cycle count: ${seqState.cycleCount}`);
  });

  it('benchmark: fast simulator performance', { timeout: 60000 }, () => {
    const componentLibrary = {
      resolveComponent: (name: string) => store.resolveComponent(name),
      getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
    };

    console.log(`\n=== Circuit Stats ===`);
    console.log(`Nodes: ${flatCircuit.nodes.length}`);

    const CYCLES = 100;

    // Create simulator
    const sim = createSimulator(flatCircuit, { componentLibrary });

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
    console.log(`FAST simulator: ${hzFast.toFixed(0)} Hz (${(elapsedFast/CYCLES).toFixed(2)}ms/tick)`);

    // Expect reasonable performance (at least 1000 Hz for 1118 nodes)
    expect(hzFast).toBeGreaterThan(1000);
  });
});
