/**
 * Test DSL-compiled Constant with SEQUENTIAL simulation
 * This matches how the CPU tests run
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate, TOP_LEVEL_NODE } from '../../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
} from '../../../src/features/visual-editor/lib/flat-simulator';

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

describe('DSL Sequential Constant Test', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('should evaluate DSL-compiled Constant with sequential simulation', () => {
    const dslSource = `
circuit SequentialConstTest {
  output out: Bus[8]
  clock clk

  impl {
    node c: Constant(value=169)
    node we_on: Constant(value=1)
    node reg: Register(width=8)

    connect c.out -> reg.data
    connect we_on.out -> reg.we
    connect clk -> reg.clk
    connect reg.q -> out
  }
}
`;

    const result = compileDSL(dslSource, library);
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'SequentialConstTest');
    expect(testCircuit).toBeDefined();

    if (!testCircuit) return;

    console.log('\n=== DSL Sequential Constant Test ===');
    console.log(`Circuit: ${testCircuit.name}`);
    console.log(`Nodes: ${testCircuit.nodes.length}`);

    // Inspect Constant node
    const constNode = testCircuit.nodes.find(n => n.componentRef === 'Constant');
    if (constNode) {
      console.log(`\nConstant node:`);
      console.log(`  id: ${constNode.id}`);
      console.log(`  componentRef: ${constNode.componentRef}`);
      console.log(`  arguments: ${JSON.stringify(constNode.arguments)}`);
      console.log(`  arguments.value: ${constNode.arguments.value}`);
    }

    // Elaborate and initialize using flat simulator
    const flatCircuit = elaborate(testCircuit, store);
    let seqState = initializeFlatSequentialState(flatCircuit);

    console.log(`\nFlat circuit nodes: ${flatCircuit.nodes.length}`);

    // Run one tick
    const tick1 = runFlatSimulationTick(flatCircuit, seqState);

    // Find constant output value
    let constValue = 0;
    for (const [key, value] of tick1.portValues.entries()) {
      if (key.includes('_c_') && key.endsWith('.out')) {
        constValue = typeof value === 'number' ? value : 0;
        console.log(`  Found constant at ${key} = ${value}`);
      }
    }

    // Find output value
    const regValue = tick1.portValues.get(`${TOP_LEVEL_NODE}.out`);

    console.log(`\nAfter tick 1:`);
    console.log(`  Constant output: ${constValue}`);
    console.log(`  Register output: ${regValue}`);

    // Run another tick (register should have latched the value)
    if (tick1.sequentialState) {
      seqState = tick1.sequentialState;
    }
    const tick2 = runFlatSimulationTick(flatCircuit, seqState);
    const regValue2 = tick2.portValues.get(`${TOP_LEVEL_NODE}.out`);

    console.log(`\nAfter tick 2:`);
    console.log(`  Register output: ${regValue2}`);

    expect(constValue).toBe(169);
    expect(regValue2).toBe(169);
  });
});
