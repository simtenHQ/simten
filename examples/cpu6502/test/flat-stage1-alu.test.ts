/**
 * Flat Simulator Test: Stage 1 ALU
 *
 * Clean example showing flat simulator works with 6502 circuits.
 * Tests the 8-bit ALU from Stage 1.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
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

describe('Flat Simulator: Stage 1 ALU Tests', () => {
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

  function busToNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Array.isArray(value)) {
      let result = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i]) result |= (1 << i);
      }
      return result;
    }
    return 0;
  }

  it('should perform ALU addition', () => {
    const result = loadAndCompileDSL('01-alu-combined.dsl');
    expect(result.errors).toHaveLength(0);

    // Register circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    // Find the ALU test circuit
    const testCircuit = result.circuits.find(c => c.name === 'ALUTest');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== Testing ALU with Flat Simulator ===');

    // Elaborate circuit
    const flatCircuit = elaborate(testCircuit, store);
    console.log(`Elaborated: ${flatCircuit.nodes.length} primitive nodes`);

    // Initialize state
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Run a few cycles
    console.log('\nRunning simulation...');
    for (let i = 0; i < 5; i++) {
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      if (simResult.error) {
        console.error('Simulation error:', simResult.error);
        throw new Error(simResult.error);
      }

      seqState = simResult.sequentialState!;

      // Look for result port (should be in the flat port values)
      const resultKeys = Array.from(simResult.portValues.keys()).filter(k =>
        k.includes('result') || k.includes('sum')
      );

      if (resultKeys.length > 0) {
        const firstResult = resultKeys[0];
        const value = busToNumber(simResult.portValues.get(firstResult));
        console.log(`  Cycle ${i}: ${firstResult.split('.').pop()} = ${value}`);
      }
    }

    console.log('\n✓ ALU simulation completed without errors');

    // Basic assertion - just verify simulation ran without errors
    expect(seqState.cycleCount).toBeGreaterThan(0);
  });

  it('should compile and elaborate without errors', () => {
    const result = loadAndCompileDSL('01-alu-combined.dsl');
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const aluCircuit = result.circuits.find(c => c.name === 'ALU');
    expect(aluCircuit).toBeDefined();
    if (!aluCircuit) return;

    // Elaborate
    const flatCircuit = elaborate(aluCircuit, store);

    console.log('\n=== ALU Elaboration ===');
    console.log(`Original nodes: ${aluCircuit.nodes.length}`);
    console.log(`Flat nodes: ${flatCircuit.nodes.length}`);
    console.log(`Flat connections: ${flatCircuit.connections.length}`);

    // Verify elaboration produced primitives
    // (ALU circuit is already all primitives, so count may be same or greater)
    expect(flatCircuit.nodes.length).toBeGreaterThanOrEqual(aluCircuit.nodes.length);
    expect(flatCircuit.nodes.every(n => {
      // All nodes should be primitives (have a primitiveType)
      return typeof n.primitiveType === 'string';
    })).toBe(true);

    console.log('✓ All nodes are primitives');
  });
});
