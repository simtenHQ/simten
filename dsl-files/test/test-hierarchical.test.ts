/**
 * Test hierarchical composition with minimal example
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { runCombinationalSimulation } from '../../src/features/visual-editor/lib/simulator-v0.1';
import type { Circuit } from '../../src/features/visual-editor/types/ir-v0.1';

describe('Hierarchical Composition', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  class TestLibrary implements ComponentLibrary {
    constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}

    getCircuit(name: string): DslCircuit | undefined {
      const comp = this.store.resolveComponent(name);
      if (!comp) return undefined;

      return {
        id: comp.id,
        name: comp.name,
        parameters: comp.parameters || [],
        inputs: comp.inputs || [],
        outputs: comp.outputs || [],
        clocks: comp.clocks || [],
        state: comp.state || [],
        nodes: comp.nodes || [],
        connections: comp.connections || [],
        implementation: comp.implementation || { kind: 'primitive' },
      } as DslCircuit;
    }

    hasCircuit(name: string): boolean {
      return this.store.resolveComponent(name) !== undefined;
    }

    addCircuit(circuit: DslCircuit): void {
      this.store.registerUser(circuit as any);
    }
  }

  it('should compile and simulate minimal hierarchical circuit', () => {
    const source = readFileSync(
      resolve(__dirname, '../../dsl-files/test-hierarchical.dsl'),
      'utf-8'
    );

    const testLibrary = new TestLibrary(library);
    const result = compileDSL(source, testLibrary);

    // Check compilation
    if (result.errors.length > 0) {
      console.log('Compilation errors:', result.errors.map(e => e.message));
    }
    expect(result.errors).toEqual([]);
    expect(result.circuits.length).toBe(2);

    // Get the parent circuit (should be the last one)
    const parentCircuit = result.circuits[1];
    expect(parentCircuit.name).toBe('Parent');

    // Check that child is instantiated
    const childNode = parentCircuit.nodes?.find(n => n.componentRef === 'SimpleChild');
    expect(childNode).toBeDefined();

    // Run combinational simulation
    const simResult = runCombinationalSimulation(parentCircuit);

    if (simResult.error) {
      console.error('Simulation error:', simResult.error);
    }
    expect(simResult.error).toBeUndefined();
  });
});
