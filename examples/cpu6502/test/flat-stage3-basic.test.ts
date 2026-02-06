/**
 * Flat Simulator Test: Stage 3 Basic
 *
 * Clean example showing flat simulator works with complete CPU.
 * Uses a simple approach: just verify simulation runs and state updates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
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

describe('Flat Simulator: Stage 3 Basic Tests', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  function loadAndCompileDSL(filename: string) {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    return compileDSL(source, library);
  }

  it('should compile and elaborate Stage 3 Complete', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    // Register circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const completeCPU = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(completeCPU).toBeDefined();
    if (!completeCPU) return;

    console.log('\n=== Elaborating CompleteCPU ===');
    const flatCircuit = elaborate(completeCPU, store);

    console.log(`Original nodes: ${completeCPU.nodes.length}`);
    console.log(`Flat nodes: ${flatCircuit.nodes.length}`);
    console.log(`Flat connections: ${flatCircuit.connections.length}`);

    // Verify all nodes are primitives
    const nonPrimitives = flatCircuit.nodes.filter(n => !n.primitiveType);
    if (nonPrimitives.length > 0) {
      console.log('Non-primitive nodes found:', nonPrimitives.map(n => n.id));
    }
    expect(nonPrimitives).toHaveLength(0);

    console.log('✓ All nodes successfully flattened to primitives');
  });

  it('should run Stage 3 CPU simulation', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const completeCPU = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(completeCPU).toBeDefined();
    if (!completeCPU) return;

    console.log('\n=== Running Stage 3 CPU Simulation ===');

    // Elaborate
    const flatCircuit = elaborate(completeCPU, store);

    // Initialize state
    let seqState = initializeFlatSequentialState(flatCircuit);
    console.log(`Initial state entries: ${seqState.currentState.size}`);
    console.log(`Starting cycle: ${seqState.cycleCount}`);

    // Run 10 cycles
    console.log('\nExecuting 10 cycles...');
    for (let i = 0; i < 10; i++) {
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      if (simResult.error) {
        console.error(`Cycle ${i} error:`, simResult.error);
        throw new Error(simResult.error);
      }

      seqState = simResult.sequentialState!;

      // Find some interesting ports to show activity
      const portKeys = Array.from(simResult.portValues.keys());
      const pcPorts = portKeys.filter(k => k.includes('pc_reg') && k.endsWith('.q'));

      if (pcPorts.length > 0) {
        const pcValue = simResult.portValues.get(pcPorts[0]);
        console.log(`  Cycle ${seqState.cycleCount}: PC register = ${pcValue}`);
      }
    }

    console.log(`\nFinal cycle: ${seqState.cycleCount}`);
    console.log('✓ Simulation completed successfully');

    // Verify state advanced
    expect(seqState.cycleCount).toBe(10);
  });

  it('should maintain sequential state correctly', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const completeCPU = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(completeCPU).toBeDefined();
    if (!completeCPU) return;

    console.log('\n=== Testing Sequential State Persistence ===');

    const flatCircuit = elaborate(completeCPU, store);
    let seqState = initializeFlatSequentialState(flatCircuit);

    const initialStateSize = seqState.currentState.size;
    console.log(`Initial state size: ${initialStateSize}`);

    // Run simulation and verify state is maintained
    for (let i = 0; i < 5; i++) {
      const simResult = runFlatSimulationTick(flatCircuit, seqState);
      expect(simResult.error).toBeUndefined();

      seqState = simResult.sequentialState!;

      // State size should remain constant
      expect(seqState.currentState.size).toBe(initialStateSize);
      expect(seqState.nextState.size).toBe(initialStateSize);
    }

    console.log(`Final state size: ${seqState.currentState.size}`);
    console.log('✓ Sequential state maintained correctly across cycles');
  });

  it('should handle CompleteTest wrapper circuit', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const completeTest = result.circuits.find(c => c.name === 'CompleteTest');
    expect(completeTest).toBeDefined();
    if (!completeTest) return;

    console.log('\n=== Testing CompleteTest Wrapper (UI Circuit) ===');

    // Elaborate the wrapper
    const flatCircuit = elaborate(completeTest, store);
    console.log(`Elaborated ${flatCircuit.nodes.length} nodes`);

    // Initialize and run
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Just verify it runs without errors
    for (let i = 0; i < 3; i++) {
      const simResult = runFlatSimulationTick(flatCircuit, seqState);
      expect(simResult.error).toBeUndefined();
      seqState = simResult.sequentialState!;
    }

    console.log(`Completed ${seqState.cycleCount} cycles`);
    console.log('✓ CompleteTest wrapper works with flat simulator');
  });
});
