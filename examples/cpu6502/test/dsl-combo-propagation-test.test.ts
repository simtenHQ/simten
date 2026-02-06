/**
 * Test DSL-compiled nested composite with combinational simulation
 * to see if value propagation works without sequential complexity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { runCombinationalSimulation } from '../../../src/features/visual-editor/lib/simulator-v0.1';

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

describe('DSL Combinational Propagation Test', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('should propagate value from nested Constant through Buffer', () => {
    const dslSource = `
circuit ConstantHolder {
  output value: Bus[8]

  impl {
    node c: Constant(value=169)
    connect c.out -> value
  }
}

circuit PropagationTest {
  output out: Bus[8]

  impl {
    node holder: ConstantHolder
    node buffer: Buffer(width=8)

    connect holder.value -> buffer.in
    connect buffer.out -> out
  }
}
`;

    const result = compileDSL(dslSource, library);
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'PropagationTest');
    expect(testCircuit).toBeDefined();

    if (!testCircuit) return;

    console.log('\n=== Circuit Structure ===');
    console.log(`Circuit: ${testCircuit.name}`);
    console.log(`Nodes: ${testCircuit.nodes.length}`);
    testCircuit.nodes.forEach(node => {
      console.log(`  - ${node.id}: ${node.componentRef}`);
    });

    console.log(`\nConnections: ${testCircuit.connections.length}`);
    testCircuit.connections.forEach((conn, idx) => {
      console.log(`  ${idx}: ${conn.source.nodeId === '' ? '(circuit)' : conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId === '' ? '(circuit)' : conn.target.nodeId}.${conn.target.portName}`);
    });

    // Run combinational simulation
    const simResult = runCombinationalSimulation(testCircuit);

    console.log(`\n=== Simulation Results ===`);
    const allPorts = Array.from(simResult.portValues.keys()).sort();
    allPorts.forEach(key => {
      const value = simResult.portValues.get(key);
      console.log(`  ${key} = ${value}`);
    });

    // Check specific values
    const holderNode = testCircuit.nodes.find(n => n.componentRef === 'ConstantHolder');
    const bufferNode = testCircuit.nodes.find(n => n.componentRef === 'Buffer');

    if (holderNode && bufferNode) {
      const holderValue = simResult.portValues.get(`${holderNode.id}.value`);
      const bufferInValue = simResult.portValues.get(`${bufferNode.id}.in`);
      const bufferOutValue = simResult.portValues.get(`${bufferNode.id}.out`);
      const circuitOut = simResult.portValues.get('.out');

      console.log(`\n=== Key Values ===`);
      console.log(`holder.value = ${holderValue}`);
      console.log(`buffer.in = ${bufferInValue}`);
      console.log(`buffer.out = ${bufferOutValue}`);
      console.log(`.out = ${circuitOut}`);

      expect(holderValue).toBe(169);
      expect(bufferInValue).toBe(169);
      expect(bufferOutValue).toBe(169);
    }

    expect(simResult.portValues.get('.out')).toBe(169);
  });
});
