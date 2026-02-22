/**
 * Test runtime ROM loading
 *
 * Verifies that ROM data can be loaded at runtime (not in DSL)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMemoryDataStore } from '../../../src/features/visual-editor/stores/memory-data-store';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
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

describe('Runtime ROM Loading', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);

    // Clear any previously loaded memory data
    useMemoryDataStore.getState().clearAll();
  });

  it('should use runtime-loaded ROM data instead of DSL data', () => {
    // DSL with ROM that has baseAddress - purely structural
    // baseAddress tells the ROM where it's mapped in the address space
    // The ROM subtracts baseAddress from input addresses (like real hardware)
    const dsl = `
      circuit RuntimeROMTest {
        impl {
          node addr_lo: Constant(value=0)
          node addr_hi: Constant(value=192)  // $C0 -> address $C000
          node addr: AddressCombiner
          connect addr_lo.out -> addr.lo
          connect addr_hi.out -> addr.hi

          node rom: ROM(baseAddress=0xC000)  // ROM mapped at $C000

          connect addr.out -> rom.addr

          node display: HexDisplay
          connect rom.data_out -> display.in
        }
      }
    `;

    const result = compileDSL(dsl, library);
    expect(result.errors).toHaveLength(0);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'RuntimeROMTest');
    expect(testCircuit).toBeDefined();

    // Load ROM data at runtime - data is at INTERNAL addresses (0, 1, 2, ...)
    // Internal address 0 corresponds to $C000 because of baseAddress
    const romData = new Uint8Array(256);
    romData[0] = 0xAB; // Internal address 0 = $C000

    useMemoryDataStore.getState().loadData('rom', romData, 'test.bin', 0);

    // Elaborate and simulate
    const flatCircuit = elaborate(testCircuit!, store);
    const seqState = initializeFlatSequentialState(flatCircuit);
    const simResult = runFlatSimulationTick(flatCircuit, seqState);

    expect(simResult.error).toBeUndefined();

    // Find display value - should be 0xAB from runtime-loaded ROM
    let displayValue: number | undefined;
    for (const [key, value] of simResult.portValues.entries()) {
      if (key.includes('display') && key.includes('.in')) {
        displayValue = value as number;
      }
    }

    expect(displayValue).toBe(0xAB);
  });

  it('should return 0 for empty ROM when no data loaded', () => {
    const dsl = `
      circuit EmptyROMTest {
        impl {
          node addr_lo: Constant(value=0)
          node addr_hi: Constant(value=192)
          node addr: AddressCombiner
          connect addr_lo.out -> addr.lo
          connect addr_hi.out -> addr.hi

          node rom: ROM(baseAddress=0xC000)  // No data, mapped at $C000

          connect addr.out -> rom.addr

          node display: HexDisplay
          connect rom.data_out -> display.in
        }
      }
    `;

    const result = compileDSL(dsl, library);
    expect(result.errors).toHaveLength(0);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'EmptyROMTest');
    expect(testCircuit).toBeDefined();

    // Don't load any data - ROM should be empty
    const flatCircuit = elaborate(testCircuit!, store);
    const seqState = initializeFlatSequentialState(flatCircuit);
    const simResult = runFlatSimulationTick(flatCircuit, seqState);

    expect(simResult.error).toBeUndefined();

    // Find display value - should be 0 (empty ROM)
    let displayValue: number | undefined;
    for (const [key, value] of simResult.portValues.entries()) {
      if (key.includes('display') && key.includes('.in')) {
        displayValue = value as number;
      }
    }

    expect(displayValue).toBe(0);
  });

  it('should load runtime ROM data into Stage7Test and execute', () => {
    // Load and compile Stage7Test from cpu6502-system.dsl
    const dslPath = require('path').resolve(__dirname, '../cpu6502-system.dsl');
    const dsl = require('fs').readFileSync(dslPath, 'utf-8');
    const result = compileDSL(dsl, library);
    expect(result.errors).toHaveLength(0);
    result.circuits.forEach(c => library.addCircuit!(c));

    const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
    expect(testCircuit).toBeDefined();

    // Load simple.bin - the ROM data at internal addresses
    const binPath = require('path').resolve(__dirname, '../cc65/simple.bin');
    const binData = new Uint8Array(require('fs').readFileSync(binPath));
    useMemoryDataStore.getState().loadData('rom', binData, 'simple.bin', 0);

    const flatCircuit = elaborate(testCircuit!, store);

    // Find all ROM nodes and verify pattern matching
    const romNodes = flatCircuit.nodes.filter(n => n.primitiveType === 'ROM');
    console.log('ROM nodes found:', romNodes.length);
    for (const node of romNodes) {
      console.log('  ROM ID:', node.id);
      console.log('  baseAddress:', node.arguments.baseAddress);
      // Check if pattern matches
      const matchedData = useMemoryDataStore.getState().getDataForNode(node.id);
      console.log('  matched data:', matchedData ? `${matchedData.size} bytes` : 'NONE');
    }

    // Verify ROM data was loaded and matched
    expect(romNodes.length).toBe(1);
    const romNode = romNodes[0];
    expect(romNode.id.toLowerCase()).toContain('rom');
    expect(romNode.arguments.baseAddress).toBe(0xC000);

    const romData = useMemoryDataStore.getState().getDataForNode(romNode.id);
    expect(romData).toBeDefined();
    expect(romData!.size).toBeGreaterThan(0);

    // Initialize and run a few cycles
    const seqState = initializeFlatSequentialState(flatCircuit);

    // Check initial ROM state
    const romState = seqState.currentState.get(romNode.id) as Map<number, number>;
    console.log('ROM state after init:', romState ? `Map with ${romState.size} entries` : 'NONE');

    // Verify critical bytes are present from simple.bin
    // simple.bin starts with: A2 FF 9A A9 48 8D 00 F0 ...
    // A2 FF = LDX #$FF, 9A = TXS, A9 48 = LDA #$48 ('H'), 8D 00 F0 = STA $F000
    console.log('Internal addr 0 (LDX):', romState?.get(0)?.toString(16));  // Should be $A2
    console.log('Internal addr 3 (LDA):', romState?.get(3)?.toString(16));  // Should be $A9
    console.log('Internal addr 4 (H):', romState?.get(4)?.toString(16));    // Should be $48

    expect(romState?.get(0)).toBe(0xA2);  // LDX opcode
    expect(romState?.get(3)).toBe(0xA9);  // LDA opcode
    expect(romState?.get(4)).toBe(0x48);  // 'H' character

    // Also check reset vector at internal addresses $3FFC/$3FFD
    // These are $FFFC-$C000 = $3FFC and $FFFD-$C000 = $3FFD
    // Note: low byte is 0 which isn't stored (sparse), but ROM returns 0 for missing keys
    console.log('Reset vector low ($3FFC):', romState?.get(0x3FFC)?.toString(16) ?? '0 (not stored, sparse)');
    console.log('Reset vector high ($3FFD):', romState?.get(0x3FFD)?.toString(16));
    expect(romState?.get(0x3FFD)).toBe(0xC0);

    // Run a simulation tick and verify ROM returns correct data for given addresses
    const simResult = runFlatSimulationTick(flatCircuit, seqState);
    expect(simResult.error).toBeUndefined();

    // Find the ROM's data_out port and verify it returns valid data
    // The ROM should be reading from the reset vector address initially
    let romDataOut: number | undefined;
    for (const [key, value] of simResult.portValues.entries()) {
      if (key.includes('_rom_') && key.endsWith('.data_out')) {
        romDataOut = value as number;
      }
    }
    // ROM should return some data (either from program or reset vector area)
    expect(romDataOut).toBeDefined();
    console.log('ROM data_out after first tick:', romDataOut?.toString(16));
  });
});
