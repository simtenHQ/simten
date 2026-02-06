/**
 * Trace port forwarding to see what's being mapped
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate } from '../../../src/features/visual-editor/lib/elaboration';

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

describe('Trace Port Forwarding', () => {
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

  it('should trace connections through RegisterFile', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== BEFORE ELABORATION ===');

    // Find connections TO registers in the original circuit
    const registersNode = testCircuit.nodes.find(n => n.componentRef === 'RegisterFile');
    if (registersNode) {
      const toRegisters = testCircuit.connections.filter(c => c.target.nodeId === registersNode.id);
      console.log(`\nConnections TO ${registersNode.id}:`);
      toRegisters.forEach(c => {
        console.log(`  ${c.source.nodeId}.${c.source.portName} -> ${c.target.portName}`);
      });
    }

    console.log('\n=== ELABORATING ===');
    const flatCircuit = elaborate(testCircuit, store);

    console.log(`\nFlat nodes: ${flatCircuit.nodes.length}`);
    console.log(`Flat connections: ${flatCircuit.connections.length}`);

    // Find ALL register primitives in the flat circuit
    const registerPrimitives = flatCircuit.nodes.filter(n =>
      n.primitiveType === 'Register'
    );

    console.log(`\n=== ALL REGISTER PRIMITIVES (${registerPrimitives.length}) ===`);

    // Also check the problematic next_state mux
    const nextStateMux = flatCircuit.nodes.find(n => n.id.includes('next_state'));
    if (nextStateMux) {
      console.log(`\n=== NEXT_STATE MUX ===`);
      console.log(`ID: ${nextStateMux.id}`);
      console.log(`Type: ${nextStateMux.primitiveType}`);
      console.log(`Inputs: ${nextStateMux.inputs.map(i => i.name).join(', ')}`);

      const toMux = flatCircuit.connections.filter(c => c.target.nodeId === nextStateMux.id);
      console.log(`\nConnections TO (${toMux.length}):`);
      toMux.forEach(c => {
        console.log(`  ${c.source.nodeId}.${c.source.portName} -> ${c.target.portName}`);
      });

      const unconnectedMux = nextStateMux.inputs.map(i => i.name).filter(p =>
        !toMux.some(c => c.target.portName === p)
      );
      if (unconnectedMux.length > 0) {
        console.log(`\n⚠️  UNCONNECTED INPUTS: ${unconnectedMux.join(', ')}`);
      }
    }
    registerPrimitives.forEach(reg => {
      console.log(`\n${reg.id}:`);

      // Find connections TO this register
      const toReg = flatCircuit.connections.filter(c => c.target.nodeId === reg.id);
      console.log(`  Connections TO (${toReg.length}):`);
      toReg.forEach(c => {
        console.log(`    ${c.source.nodeId}.${c.source.portName} -> ${c.target.portName}`);
      });

      // Check for unconnected inputs
      const inputPorts = reg.inputs.map(i => i.name);
      const connectedPorts = toReg.map(c => c.target.portName);
      const unconnected = inputPorts.filter(p => !connectedPorts.includes(p));
      if (unconnected.length > 0) {
        console.log(`  ⚠️  UNCONNECTED INPUTS: ${unconnected.join(', ')}`);
      }
    });
  });
});
