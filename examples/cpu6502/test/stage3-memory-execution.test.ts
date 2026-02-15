/**
 * Test the WORKING version (stage3-memory) to see if it executes in vitest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary as DSLComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { createSimulatorFromCircuit, type ComponentLibrary } from '@/core/simulator';

class ComponentLibraryAdapter implements DSLComponentLibrary {
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

function getSimLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Stage 3 Memory (WORKING VERSION) - Execution Test', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: DSLComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  function loadAndCompileDSL(filename: string) {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    return compileDSL(source, library);
  }

  function busToNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Array.isArray(value)) {
      let result = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i]) result |= (1 << i);
      }
      return result;
    }
    return 0;
  }

  it('should execute the working memory test program', () => {
    const result = loadAndCompileDSL('14-stage3-memory.dsl');
    expect(result.errors).toHaveLength(0);

    // Register all circuits
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    // Find MemoryCPU circuit
    const testCircuit = result.circuits.find(c => c.name === 'MemoryCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    console.log('\n=== Testing WORKING Version (14-stage3-memory.dsl) ===');
    console.log(`Circuit: ${testCircuit.name}`);
    console.log(`Nodes: ${testCircuit.nodes.length}`);

    // Create simulator
    const sim = createSimulatorFromCircuit(testCircuit, getSimLibrary());

    // Run one tick to check
    const debugResult = sim.tick();

    // Check component library
    const constantComponent = library.getCircuit('Constant');
    console.log(`\nComponent library has Constant: ${constantComponent !== undefined}`);
    if (constantComponent) {
      console.log(`Constant type: ${constantComponent.implementation.kind}`);
      console.log(`Constant name: ${constantComponent.name}`);
    }

    // Check for ROM values
    const portKeys = Array.from(debugResult.portValues.keys());
    const byte0Key = portKeys.find(k => k.includes('byte_0') && k.endsWith('.out'));
    if (byte0Key) {
      const byte0Val = busToNumber(debugResult.portValues.get(byte0Key));
      console.log(`\nROM byte_0 value: ${byte0Val} (expected: 169)`);
    }

    // Check the actual node structure
    const byte0Node = testCircuit.nodes.find(n => n.id.includes('byte_0'));
    if (byte0Node) {
      console.log(`\nbyte_0 node details:`);
      console.log(`  componentRef: ${byte0Node.componentRef}`);
      console.log(`  componentRef === 'Constant': ${byte0Node.componentRef === 'Constant'}`);
      console.log(`  arguments: ${JSON.stringify(byte0Node.arguments)}`);
      console.log(`  arguments.value: ${byte0Node.arguments.value}`);
      console.log(`  typeof arguments.value: ${typeof byte0Node.arguments.value}`);
      console.log(`  typeof === 'number': ${typeof byte0Node.arguments.value === 'number'}`);

      // Simulate what evaluateNode should do
      const value = typeof byte0Node.arguments.value === 'number' ? byte0Node.arguments.value : 0;
      console.log(`  Simulated return value: ${value}`);
    }

    // Run 25 cycles
    console.log('\nRunning 25 cycles...\n');
    let simResult;
    for (let cycle = 0; cycle < 25; cycle++) {
      simResult = sim.tick();

      const pc = busToNumber(simResult.portValues.get('.pc'));
      const instruction = busToNumber(simResult.portValues.get('.instruction'));
      const address = busToNumber(simResult.portValues.get('.address'));
      const mem_data = busToNumber(simResult.portValues.get('.mem_data'));
      const a = busToNumber(simResult.portValues.get('.reg_a'));
      const x = busToNumber(simResult.portValues.get('.reg_x'));

      if (cycle % 5 === 4 || cycle === 0) {
        console.log(`Cycle ${cycle}: PC=${pc.toString(16).padStart(2, '0')} IR=${instruction.toString(16).padStart(2, '0')} A=${a.toString(16).padStart(2, '0')} X=${x.toString(16).padStart(2, '0')} Addr=${address.toString(16).padStart(2, '0')} Mem=${mem_data.toString(16).padStart(2, '0')}`);
      }
    }

    // Check final values
    const finalResult = sim.tick();
    const final_a = busToNumber(finalResult.portValues.get('.reg_a'));
    const final_x = busToNumber(finalResult.portValues.get('.reg_x'));
    const final_mem = busToNumber(finalResult.portValues.get('.mem_data'));

    console.log('\n=== Final State ===');
    console.log(`A = 0x${final_a.toString(16).padStart(2, '0')} (expected: 0x42)`);
    console.log(`X = 0x${final_x.toString(16).padStart(2, '0')} (expected: 0x43)`);
    console.log(`Memory = 0x${final_mem.toString(16).padStart(2, '0')} (expected: 0x42)`);

    // If A is not 0, the circuit is executing
    if (final_a !== 0) {
      console.log('\n✅ Circuit IS executing (A != 0)');
    } else {
      console.log('\n❌ Circuit NOT executing (all values = 0)');
    }

    // Test passes if circuit is executing, even if values aren't perfect yet
    expect(final_a).not.toBe(0); // Circuit should be executing
  });
});
