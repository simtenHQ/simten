/**
 * 6502 CPU Stage 3 - Flat Simulator Execution Test
 *
 * Same test as stage3-complete-execution.test.ts, but using the FLAT simulator
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
  runFlatSimulationTick,
  initializeFlatSequentialState
} from '../../../src/features/visual-editor/lib/flat-simulator';

// Adapter
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

describe('6502 CPU Stage 3 - Flat Simulator Execution', () => {
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
    return 0;
  }

  it('should execute test program correctly using flat simulator', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    // Register all circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== ELABORATING ===');
    const flatCircuit = elaborate(testCircuit, store);
    console.log(`Flat nodes: ${flatCircuit.nodes.length}`);
    console.log(`Flat connections: ${flatCircuit.connections.length}`);

    // Initialize
    let seqState = initializeFlatSequentialState(flatCircuit);

    console.log('\n=== RUNNING TEST PROGRAM ===');
    console.log('Program: LDA #$42, STA $0010, LDA $0010, TAX, INX');
    console.log('Expected: A=0x42, X=0x43, Memory[$10]=0x42, PC=0x0A\n');

    // Run for enough cycles to complete the program
    for (let cycle = 0; cycle < 50; cycle++) {
      const tickResult = runFlatSimulationTick(flatCircuit, seqState);

      if (tickResult.error) {
        console.log(`\nERROR at cycle ${cycle}: ${tickResult.error}`);
        break;
      }

      // Get current values
      const pc = busToNumber(tickResult.portValues.get('__top__.pc'));
      const reg_a = busToNumber(tickResult.portValues.get('__top__.reg_a'));
      const reg_x = busToNumber(tickResult.portValues.get('__top__.reg_x'));

      if (cycle % 5 === 4) {
        console.log(`Cycle ${cycle + 1}: PC=${pc.toString(16).padStart(2, '0')} A=${reg_a.toString(16).padStart(2, '0')} X=${reg_x.toString(16).padStart(2, '0')}`);
      }

      // Check if we've reached the end (PC = 0x0A)
      // Wait extra cycles after PC reaches target to let final register writes commit
      // INX needs more time because state transitions don't take effect until next cycle
      if (pc >= 0x0A && cycle > 25) {
        console.log(`\n=== FINAL STATE (cycle ${cycle + 1}) ===`);
        const final_a = busToNumber(tickResult.portValues.get('__top__.reg_a'));
        const final_x = busToNumber(tickResult.portValues.get('__top__.reg_x'));
        const final_pc = busToNumber(tickResult.portValues.get('__top__.pc'));

        // Read memory state directly from the mem_10 register's internal state
        // This verifies STA $0010 actually wrote to memory
        let mem_10_value = 0;
        for (const [stateKey, stateValue] of seqState.currentState.entries()) {
          if (stateKey.includes('mem_10')) {
            mem_10_value = typeof stateValue === 'number' ? stateValue : 0;
            break;
          }
        }

        console.log(`A = 0x${final_a.toString(16).padStart(2, '0')} (expected: 0x42)`);
        console.log(`X = 0x${final_x.toString(16).padStart(2, '0')} (expected: 0x43)`);
        console.log(`Memory[$10] state = 0x${mem_10_value.toString(16).padStart(2, '0')} (expected: 0x42)`);
        console.log(`PC = 0x${final_pc.toString(16).padStart(2, '0')} (expected: 0x0A)`);

        // Assertions
        expect(final_a).toBe(0x42);
        expect(final_x).toBe(0x43);
        // Verify memory write by reading register state directly
        expect(mem_10_value).toBe(0x42);
        // PC may be > 0x0A because we wait extra cycles for register writes to commit
        expect(final_pc).toBeGreaterThanOrEqual(0x0A);

        return; // Test passed!
      }
    }

    // If we got here, the program didn't complete
    throw new Error('Program did not complete in 50 cycles');
  });
});
