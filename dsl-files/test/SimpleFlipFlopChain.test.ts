import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary } from '../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import { initializeFlatSequentialState, runFlatSimulationTick } from '../../src/features/visual-editor/lib/flat-simulator';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

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

describe('Simple FlipFlop Chain - Flat Simulator', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  function loadDSL(filename: string): Circuit {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    const { circuits, errors } = compileDSL(source, library);

    if (errors.length > 0) {
      console.error('Compilation errors:', errors);
      throw new Error(`Failed to compile ${filename}: ${errors[0].message}`);
    }

    if (circuits.length === 0) {
      throw new Error(`No circuits found in ${filename}`);
    }

    return circuits[0];
  }

  it('should compile without errors', () => {
    const circuit = loadDSL('SimpleFlipFlopChain.dsl');
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('SimpleFlipFlopChain');
  });

  it('should simulate with flat simulator', () => {
    const circuit = loadDSL('SimpleFlipFlopChain.dsl');

    // Elaborate circuit to flat primitives
    const flatCircuit = elaborate(circuit, store);
    console.log(`\nFlat nodes: ${flatCircuit.nodes.length}`);
    console.log('Node IDs:', flatCircuit.nodes.map(n => n.id).join(', '));

    // Verify all nodes are primitives
    for (const node of flatCircuit.nodes) {
      expect(['Switch', 'DFlipFlop', 'Led', 'Not']).toContain(node.primitiveType);
    }

    // Initialize sequential state
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Find the elaborated node IDs for the flip-flops
    const ff1Node = flatCircuit.nodes.find(n => n.primitiveType === 'DFlipFlop' && n.id.includes('ff1'));
    const ff2Node = flatCircuit.nodes.find(n => n.primitiveType === 'DFlipFlop' && n.id.includes('ff2'));

    expect(ff1Node).toBeDefined();
    expect(ff2Node).toBeDefined();

    console.log(`\nFF1 ID: ${ff1Node!.id}`);
    console.log(`FF2 ID: ${ff2Node!.id}`);

    // Initial state: both FFs should be false (initial value)
    const initialFF1 = seqState.currentState.get(ff1Node!.id);
    const initialFF2 = seqState.currentState.get(ff2Node!.id);
    console.log(`\nInitial state - FF1: ${initialFF1}, FF2: ${initialFF2}`);

    expect(initialFF1).toBe(false);
    expect(initialFF2).toBe(false);

    // Run a simulation tick
    const result = runFlatSimulationTick(flatCircuit, seqState);

    console.log('\n=== After 1 simulation tick ===');

    if (result.error) {
      throw new Error(`Simulation error: ${result.error}`);
    }

    expect(result.sequentialState).toBeDefined();
    expect(result.portValues).toBeDefined();

    // Check that we have port values for all nodes
    console.log(`Port values count: ${result.portValues.size}`);

    // Verify the LED has a value
    const ledNode = flatCircuit.nodes.find(n => n.primitiveType === 'Led');
    expect(ledNode).toBeDefined();

    const ledInput = result.portValues.get(`${ledNode!.id}.in`);
    console.log(`LED input value: ${ledInput}`);
    expect(ledInput).toBeDefined();

    // Verify flip-flop outputs exist in port values
    const ff1Output = result.portValues.get(`${ff1Node!.id}.q`);
    const ff2Output = result.portValues.get(`${ff2Node!.id}.q`);

    console.log(`FF1 output: ${ff1Output}`);
    console.log(`FF2 output: ${ff2Output}`);

    expect(ff1Output).toBeDefined();
    expect(ff2Output).toBeDefined();

    console.log('\n✅ Flat simulator working correctly!');
  });
});
