/**
 * Simulator performance benchmark
 */

import { describe, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { useMemoryDataStore } from '../../../src/features/visual-editor/stores/memory-data-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate } from '../../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
} from '../../../src/features/visual-editor/lib/flat-simulator';

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

describe('Simulator Performance', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
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

    // Warmup
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState);
      seqState = r.sequentialState!;
    }

    // Benchmark
    const CYCLES = 100;
    const start = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState);
      seqState = r.sequentialState!;
    }
    const elapsed = performance.now() - start;

    const cyclesPerSec = (CYCLES / elapsed) * 1000;
    const khz = cyclesPerSec / 1000;

    console.log(`\n=== Benchmark ===`);
    console.log(`${CYCLES} cycles in ${elapsed.toFixed(1)}ms`);
    console.log(`${cyclesPerSec.toFixed(0)} cycles/sec`);
    console.log(`${khz.toFixed(2)} kHz`);
    console.log(`${(1000 / khz).toFixed(0)}x slower than 1 MHz`);
    console.log(`${(elapsed / CYCLES).toFixed(1)}ms per cycle`);
  });
});
