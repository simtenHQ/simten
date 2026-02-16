/**
 * Simple test to check if Constant primitive works
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { busType, type Circuit } from '../../../src/features/visual-editor/types/circuit';
import { createSimulatorFromCircuit, type ComponentLibrary } from '@/core/simulator';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';

function getLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Constant Primitive Test', () => {
  beforeEach(() => {
    const store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
  });

  it('should output constant value', () => {
    const circuit: Circuit = {
      id: 'test',
      name: 'ConstantTest',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'out', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const1',
          label: 'Constant',
          componentRef: 'Constant',
          arguments: { value: 42 },
          inputs: [],
          outputs: [{ id: 'const1.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'const1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const sim = createSimulatorFromCircuit(circuit, getLibrary());
    const result = sim.runCombinational();

    console.log('Constant output:', result.portValues.get('const1.out'));
    console.log('Circuit output:', result.portValues.get('.out'));

    expect(result.portValues.get('const1.out')).toBe(42);
    expect(result.portValues.get('.out')).toBe(42);
  });
});
