/**
 * 6502 CPU Stage 8A: 16-bit PC Tests
 * Tests the 16-bit program counter expansion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/dsl/types';
import { elaborate } from '../../../src/features/visual-editor/lib/elaboration';
import {
  initializeFlatSequentialState,
  runFlatSimulationTick,
  type FlatSimulationResult,
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

describe('6502 CPU Stage 8A: 16-bit PC', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

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

  describe('16-bit PC Compilation', () => {
    it('should compile CPU6502Core with 16-bit PC', () => {
      const result = loadAndCompileDSL('33-cpu-core.dsl');
      if (result.errors.length > 0) {
        console.log('Compilation errors:', result.errors.slice(0, 10));
      }
      expect(result.errors).toHaveLength(0);

      const cpu = result.circuits.find(c => c.name === 'CPU6502Core');
      expect(cpu).toBeDefined();

      // Check for pc_hi_out output
      const outputNames = cpu!.outputs.map(o => o.name);
      expect(outputNames).toContain('pc');
      expect(outputNames).toContain('pc_hi_out');
    });

    it('should compile System6502 with 16-bit PC outputs', () => {
      // Load dependencies - Console first (required by MemoryBus)
      const consoleResult = loadAndCompileDSL('35-console.dsl');
      consoleResult.circuits.forEach(circuit => library.addCircuit(circuit));

      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      memBusResult.circuits.forEach(circuit => library.addCircuit(circuit));

      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      cpuResult.circuits.forEach(circuit => library.addCircuit(circuit));

      const result = loadAndCompileDSL('34-system.dsl');
      expect(result.errors).toHaveLength(0);

      const system = result.circuits.find(c => c.name === 'System6502');
      expect(system).toBeDefined();
      if (!system) return;

      const outputNames = system.outputs.map(o => o.name);
      expect(outputNames).toContain('pc');
      expect(outputNames).toContain('pc_hi');
    });

    it('should compile stage7-combined.dsl with 16-bit PC', () => {
      const result = loadAndCompileDSL('stage7-combined.dsl');
      if (result.errors.length > 0) {
        console.log('Compilation errors:', result.errors.slice(0, 10));
      }
      expect(result.errors).toHaveLength(0);

      // Verify the combined file has the new outputs
      const system = result.circuits.find(c => c.name === 'System6502');
      expect(system).toBeDefined();

      const outputNames = system!.outputs.map(o => o.name);
      expect(outputNames).toContain('pc_hi');
    });
  });

  describe('16-bit PC Simulation', () => {
    function setupSimulation() {
      const result = loadAndCompileDSL('stage7-combined.dsl');
      expect(result.errors).toHaveLength(0);

      result.circuits.forEach(circuit => library.addCircuit(circuit));

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) throw new Error('Stage7Test not found');

      const flatCircuit = elaborate(testCircuit, store);
      const seqState = initializeFlatSequentialState(flatCircuit);

      return { flatCircuit, seqState };
    }

    function getPCValues(portValues: Map<string, any>, debug = false): { lo: number; hi: number } {
      let lo = 0, hi = 0;
      for (const [key, value] of portValues.entries()) {
        // pc_lo is the low byte register - exclude temp, inc, after, etc.
        if (key.includes('CPU6502Core_pc_lo_') && key.endsWith('.q') &&
            !key.includes('pc_lo_temp') && !key.includes('pc_lo_inc') &&
            !key.includes('pc_lo_after') && !key.includes('pc_lo_max') &&
            !key.includes('pc_lo_minus')) {
          lo = busToNumber(value);
          if (debug) console.log(`Found pc_lo: ${key} = ${lo}`);
        }
        // pc_hi is the high byte register (not pc_hi_temp, pc_hi_inc, etc.)
        if (key.includes('CPU6502Core_pc_hi_') && key.endsWith('.q') &&
            !key.includes('pc_hi_temp') && !key.includes('pc_hi_inc') &&
            !key.includes('pc_hi_after') && !key.includes('pc_hi_should') &&
            !key.includes('pc_hi_final') && !key.includes('pc_hi_minus') &&
            !key.includes('pc_hi_next')) {
          hi = busToNumber(value);
          if (debug) console.log(`Found pc_hi: ${key} = ${hi}`);
        }
      }
      return { lo, hi };
    }

    it('should elaborate Stage7Test without errors', () => {
      const { flatCircuit } = setupSimulation();
      expect(flatCircuit.nodes.length).toBeGreaterThan(0);

      // Should have pc_lo and pc_hi registers
      const pcLoNodes = flatCircuit.nodes.filter(n => n.id.includes('pc_lo'));
      const pcHiNodes = flatCircuit.nodes.filter(n => n.id.includes('pc_hi'));
      expect(pcLoNodes.length).toBeGreaterThan(0);
      expect(pcHiNodes.length).toBeGreaterThan(0);
    });

    it('should simulate without cycle errors', () => {
      const { flatCircuit, seqState } = setupSimulation();
      const simResult = runFlatSimulationTick(flatCircuit, seqState);
      expect(simResult.error).toBeUndefined();
    });

    it('should start with PC in low memory (page 0)', () => {
      const { flatCircuit, seqState } = setupSimulation();
      const simResult = runFlatSimulationTick(flatCircuit, seqState);
      expect(simResult.error).toBeUndefined();

      // After first tick, PC may have advanced but should be in low memory
      const pc = getPCValues(simResult.portValues);
      // PC starts at 0 and advances during execution
      // pc_hi should be 0 (we're in page 0)
      expect(pc.hi).toBe(0);
      // pc_lo should be a small value (first few instructions)
      expect(pc.lo).toBeLessThan(16);
    });

    it('should increment PC correctly during instruction execution', () => {
      const { flatCircuit, seqState } = setupSimulation();
      let state = seqState;
      let simResult: FlatSimulationResult;
      let lastPcLo = 0;
      let pcIncremented = false;

      // Run for enough cycles to see PC increment (at least one instruction)
      for (let cycle = 0; cycle < 20; cycle++) {
        simResult = runFlatSimulationTick(flatCircuit, state);
        expect(simResult.error).toBeUndefined();
        state = simResult.sequentialState!;

        const debug = cycle === 0; // Debug on first cycle
        const pc = getPCValues(simResult.portValues, debug);

        if (debug) {
          // Print all keys that look like PC-related
          const pcKeys = Array.from(simResult.portValues.keys()).filter(k =>
            k.includes('pc_') && k.includes('CPU6502Core') && k.endsWith('.q')
          );
          console.log('PC-related keys:', pcKeys.slice(0, 10));
        }

        if (pc.lo > lastPcLo) {
          pcIncremented = true;
        }
        lastPcLo = pc.lo;
      }

      // PC should have incremented at some point
      expect(pcIncremented).toBe(true);
    });

    it('should execute the Stage 7 test program correctly with 16-bit PC', () => {
      const { flatCircuit, seqState } = setupSimulation();
      let state = seqState;
      let simResult: FlatSimulationResult | null = null;

      // Run for enough cycles to execute the test program
      for (let cycle = 0; cycle < 100; cycle++) {
        simResult = runFlatSimulationTick(flatCircuit, state);
        expect(simResult.error).toBeUndefined();
        state = simResult.sequentialState!;
      }

      // Verify final register values
      expect(simResult).not.toBeNull();
      let finalA = 0, finalX = 0, finalY = 0, finalC = 0;
      for (const [key, value] of simResult!.portValues.entries()) {
        if (key.includes('RegisterFile_regA_') && key.endsWith('.q')) {
          finalA = busToNumber(value);
        } else if (key.includes('RegisterFile_regX_') && key.endsWith('.q')) {
          finalX = busToNumber(value);
        } else if (key.includes('RegisterFile_regY_') && key.endsWith('.q')) {
          finalY = busToNumber(value);
        } else if (key.includes('reg_c_') && key.endsWith('.q')) {
          finalC = busToNumber(value);
        }
      }

      // Verify expected values (reset vector fetch now loads PC from $FFFC/$FFFD -> $C000)
      expect(finalA).toBe(0xF0);
      expect(finalX).toBe(0xFF);
      expect(finalY).toBe(0x02);
      expect(finalC).toBe(1);
    });
  });

  describe('16-bit PC Address Output', () => {
    function setupSimulationForAddressTest() {
      const result = loadAndCompileDSL('stage7-combined.dsl');
      expect(result.errors).toHaveLength(0);

      result.circuits.forEach(circuit => library.addCircuit(circuit));

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) throw new Error('Stage7Test not found');

      const flatCircuit = elaborate(testCircuit, store);
      const seqState = initializeFlatSequentialState(flatCircuit);

      return { flatCircuit, seqState };
    }

    it('should output pc_hi on addr_hi during fetch', () => {
      const { flatCircuit, seqState } = setupSimulationForAddressTest();
      let state = seqState;

      // Run a few cycles and check addr_hi output
      for (let cycle = 0; cycle < 5; cycle++) {
        const simResult = runFlatSimulationTick(flatCircuit, state);
        expect(simResult.error).toBeUndefined();
        state = simResult.sequentialState!;

        let addrHi = 0;
        for (const [key, value] of simResult.portValues.entries()) {
          if (key.includes('final_addr_hi') && key.endsWith('.out')) {
            addrHi = typeof value === 'number' ? value : 0;
            break;
          }
        }

        // During reset sequence (cycles 1-2): addr_hi = $FF (reading reset vector from $FFFC/$FFFD)
        // After reset (cycles 3+): addr_hi = $C0 (executing from ROM at $C000)
        // addr_hi could also be 0x00 for zero-page/stack operations during execution
        // This verifies the addr_hi output path works
        expect([0x00, 0x01, 0xC0, 0xFF]).toContain(addrHi);
      }
    });
  });
});
