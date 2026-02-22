/**
 * Test if Constant works inside TWO levels of composite nesting
 * This matches the actual circuit structure: MemoryCPU → CompleteCPU → byte_0
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

describe('Two-Level Nested Constant Test', () => {
  beforeAll(() => {
    const store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());

    // Level 1: Innermost circuit with Constant
    const innermostCircuit: Circuit = {
      id: 'innermost',
      name: 'InnermostCircuit',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'value', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const_innermost',
          componentRef: 'Constant',
          arguments: { value: 169 },  // Using 169 like byte_0
          inputs: [],
          outputs: [{ id: 'const_innermost.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'const_innermost', portName: 'out' },
          target: { nodeId: '', portName: 'value' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // Level 2: Middle circuit that contains innermost
    const middleCircuit: Circuit = {
      id: 'middle',
      name: 'MiddleCircuit',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'data', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'inner_instance',
          componentRef: 'InnermostCircuit',
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
          target: { nodeId: '', portName: 'data' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    store.registerUser(innermostCircuit);
    store.registerUser(middleCircuit);
  });

  it('should evaluate Constant inside TWO levels of composite nesting', () => {
    // Level 3: Outermost circuit (like MemoryCPU)
    const outermostCircuit: Circuit = {
      id: 'outermost',
      name: 'OutermostCircuit',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'result', portType: busType(8) }],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'middle_instance',
          componentRef: 'MiddleCircuit',
          arguments: {},
          inputs: [],
          outputs: [{ id: 'middle_instance.data', name: 'data', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'middle_instance', portName: 'data' },
          target: { nodeId: '', portName: 'result' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const sim = createSimulatorFromCircuit(outermostCircuit, getLibrary());
    const result = sim.runCombinational();

    console.log('\n=== Two-Level Nested Constant Test ===');
    console.log(`middle_instance.data: ${result.portValues.get('middle_instance.data')}`);
    console.log(`.result: ${result.portValues.get('.result')}`);

    expect(result.portValues.get('.result')).toBe(169);
  });
});
