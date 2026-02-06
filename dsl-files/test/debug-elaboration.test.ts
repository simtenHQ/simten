/**
 * Debug Test - Check elaboration connections for Systolic2x2_VerticalWeights
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
} from '../../src/features/visual-editor/lib/flat-simulator';
import type { Circuit } from '../../src/features/dsl/types';

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

describe('Debug Elaboration', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('should trace connections to HexDisplay', () => {
    const filepath = resolve(__dirname, '..', 'Systolic2x2_VerticalWeights.dsl');
    const source = readFileSync(filepath, 'utf-8');
    const result = compileDSL(source, library);

    // Register all circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'TestVerticalWeights');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== TOP-LEVEL CIRCUIT NODES ===');
    for (const node of testCircuit.nodes) {
      console.log(`  ${node.id}: ${node.componentRef}`);
    }

    console.log('\n=== TOP-LEVEL CIRCUIT CONNECTIONS ===');
    for (const conn of testCircuit.connections) {
      console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
    }

    // Elaborate with debug
    console.log('\n=== ELABORATING ===');
    const flatCircuit = elaborate(testCircuit, store, true);

    console.log('\n=== FLAT NODES ===');
    for (const node of flatCircuit.nodes) {
      console.log(`  ${node.id}: ${node.primitiveType}`);
    }

    // Find connections involving HexDisplay
    console.log('\n=== CONNECTIONS TO HexDisplay ===');
    const hexDisplayNodes = flatCircuit.nodes.filter(n => n.primitiveType === 'HexDisplay');
    for (const hexNode of hexDisplayNodes) {
      const incomingConns = flatCircuit.connections.filter(
        c => c.target.nodeId === hexNode.id
      );
      console.log(`\n  ${hexNode.id}:`);
      for (const conn of incomingConns) {
        console.log(`    <- ${conn.source.nodeId}.${conn.source.portName}`);
      }
    }

    // Find connections involving accum.q outputs
    console.log('\n=== CONNECTIONS FROM accum.q ===');
    const accumConns = flatCircuit.connections.filter(
      c => c.source.portName === 'q' && c.source.nodeId.includes('accum')
    );
    for (const conn of accumConns) {
      console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
    }

    // Run simulation
    console.log('\n=== RUNNING SIMULATION ===');
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Activate start switch
    for (const node of flatCircuit.nodes) {
      if (node.primitiveType === 'Switch' && node.id.includes('start')) {
        node.arguments = { ...node.arguments, value: 1 };
      }
    }

    // Run for 15 cycles
    for (let cycle = 0; cycle < 15; cycle++) {
      if (cycle === 1) {
        for (const node of flatCircuit.nodes) {
          if (node.primitiveType === 'Switch' && node.id.includes('start')) {
            node.arguments = { ...node.arguments, value: 0 };
          }
        }
      }

      const tickResult = runFlatSimulationTick(flatCircuit, seqState);
      seqState = tickResult.sequentialState!;

      // Check HexDisplay input values
      if (cycle >= 10) {
        console.log(`\nCycle ${cycle}:`);
        for (const [key, value] of tickResult.portValues.entries()) {
          if (key.includes('display_c')) {
            console.log(`  ${key} = ${value}`);
          }
        }

        // Also check accum values
        for (const [key, value] of tickResult.portValues.entries()) {
          if (key.includes('accum') && key.endsWith('.q')) {
            console.log(`  ${key} = ${value}`);
          }
        }
      }
    }
  });
});
