/**
 * Test a simple DSL-compiled circuit with Constant to compare structure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

describe('DSL-Compiled Constant Test', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('should compile and evaluate a simple DSL circuit with Constant', () => {
    // Create a minimal DSL with just a Constant
    const dslSource = `
circuit SimpleConstTest {
  output out: Bus[8]

  impl {
    node c: Constant(value=169)
    connect c.out -> out
  }
}
`;

    const result = compileDSL(dslSource, library);
    expect(result.errors).toHaveLength(0);

    // Register compiled circuit
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'SimpleConstTest');
    expect(testCircuit).toBeDefined();

    if (!testCircuit) return;

    // Inspect the compiled node structure
    console.log('\n=== DSL-Compiled Circuit Structure ===');
    console.log(`Circuit: ${testCircuit.name}`);
    console.log(`Nodes: ${testCircuit.nodes.length}`);

    const constNode = testCircuit.nodes[0];
    console.log(`\nNode 0:`);
    console.log(`  id: ${constNode.id}`);
    console.log(`  componentRef: ${constNode.componentRef}`);
    console.log(`  componentRef === 'Constant': ${constNode.componentRef === 'Constant'}`);
    console.log(`  arguments: ${JSON.stringify(constNode.arguments)}`);
    console.log(`  typeof arguments.value: ${typeof constNode.arguments.value}`);
    console.log(`  arguments.value === 169: ${constNode.arguments.value === 169}`);

    // Try to run the simulation
    const simResult = runCombinationalSimulation(testCircuit);

    console.log(`\nSimulation Results:`);
    console.log(`  .out = ${simResult.portValues.get('.out')}`);
    console.log(`  ${constNode.id}.out = ${simResult.portValues.get(`${constNode.id}.out`)}`);

    // Check if component library has Constant
    const constantComponent = library.getCircuit('Constant');
    console.log(`\nComponent library has Constant: ${constantComponent !== undefined}`);
    if (constantComponent) {
      console.log(`  Constant.implementation.kind: ${constantComponent.implementation.kind}`);
    }

    expect(simResult.portValues.get('.out')).toBe(169);
  });
});
