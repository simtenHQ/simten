import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary } from '../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import { initializeFlatSequentialState, runFlatSimulationTick } from '../../src/features/visual-editor/lib/flat-simulator';
import type { Circuit } from '../../src/features/visual-editor/types/ir-v0.1';

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

describe('Simple Toggle - Sequential Flat Simulator', () => {
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
    const circuit = loadDSL('SimpleToggle.dsl');
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('SimpleToggle');
  });

  it('should toggle flip-flop output on each clock cycle', () => {
    const circuit = loadDSL('SimpleToggle.dsl');

    // Elaborate circuit to flat primitives
    const flatCircuit = elaborate(circuit, store);
    console.log(`\nFlat nodes: ${flatCircuit.nodes.length}`);
    console.log('Primitives:', flatCircuit.nodes.map(n => n.primitiveType).join(', '));

    // Initialize sequential state
    let seqState = initializeFlatSequentialState(flatCircuit);

    // Find the flip-flop node
    const ffNode = flatCircuit.nodes.find(n => n.primitiveType === 'DFlipFlop');
    expect(ffNode).toBeDefined();
    console.log(`\nFlip-flop ID: ${ffNode!.id}`);

    // Initial state should be false
    const initialState = seqState.currentState.get(ffNode!.id);
    console.log(`Initial state: ${initialState}`);
    expect(initialState).toBe(false);

    console.log('\n=== Clock Cycle Simulation ===');

    // Run multiple clock cycles and verify toggle behavior
    const states: boolean[] = [initialState as boolean];

    for (let cycle = 1; cycle <= 5; cycle++) {
      // Run simulation tick
      const result = runFlatSimulationTick(flatCircuit, seqState);

      if (result.error) {
        throw new Error(`Simulation error: ${result.error}`);
      }

      seqState = result.sequentialState!;

      // Get flip-flop state after this cycle
      const ffState = seqState.currentState.get(ffNode!.id) as boolean;
      states.push(ffState);

      // Get LED value
      const ledNode = flatCircuit.nodes.find(n => n.primitiveType === 'Led');
      const ledValue = result.portValues.get(`${ledNode!.id}.in`);

      console.log(`Cycle ${cycle}: FF=${ffState}, LED=${ledValue}`);

      // Verify toggle behavior: each cycle should flip the state
      expect(ffState).toBe(!states[cycle - 1]);
    }

    // Verify the toggle pattern: false -> true -> false -> true -> false -> true
    expect(states).toEqual([false, true, false, true, false, true]);

    console.log('\n✅ Sequential toggle working correctly!');
    console.log('Pattern:', states.join(' -> '));
  });

  it('should have feedback connection in flat circuit', () => {
    const circuit = loadDSL('SimpleToggle.dsl');
    const flatCircuit = elaborate(circuit, store);

    console.log(`\n=== Flat Circuit Connections (${flatCircuit.connections.length}) ===`);
    for (const conn of flatCircuit.connections) {
      const sourceParts = conn.source.nodeId.split('_');
      const targetParts = conn.target.nodeId.split('_');
      const sourceShort = sourceParts[1] || conn.source.nodeId;
      const targetShort = targetParts[1] || conn.target.nodeId;
      console.log(`${sourceShort}.${conn.source.portName} -> ${targetShort}.${conn.target.portName}`);
    }

    // Should have 2 connections:
    // ff.q -> inverter.in
    // inverter.out -> ff.d
    // Plus led connections
    expect(flatCircuit.connections.length).toBeGreaterThanOrEqual(2);
  });
});
