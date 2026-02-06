/**
 * Debug test to trace why register connections aren't being stitched
 */

import { describe, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';

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

describe('Debug Register Connections', () => {
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

  it('should show register connection stitching', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');

    // Register all circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    if (!testCircuit) return;

    console.log('\n=== ANALYZING CompleteCPU STRUCTURE ===');
    console.log(`Nodes: ${testCircuit.nodes.length}`);
    console.log(`Connections: ${testCircuit.connections.length}`);

    // Find the registers node
    const registersNode = testCircuit.nodes.find(n =>
      n.componentRef === 'RegisterFile' || n.id.includes('register')
    );

    if (registersNode) {
      console.log(`\n=== Register Node Found: ${registersNode.id} ===`);
      console.log(`Component: ${registersNode.componentRef}`);
      console.log(`Inputs: ${registersNode.inputs.map(i => i.name).join(', ')}`);
      console.log(`Outputs: ${registersNode.outputs.map(o => o.name).join(', ')}`);

      // Find connections TO the registers
      const connectionsToRegisters = testCircuit.connections.filter(c =>
        c.target.nodeId === registersNode.id
      );

      console.log(`\n=== Connections TO ${registersNode.id} (${connectionsToRegisters.length}) ===`);
      connectionsToRegisters.forEach(conn => {
        console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.portName}`);
      });

      // Look at the RegisterFile component
      const registerFileComp = store.resolveComponent('RegisterFile');
      if (registerFileComp) {
        console.log(`\n=== RegisterFile Component ===`);
        console.log(`Inputs: ${registerFileComp.inputs.map(i => i.name).join(', ')}`);
        console.log(`Outputs: ${registerFileComp.outputs.map(o => o.name).join(', ')}`);
        console.log(`Internal nodes: ${registerFileComp.nodes.length}`);
        console.log(`Internal connections: ${registerFileComp.connections.length}`);

        // Show internal structure
        console.log(`\n=== RegisterFile Internal Nodes ===`);
        registerFileComp.nodes.forEach(node => {
          console.log(`  ${node.id}: ${node.componentRef}`);
        });

        console.log(`\n=== RegisterFile Internal Connections ===`);
        registerFileComp.connections.slice(0, 10).forEach(conn => {
          console.log(`  ${conn.source.nodeId || '(input)'}.${conn.source.portName} -> ${conn.target.nodeId || '(output)'}.${conn.target.portName}`);
        });
      }
    } else {
      console.log('\n⚠️  No registers node found!');
      console.log('Available nodes:');
      testCircuit.nodes.forEach(n => console.log(`  - ${n.id}: ${n.componentRef}`));
    }
  });
});
