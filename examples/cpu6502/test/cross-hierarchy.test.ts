/**
 * Minimal test for cross-hierarchy ROM wiring
 * Tests that ROM data flows correctly when ROM is at a higher level than the consumer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate } from '../../../src/features/visual-editor/lib/elaboration';
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

describe('Cross-Hierarchy ROM Wiring', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('should pass ROM data through one level of hierarchy', () => {
    const dsl = `
      // Inner just passes data through
      circuit Inner {
        input data_in: Bus[8]
        output data_out: Bus[8]
        impl {
          connect data_in -> data_out
        }
      }

      // Top has ROM and Inner, wires them
      circuit TopTest {
        impl {
          node rom: ROM(data={ 0: 0xAB })
          // Use AddressCombiner to create 16-bit address from 8-bit lo/hi
          node addr_lo: Constant(value=0)
          node addr_hi: Constant(value=0)
          node addr: AddressCombiner
          connect addr_lo.out -> addr.lo
          connect addr_hi.out -> addr.hi
          connect addr.out -> rom.addr

          node inner: Inner
          connect rom.data_out -> inner.data_in

          node display: HexDisplay
          connect inner.data_out -> display.in
        }
      }
    `;

    const result = compileDSL(dsl, library);
    expect(result.errors).toHaveLength(0);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'TopTest');
    expect(testCircuit).toBeDefined();

    const flatCircuit = elaborate(testCircuit!, store);
    const seqState = initializeFlatSequentialState(flatCircuit);
    const simResult = runFlatSimulationTick(flatCircuit, seqState);

    expect(simResult.error).toBeUndefined();

    // Find display value
    let displayValue: number | undefined;
    for (const [key, value] of simResult.portValues.entries()) {
      if (key.includes('display') && key.includes('.in')) {
        displayValue = value as number;
      }
    }

    console.log('One level: display =', displayValue);
    expect(displayValue).toBe(0xAB);
  });

  it('should pass ROM data through two levels with address flowing out', () => {
    const dsl = `
      // Inner passes data through and outputs a constant 16-bit address
      circuit Inner {
        input data_in: Bus[8]
        output data_out: Bus[8]
        output addr_out: Bus[16]
        impl {
          connect data_in -> data_out
          // Create 16-bit address: 42 = 0x002A
          node addr_lo: Constant(value=42)
          node addr_hi: Constant(value=0)
          node addr_combine: AddressCombiner
          connect addr_lo.out -> addr_combine.lo
          connect addr_hi.out -> addr_combine.hi
          connect addr_combine.out -> addr_out
        }
      }

      // Middle wraps Inner
      circuit Middle {
        input data_in: Bus[8]
        output data_out: Bus[8]
        output addr_out: Bus[16]
        impl {
          node inner: Inner
          connect data_in -> inner.data_in
          connect inner.data_out -> data_out
          connect inner.addr_out -> addr_out
        }
      }

      // Top has ROM and Middle - address flows out, data flows back in
      circuit TopTest2 {
        impl {
          node middle: Middle
          node rom: ROM(data={ 42: 0xCD })

          // Address from middle -> ROM
          connect middle.addr_out -> rom.addr
          // Data from ROM -> middle
          connect rom.data_out -> middle.data_in

          node display: HexDisplay
          connect middle.data_out -> display.in
        }
      }
    `;

    const result = compileDSL(dsl, library);
    expect(result.errors).toHaveLength(0);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'TopTest2');
    expect(testCircuit).toBeDefined();

    const flatCircuit = elaborate(testCircuit!, store);
    console.log('Two levels: nodes =', flatCircuit.nodes.length, 'conns =', flatCircuit.connections.length);
    console.log('Nodes:', flatCircuit.nodes.map(n => `${n.id} (${n.primitiveType})`));
    console.log('Connections:', flatCircuit.connections.map(c => `${c.source.nodeId}.${c.source.portName} -> ${c.target.nodeId}.${c.target.portName}`));

    const seqState = initializeFlatSequentialState(flatCircuit);
    const simResult = runFlatSimulationTick(flatCircuit, seqState);

    expect(simResult.error).toBeUndefined();

    // Log all port values
    console.log('Port values:');
    for (const [key, value] of simResult.portValues.entries()) {
      console.log(`  ${key} = ${value}`);
    }

    // Find display value
    let displayValue: number | undefined;
    for (const [key, value] of simResult.portValues.entries()) {
      if (key.includes('display') && key.includes('.in')) {
        displayValue = value as number;
      }
    }

    console.log('Two levels: display =', displayValue);
    expect(displayValue).toBe(0xCD);
  });
});
