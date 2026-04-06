/**
 * 6502 CPU Stage 3 Complete Execution Tests
 * Actually runs the simulator to test circuit behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, CircuitLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate, TOP_LEVEL_NODE } from '../../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
  type FlatSequentialState,
  type FlatSimulationResult,
} from '../../../src/features/visual-editor/lib/flat-simulator';

// Adapter to make CircuitLibraryStore compatible with CircuitLibrary interface
class CircuitLibraryAdapter implements CircuitLibrary {
  constructor(private store: ReturnType<typeof useCircuitLibraryStore.getState>) {}

  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveCircuit(name);
  }

  hasCircuit(name: string): boolean {
    return this.store.resolveCircuit(name) !== undefined;
  }

  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

describe('6502 CPU Stage 3 Complete: Execution Tests', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: CircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
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
      // Convert boolean array to number (LSB first)
      let result = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i]) result |= (1 << i);
      }
      return result;
    }
    return 0;
  }

  it('should execute test program correctly', () => {
    const result = loadAndCompileDSL('15-stage3-complete.dsl');
    expect(result.errors).toHaveLength(0);

    // Register ALL compiled circuits in the library (needed for composite resolution)
    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    // Find the CompleteTest circuit (wrapper with displays - this is what the UI loads)
    const testCircuit = result.circuits.find(c => c.name === 'CompleteTest');
    expect(testCircuit).toBeDefined();

    if (!testCircuit) return;

    console.log(`\n=== Registered ${result.circuits.length} circuits ===`);
    result.circuits.forEach(c => console.log(`  - ${c.name}`));

    // Check if Constant nodes have their value arguments
    const byte0Node = testCircuit.nodes.find(n => n.id.includes('byte_0'));
    if (byte0Node) {
      console.log(`\nbyte_0 node inspection:`);
      console.log(`  id: ${byte0Node.id}`);
      console.log(`  componentRef: ${byte0Node.componentRef}`);
      console.log(`  arguments: ${JSON.stringify(byte0Node.arguments)}`);
    }

    // Elaborate circuit (flatten composites)
    const flatCircuit = elaborate(testCircuit, store);

    // Initialize simulation state
    let seqState = initializeFlatSequentialState(flatCircuit);

    let simResult: FlatSimulationResult;

    console.log('\n=== Execution Test ===');
    console.log('Running test program: LDA #$42, STA $0010, LDA $0010, TAX, INX');
    console.log('Expected: A=0x42, X=0x43, Memory[$10]=0x42, PC=0x0A');
    console.log(`\nInitial state entries: ${seqState.currentState.size}`);
    console.log(`Circuit nodes: ${testCircuit.nodes.length}`);
    console.log(`Flat circuit nodes: ${flatCircuit.nodes.length}`);

    // Run one tick to see what ports are available
    const debugResult = runFlatSimulationTick(flatCircuit, seqState);
    if (debugResult.error) {
      console.log(`\n❌ SIMULATION ERROR: ${debugResult.error}\n`);
    }
    seqState = debugResult.sequentialState!;

    console.log(`\nAvailable ports after first tick:`);
    const portKeys = Array.from(debugResult.portValues.keys()).sort();
    portKeys.slice(0, 20).forEach(key => {
      const value = debugResult.portValues.get(key);
      console.log(`  ${key} = ${typeof value === 'boolean' ? value : busToNumber(value)}`);
    });
    console.log(`  ... (${portKeys.length} total ports)`);

    // Check ROM values
    console.log(`\nSearching for ROM byte ports:`);
    const byteKeys = portKeys.filter(k => k.includes('byte_'));
    byteKeys.slice(0, 10).forEach(key => {
      const value = debugResult.portValues.get(key);
      console.log(`  ${key} = ${busToNumber(value)}`);
    });

    // Check for top-level ports
    console.log(`\nSearching for top-level ports (found ${portKeys.filter(k => k.includes(TOP_LEVEL_NODE) || k.startsWith('.')).length}):`);
    const topKeys = portKeys.filter(k => k.includes(TOP_LEVEL_NODE) || k.startsWith('.'));
    topKeys.forEach(key => {
      const value = debugResult.portValues.get(key);
      console.log(`  ${key} = ${busToNumber(value)}`);
    });

    // Helper to get CPU output port value (from internal cpu node)
    // The CPU outputs are connected to displays, so we look for the connection source
    const getCPUPort = (outputName: string) => {
      // Find any port key that represents this CPU output
      // Format: CompleteTest_cpu_*.{outputName} or similar
      const portKey = Array.from(simResult.portValues.keys()).find(key => {
        // Look for cpu node's output ports (before going to displays)
        return key.includes('_cpu_') && (
          key.includes(`CompleteCPU_${outputName}`) ||
          key.endsWith(`.${outputName}`) ||
          (outputName === 'pc' && key.includes('pc_reg') && key.endsWith('.q')) ||
          (outputName === 'reg_a' && key.includes('regA') && key.endsWith('.q')) ||
          (outputName === 'reg_x' && key.includes('regX') && key.endsWith('.q')) ||
          (outputName === 'current_state' && key.includes('state_reg') && key.endsWith('.q')) ||
          (outputName === 'subcycle' && key.includes('subcycle_reg') && key.endsWith('.q'))
        );
      });

      if (!portKey) {
        console.log(`⚠️  Could not find port for ${outputName}`);
        return 0;
      }

      const value = simResult.portValues.get(portKey);
      return busToNumber(value);
    };

    // Run for 35 cycles and track state
    for (let cycle = 0; cycle < 35; cycle++) {
      simResult = runFlatSimulationTick(flatCircuit, seqState);
      if (simResult.sequentialState) {
        seqState = simResult.sequentialState;
      }

      const pc = getCPUPort('pc');
      const instruction = getCPUPort('instruction');
      const operand = getCPUPort('operand');
      const address = getCPUPort('address');
      const mem_data = getCPUPort('mem_data');
      const state = getCPUPort('current_state');
      const subcycle = getCPUPort('subcycle');
      const a = getCPUPort('reg_a');
      const x = getCPUPort('reg_x');

      // Log key cycles
      if (cycle === 4 || cycle === 10 || cycle === 17 || cycle === 21 || cycle === 34) {
        console.log(`Cycle ${cycle}: PC=${pc.toString(16).padStart(2, '0')} IR=${instruction.toString(16).padStart(2, '0')} State=${state} Sub=${subcycle} A=${a.toString(16).padStart(2, '0')} X=${x.toString(16).padStart(2, '0')} Addr=${address.toString(16).padStart(2, '0')} Mem=${mem_data.toString(16).padStart(2, '0')}`);
      }

      // Check A value during execution
      if (cycle >= 4 && cycle <= 18) {
        if (a !== 0x42) {
          console.log(`  ⚠️  Cycle ${cycle}: A should be 0x42 but is 0x${a.toString(16)}`);
        }
      }
    }

    // Get final values
    simResult = runFlatSimulationTick(flatCircuit, seqState);
    if (simResult.sequentialState) {
      seqState = simResult.sequentialState;
    }
    const final_a = getCPUPort('reg_a');
    const final_x = getCPUPort('reg_x');
    const final_pc = getCPUPort('pc');

    // Read memory state directly from the mem_10 register's internal state
    // This verifies STA $0010 actually wrote to memory, not just what's on the bus
    let mem_10_value = 0;
    for (const [stateKey, stateValue] of seqState.currentState.entries()) {
      if (stateKey.includes('mem_10')) {
        mem_10_value = typeof stateValue === 'number' ? stateValue : 0;
        console.log(`Found mem_10 register state: ${stateKey} = ${stateValue}`);
        break;
      }
    }

    console.log('\n=== Final State ===');
    console.log(`A = 0x${final_a.toString(16).padStart(2, '0')} (expected: 0x42)`);
    console.log(`X = 0x${final_x.toString(16).padStart(2, '0')} (expected: 0x43)`);
    console.log(`Memory[$10] state = 0x${mem_10_value.toString(16).padStart(2, '0')} (expected: 0x42)`);
    console.log(`PC = 0x${final_pc.toString(16).padStart(2, '0')} (expected: 0x0A)`);

    // Assertions
    expect(final_a).toBe(0x42);
    expect(final_x).toBe(0x43);
    // Verify memory write by reading register state directly
    expect(mem_10_value).toBe(0x42);
    // PC ends up past 0x0A because we run extra cycles to let register writes commit
    expect(final_pc).toBeGreaterThanOrEqual(0x0A);
  });
});
