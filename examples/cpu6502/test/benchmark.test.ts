/**
 * Simulator performance benchmark
 */

import { describe, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, CircuitLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { useMemoryDataStore } from '../../../src/features/visual-editor/stores/memory-data-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate } from '../../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
  type FlatPortValueMap,
} from '../../../src/features/visual-editor/lib/flat-simulator';

class CircuitLibraryAdapter implements CircuitLibrary {
  constructor(private store: ReturnType<typeof useCircuitLibraryStore.getState>) {}
  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveCircuit(name);
  }
  hasCircuit(name: string): boolean {
    return this.store.resolveCircuit(name) !== undefined;
  }
  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

describe('Simulator Performance', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: CircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
    useMemoryDataStore.getState().clearAll();
  });

  it('benchmark: cycles per second', { timeout: 60000 }, () => {
    // Load and compile
    const dslPath = resolve(__dirname, '../cpu6502-system.dsl');
    const dsl = readFileSync(dslPath, 'utf-8');
    const result = compileDSL(dsl, library);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'Stage7Test')!;

    // Load ROM
    const binPath = resolve(__dirname, '../cc65/smiley-test.bin');
    const binData = new Uint8Array(readFileSync(binPath));
    useMemoryDataStore.getState().loadData('rom', binData, 'smiley-test.bin', 0);

    const flatCircuit = elaborate(testCircuit, store);
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Circuit stats
    console.log(`\n=== Circuit Stats ===`);
    console.log(`Nodes: ${flatCircuit.nodes.length}`);
    console.log(`Connections: ${flatCircuit.connections.length}`);

    const typeCounts: Record<string, number> = {};
    for (const node of flatCircuit.nodes) {
      typeCounts[node.primitiveType] = (typeCounts[node.primitiveType] || 0) + 1;
    }
    console.log(`Top node types:`);
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([t, c]) => console.log(`  ${t}: ${c}`));

    const CYCLES = 100;

    // Benchmark WITHOUT previousPortValues (fresh each tick)
    let previousPortValues: FlatPortValueMap | undefined;
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState);
      seqState = r.sequentialState!;
    }

    const start1 = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, undefined); // No previous!
      seqState = r.sequentialState!;
    }
    const elapsed1 = performance.now() - start1;
    const hz1 = (CYCLES / elapsed1) * 1000;

    // Reset and warmup WITH previousPortValues
    seqState = initializeFlatSequentialState(flatCircuit);
    previousPortValues = undefined;
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);
      seqState = r.sequentialState!;
      previousPortValues = r.portValues;
    }

    // Benchmark WITH previousPortValues (O(K) change detection)
    const start2 = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);
      seqState = r.sequentialState!;
      previousPortValues = r.portValues;
    }
    const elapsed2 = performance.now() - start2;
    const hz2 = (CYCLES / elapsed2) * 1000;

    console.log('\n=== Benchmark (6502 CPU, ' + flatCircuit.nodes.length + ' nodes) ===');
    console.log('WITHOUT previousPortValues: ' + hz1.toFixed(0) + ' Hz (' + (elapsed1/CYCLES).toFixed(1) + 'ms/tick)');
    console.log('WITH previousPortValues:    ' + hz2.toFixed(0) + ' Hz (' + (elapsed2/CYCLES).toFixed(1) + 'ms/tick)');
    console.log('Speedup: ' + (hz2 / hz1).toFixed(1) + 'x');
  });
});
