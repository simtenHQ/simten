/**
 * Systolic2x2_VerticalWeights Execution Test
 *
 * Tests that the systolic array actually computes matrix multiplication:
 * A = [1, 2]  ×  B = [5, 6]  =  C = [19, 22]
 *     [3, 4]       [7, 8]         [43, 50]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, CircuitLibrary } from '../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitive-registry';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
} from '../../src/features/visual-editor/lib/flat-simulator';
import type { Circuit } from '../../src/features/dsl/types';

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

describe('Systolic2x2_VerticalWeights Execution', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: CircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
  });

  function loadAndCompileDSL(filename: string) {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    return compileDSL(source, library);
  }

  it('should compile without errors', () => {
    const result = loadAndCompileDSL('Systolic2x2_VerticalWeights.dsl');

    if (result.errors.length > 0) {
      console.log('Compilation errors:');
      result.errors.forEach(e => console.log(`  - ${e.message}`));
    }

    // May have width warnings but should produce circuits
    expect(result.circuits.length).toBeGreaterThan(0);

    const mainCircuit = result.circuits.find(c => c.name === 'Systolic2x2_VerticalWeights');
    expect(mainCircuit).toBeDefined();
  });

  it('should execute and compute matrix multiplication', () => {
    const result = loadAndCompileDSL('Systolic2x2_VerticalWeights.dsl');

    // Register all circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    // Use TestVerticalWeights which has Input nodes with the matrix values already set
    const testCircuit = result.circuits.find(c => c.name === 'TestVerticalWeights');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== ELABORATING TEST CIRCUIT ===');
    const flatCircuit = elaborate(testCircuit, store, false); // Disable debug
    console.log(`Flat nodes: ${flatCircuit.nodes.length}`);
    console.log(`Flat connections: ${flatCircuit.connections.length}`);

    // Debug: show some node types
    const nodeTypes = new Map<string, number>();
    for (const node of flatCircuit.nodes) {
      nodeTypes.set(node.primitiveType, (nodeTypes.get(node.primitiveType) || 0) + 1);
    }
    console.log('Node types:', Object.fromEntries(nodeTypes));

    // Initialize state
    let seqState = initializeFlatSequentialState(flatCircuit);

    console.log('\n=== RUNNING SYSTOLIC ARRAY ===');
    console.log('Expected: C = [19, 22; 43, 50]');

    // The start signal comes from a Switch node in TestVerticalWeights
    // Find and activate it
    for (const node of flatCircuit.nodes) {
      if (node.primitiveType === 'Switch' && node.id.includes('start')) {
        node.arguments = { ...node.arguments, value: 1 };
        console.log(`Found start switch: ${node.id}`);
      }
    }

    // Run for many cycles (systolic arrays need time)
    let done = false;
    for (let cycle = 0; cycle < 30; cycle++) {
      // Toggle start off after first cycle
      if (cycle === 1) {
        for (const node of flatCircuit.nodes) {
          if (node.primitiveType === 'Switch' && node.id.includes('start')) {
            node.arguments = { ...node.arguments, value: 0 };
          }
        }
      }

      const tickResult = runFlatSimulationTick(flatCircuit, seqState);

      if (tickResult.error) {
        console.log(`Cycle ${cycle}: ERROR - ${tickResult.error}`);
        break;
      }

      seqState = tickResult.sequentialState!;


      // Look for done signal in various places
      let doneValue = false;
      for (const [key, value] of tickResult.portValues.entries()) {
        if (key.includes('done_latch') && key.endsWith('.q') && value === true) {
          doneValue = true;
          break;
        }
      }

      // Get result values from PE accumulators
      let c00 = 0, c01 = 0, c10 = 0, c11 = 0;
      for (const [key, value] of tickResult.portValues.entries()) {
        // Look for accum.q since that's where the result is stored
        if (key.includes('pe00') && key.includes('accum') && !key.includes('mux') && key.endsWith('.q')) {
          c00 = typeof value === 'number' ? value : 0;
        }
        if (key.includes('pe01') && key.includes('accum') && !key.includes('mux') && key.endsWith('.q')) {
          c01 = typeof value === 'number' ? value : 0;
        }
        if (key.includes('pe10') && key.includes('accum') && !key.includes('mux') && key.endsWith('.q')) {
          c10 = typeof value === 'number' ? value : 0;
        }
        if (key.includes('pe11') && key.includes('accum') && !key.includes('mux') && key.endsWith('.q')) {
          c11 = typeof value === 'number' ? value : 0;
        }
      }

      // Log progress (minimal)
      if (doneValue) {
        console.log(`Cycle ${cycle}: c00=${c00} c01=${c01} c10=${c10} c11=${c11} done=${doneValue}`);
      }

      if (doneValue && cycle > 10) {
        done = true;
        console.log(`\n=== FINAL RESULTS (cycle ${cycle}) ===`);
        console.log(`C00 = ${c00} (expected 19)`);
        console.log(`C01 = ${c01} (expected 22)`);
        console.log(`C10 = ${c10} (expected 43)`);
        console.log(`C11 = ${c11} (expected 50)`);

        // Check results
        expect(c00).toBe(19);
        expect(c01).toBe(22);
        expect(c10).toBe(43);
        expect(c11).toBe(50);
        break;
      }
    }

    if (!done) {
      console.log('\nDid not complete in 30 cycles - checking final state');
      const lastResult = runFlatSimulationTick(flatCircuit, seqState);

      // Show what we have
      for (const [key, value] of lastResult.portValues.entries()) {
        if (key.includes('result') || key.includes('done') || key.includes('accum')) {
          console.log(`  ${key} = ${value}`);
        }
      }
    }

    expect(done).toBe(true);
  });
});
