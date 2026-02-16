import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary } from '../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import { runFlatSimulationTick } from '../../src/features/visual-editor/lib/flat-simulator';
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

describe('Simple Combinational Circuit - Flat Simulator', () => {
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
    const circuit = loadDSL('SimpleCombinational.dsl');
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('SimpleCombinational');
    expect(circuit.nodes.length).toBe(5); // 2 switches + not + and + led
  });

  it('should simulate correctly with flat simulator', () => {
    const circuit = loadDSL('SimpleCombinational.dsl');

    // Elaborate circuit to flat primitives
    const flatCircuit = elaborate(circuit, store);
    console.log(`\nFlat nodes: ${flatCircuit.nodes.length}`);
    console.log('Primitives:', flatCircuit.nodes.map(n => n.primitiveType).join(', '));

    // Verify all nodes are primitives
    expect(flatCircuit.nodes.length).toBe(5);
    for (const node of flatCircuit.nodes) {
      expect(['Switch', 'Led', 'Not', 'And']).toContain(node.primitiveType);
    }

    // Run simulation (pass empty sequential state for combinational circuits)
    const emptySeqState = {
      currentState: new Map(),
      nextState: new Map(),
      clocks: new Map(),
      cycleCount: 0
    };
    const result = runFlatSimulationTick(flatCircuit, emptySeqState);

    console.log('\n=== Simulation Result ===');

    if (result.error) {
      throw new Error(`Simulation error: ${result.error}`);
    }

    expect(result.portValues).toBeDefined();
    console.log(`Port values count: ${result.portValues.size}`);

    // Find nodes
    const sw1Node = flatCircuit.nodes.find(n => n.primitiveType === 'Switch' && n.id.includes('sw1'));
    const sw2Node = flatCircuit.nodes.find(n => n.primitiveType === 'Switch' && n.id.includes('sw2'));
    const notNode = flatCircuit.nodes.find(n => n.primitiveType === 'Not');
    const andNode = flatCircuit.nodes.find(n => n.primitiveType === 'And');
    const ledNode = flatCircuit.nodes.find(n => n.primitiveType === 'Led');

    expect(sw1Node).toBeDefined();
    expect(sw2Node).toBeDefined();
    expect(notNode).toBeDefined();
    expect(andNode).toBeDefined();
    expect(ledNode).toBeDefined();

    // Get values
    const sw1Out = result.portValues.get(`${sw1Node!.id}.out`);
    const sw2Out = result.portValues.get(`${sw2Node!.id}.out`);
    const notOut = result.portValues.get(`${notNode!.id}.out`);
    const andOut = result.portValues.get(`${andNode!.id}.out`);
    const ledIn = result.portValues.get(`${ledNode!.id}.in`);

    console.log(`SW1: ${sw1Out} (expected: true)`);
    console.log(`SW2: ${sw2Out} (expected: false)`);
    console.log(`NOT: ${notOut} (expected: false, since sw1=true)`);
    console.log(`AND: ${andOut} (expected: false, since not=false AND sw2=false)`);
    console.log(`LED: ${ledIn} (expected: false)`);

    // Verify logic
    expect(sw1Out).toBe(true);  // sw1 value=1
    expect(sw2Out).toBe(false); // sw2 value=0
    expect(notOut).toBe(false); // NOT(true) = false
    expect(andOut).toBe(false); // false AND false = false
    expect(ledIn).toBe(false);  // LED shows AND output

    console.log('\n✅ Combinational logic working correctly!');
  });

  it('should have all connections in flat circuit', () => {
    const circuit = loadDSL('SimpleCombinational.dsl');
    const flatCircuit = elaborate(circuit, store);

    console.log(`\n=== Flat Circuit Connections (${flatCircuit.connections.length}) ===`);
    for (const conn of flatCircuit.connections) {
      console.log(`${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
    }

    // Should have 4 connections:
    // sw1.out -> inverter.in
    // inverter.out -> andGate.a
    // sw2.out -> andGate.b
    // andGate.out -> led.in
    expect(flatCircuit.connections.length).toBe(4);
  });
});
