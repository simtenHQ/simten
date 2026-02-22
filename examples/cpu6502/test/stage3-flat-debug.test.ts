/**
 * 6502 CPU Stage 3 - Flat Simulator Debug Test
 *
 * This test uses the FLAT simulator to debug value propagation issues.
 * Specifically, we're looking for the broken path: effective_addr -> memory.addr
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
  runFlatSimulationTick,
  initializeFlatSequentialState
} from '../../../src/features/visual-editor/lib/flat-simulator';

// Adapter to make ComponentLibraryStore compatible with ComponentLibrary interface
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

describe('6502 CPU Stage 3 - Flat Simulator Debug', () => {
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

  it('should instrument memory address propagation', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    // Register all compiled circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    // Get the CompleteCPU circuit
    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== ELABORATING CIRCUIT ===');

    // ELABORATE THE CIRCUIT (this is where composites get flattened)
    const flatCircuit = elaborate(testCircuit, store);

    console.log(`\nElaboration complete:`);
    console.log(`  Flat nodes: ${flatCircuit.nodes.length}`);
    console.log(`  Flat connections: ${flatCircuit.connections.length}`);

    // Look for connections related to memory addressing
    const addrConnections = flatCircuit.connections.filter(c =>
      c.id.includes('addr') || c.id.includes('memory') || c.id.includes('effective')
    );

    console.log(`\nAddress-related connections (${addrConnections.length}):`);
    addrConnections.slice(0, 20).forEach(conn => {
      console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
    });

    // Look for the memory node
    const memoryNode = flatCircuit.nodes.find(n =>
      n.id.includes('memory') || n.id.includes('SimpleMemory')
    );

    if (memoryNode) {
      console.log(`\nMemory node found: ${memoryNode.id}`);
      console.log(`  Type: ${memoryNode.primitiveType}`);
      console.log(`  Inputs: ${memoryNode.inputs.map(i => i.name).join(', ')}`);
      console.log(`  Outputs: ${memoryNode.outputs.map(o => o.name).join(', ')}`);

      // Find all connections TO memory
      const connectionsToMemory = flatCircuit.connections.filter(c =>
        c.target.nodeId === memoryNode.id
      );

      console.log(`\nConnections TO memory (${connectionsToMemory.length}):`);
      connectionsToMemory.forEach(conn => {
        console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.portName}`);
      });
    } else {
      console.log('\n⚠️  NO MEMORY NODE FOUND IN FLAT CIRCUIT!');
      console.log('This is the bug - memory node was not flattened correctly.');
      console.log('\nAll flat node IDs:');
      flatCircuit.nodes.forEach(n => console.log(`  - ${n.id}`));
    }

    // Initialize and run one tick to see what happens
    const seqState = initializeFlatSequentialState(flatCircuit);

    console.log(`\n=== RUNNING FIRST TICK ===`);
    const result1 = runFlatSimulationTick(flatCircuit, seqState);

    if (result1.error) {
      console.log(`ERROR: ${result1.error}`);
    } else {
      console.log('First tick completed successfully');

      // Show some port values
      const interestingPorts = Array.from(result1.portValues.entries())
        .filter(([key]) =>
          key.includes('addr') ||
          key.includes('memory') ||
          key.includes('pc') ||
          key.includes('reg_a')
        )
        .slice(0, 20);

      console.log('\nInteresting port values:');
      interestingPorts.forEach(([key, value]) => {
        console.log(`  ${key} = ${value}`);
      });
    }
  });
});
