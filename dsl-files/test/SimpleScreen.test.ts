import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, type ComponentLibrary } from '../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitive-registry';
import { elaborate } from '../../src/features/visual-editor/lib/elaboration';
import { initializeFlatSequentialState, runFlatSimulationTick } from '../../src/features/visual-editor/lib/flat-simulator';
import { projectCircuitToNodes } from '../../src/features/visual-editor/utils/projection';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

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

describe('Simple Screen - RAM Integration Test', () => {
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

  it('should initialize RAM with pixel data', () => {
    const circuit = loadDSL('SimpleScreen.dsl');
    const flatCircuit = elaborate(circuit, store);

    // Initialize sequential state
    const seqState = initializeFlatSequentialState(flatCircuit);

    // Find RAM node
    const ramNode = flatCircuit.nodes.find(n => n.primitiveType === 'DualPortRAM');
    expect(ramNode).toBeDefined();
    console.log(`\nRAM Node ID: ${ramNode!.id}`);

    // Get RAM state
    const ramState = seqState.currentState.get(ramNode!.id);
    console.log(`RAM State type: ${ramState?.constructor.name}`);
    expect(ramState).toBeDefined();
    expect(ramState).toBeInstanceOf(Map);

    const ramMap = ramState as Map<number, number>;
    console.log(`\nRAM contents (${ramMap.size} entries):`);

    // Check initialized values
    expect(ramMap.get(0)).toBe(1);
    expect(ramMap.get(1)).toBe(1);
    expect(ramMap.get(9)).toBe(1);
    expect(ramMap.get(63)).toBe(1);

    console.log(`  [0] = ${ramMap.get(0)}`);
    console.log(`  [1] = ${ramMap.get(1)}`);
    console.log(`  [9] = ${ramMap.get(9)}`);
    console.log(`  [63] = ${ramMap.get(63)}`);
  });

  it('should provide pixel data to Screen component via projection', () => {
    const circuit = loadDSL('SimpleScreen.dsl');
    const flatCircuit = elaborate(circuit, store);
    const seqState = initializeFlatSequentialState(flatCircuit);

    // Run simulation to get port values
    const result = runFlatSimulationTick(flatCircuit, seqState);
    expect(result.error).toBeUndefined();

    // Use projection to create ReactFlow nodes (this is what Canvas does)
    // Create metadata as a Record, not a Map
    const components: Record<string, any> = {};
    const connections: Record<string, any> = {};

    for (const node of circuit.nodes) {
      components[node.id] = {
        position: { x: 0, y: 0 },
        selected: false
      };
    }

    const metadata = { components, connections };

    const reactFlowNodes = projectCircuitToNodes(
      circuit,
      metadata,
      result.portValues,
      seqState
    );

    // Find the Screen node
    const screenNode = reactFlowNodes.find(n => n.data.componentRef === 'Screen');
    expect(screenNode).toBeDefined();

    console.log(`\nScreen Node Data:`);
    console.log(`  Component: ${screenNode!.data.componentRef}`);
    console.log(`  Has __pixels: ${screenNode!.data.__pixels !== undefined}`);

    if (screenNode!.data.__pixels) {
      const pixels = screenNode!.data.__pixels as number[];
      console.log(`  Pixel count: ${pixels.length}`);
      console.log(`  Pixel[0]: ${pixels[0]} (expected: 1)`);
      console.log(`  Pixel[1]: ${pixels[1]} (expected: 1)`);
      console.log(`  Pixel[9]: ${pixels[9]} (expected: 1)`);
      console.log(`  Pixel[63]: ${pixels[63]} (expected: 1)`);

      // Verify pixels were extracted correctly
      expect(pixels.length).toBe(64);
      expect(pixels[0]).toBe(1);
      expect(pixels[1]).toBe(1);
      expect(pixels[9]).toBe(1);
      expect(pixels[63]).toBe(1);

      console.log('\n✅ Screen receives pixel data correctly!');
    } else {
      console.error('\n❌ Screen node has no __pixels data!');
      console.log('Screen node data:', JSON.stringify(screenNode!.data, null, 2));
      throw new Error('Screen component did not receive pixel data');
    }
  });
});
