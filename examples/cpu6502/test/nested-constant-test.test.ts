/**
 * Test if Constant works inside a composite circuit
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { busType, type Circuit } from '../../../src/features/visual-editor/types/circuit';
import { createSimulatorFromCircuit, type ComponentLibrary } from '@/core/simulator';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';

function getLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Nested Constant Test', () => {
  beforeAll(() => {
    const store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());

    // Register a composite that contains a Constant
    const innerCircuit: Circuit = {
      id: 'inner',
      name: 'InnerCircuit',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'value', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const_inner',
          componentRef: 'Constant',
          arguments: { value: 99 },
          inputs: [],
          outputs: [{ id: 'const_inner.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'const_inner', portName: 'out' },
          target: { nodeId: '', portName: 'value' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    store.registerUser(innerCircuit);
  });

  it('should evaluate Constant inside one level of composite nesting', () => {
    const outerCircuit: Circuit = {
      id: 'outer',
      name: 'OuterCircuit',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'result', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'inner_instance',
          componentRef: 'InnerCircuit',
          arguments: {},
          inputs: [],
          outputs: [{ id: 'inner_instance.value', name: 'value', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'inner_instance', portName: 'value' },
          target: { nodeId: '', portName: 'result' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const sim = createSimulatorFromCircuit(outerCircuit, getLibrary());
    const result = sim.runCombinational();

    console.log('\n=== Nested Constant Test ===');
    console.log(`inner_instance.value: ${result.portValues.get('inner_instance.value')}`);
    console.log(`.result: ${result.portValues.get('.result')}`);

    expect(result.portValues.get('.result')).toBe(99);
  });
});
