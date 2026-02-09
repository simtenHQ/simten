/**
 * 6502 CPU Stage 7: Bus Architecture Tests
 * Tests the separated CPU core, memory bus, and system integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
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

describe('6502 CPU Stage 7: Bus Architecture', () => {
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

  describe('Memory Bus (32-memory-bus.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('32-memory-bus.dsl');
      if (result.errors.length > 0) {
        console.log('Memory Bus compilation errors:', result.errors.slice(0, 10));
      }
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('RAM2K');
      expect(circuitNames).toContain('ROM16K');
      expect(circuitNames).toContain('MemoryBus');
      expect(circuitNames).toContain('MemoryBusTest');
    });

    it('should have correct MemoryBus interface', () => {
      const result = loadAndCompileDSL('32-memory-bus.dsl');
      expect(result.errors).toHaveLength(0);

      const bus = result.circuits.find(c => c.name === 'MemoryBus');
      expect(bus).toBeDefined();

      const inputNames = bus!.inputs.map(i => i.name);
      expect(inputNames).toContain('addr_lo');
      expect(inputNames).toContain('addr_hi');
      expect(inputNames).toContain('data_in');
      expect(inputNames).toContain('rw');

      const outputNames = bus!.outputs.map(o => o.name);
      expect(outputNames).toContain('data_out');
    });

    it('should have ROM16K with test program data', () => {
      const result = loadAndCompileDSL('32-memory-bus.dsl');
      expect(result.errors).toHaveLength(0);

      const rom = result.circuits.find(c => c.name === 'ROM16K');
      expect(rom).toBeDefined();

      const inputNames = rom!.inputs.map(i => i.name);
      expect(inputNames).toContain('addr_lo');
      expect(inputNames).toContain('addr_hi');

      const outputNames = rom!.outputs.map(o => o.name);
      expect(outputNames).toContain('data_out');
      expect(outputNames).toContain('responds');
    });
  });

  describe('CPU Core (33-cpu-core.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('33-cpu-core.dsl');
      if (result.errors.length > 0) {
        console.log('CPU Core compilation errors (first 10):', result.errors.slice(0, 10));
      }
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('CPU6502Core');
      expect(circuitNames).toContain('Stage6Control');
    });

    it('should have bus interface on CPU6502Core', () => {
      const result = loadAndCompileDSL('33-cpu-core.dsl');
      expect(result.errors).toHaveLength(0);

      const cpu = result.circuits.find(c => c.name === 'CPU6502Core');
      expect(cpu).toBeDefined();

      // Bus interface inputs
      const inputNames = cpu!.inputs.map(i => i.name);
      expect(inputNames).toContain('reset');
      expect(inputNames).toContain('data_in');

      // Bus interface outputs
      const outputNames = cpu!.outputs.map(o => o.name);
      expect(outputNames).toContain('addr_lo');
      expect(outputNames).toContain('addr_hi');
      expect(outputNames).toContain('data_out');
      expect(outputNames).toContain('rw');

      // Debug outputs should still be present
      expect(outputNames).toContain('pc');
      expect(outputNames).toContain('instruction');
      expect(outputNames).toContain('reg_a');
      expect(outputNames).toContain('reg_x');
      expect(outputNames).toContain('reg_y');
      expect(outputNames).toContain('reg_sp');
      expect(outputNames).toContain('flag_n');
      expect(outputNames).toContain('flag_z');
      expect(outputNames).toContain('flag_c');
      expect(outputNames).toContain('flag_v');
    });

    it('should have Stage6Control with all instruction decode outputs', () => {
      const result = loadAndCompileDSL('33-cpu-core.dsl');
      expect(result.errors).toHaveLength(0);

      const control = result.circuits.find(c => c.name === 'Stage6Control');
      expect(control).toBeDefined();

      const outputNames = control!.outputs.map(o => o.name);

      // Key control signals for bus interface
      expect(outputNames).toContain('mem_write');
      expect(outputNames).toContain('stack_write');
      expect(outputNames).toContain('use_stack_data');

      // Instruction decode
      expect(outputNames).toContain('is_lda_imm');
      expect(outputNames).toContain('is_sta_zp');
      expect(outputNames).toContain('is_sec');
      expect(outputNames).toContain('is_clc');
    });
  });

  describe('Memory Bus Simulation', () => {
    it('should elaborate MemoryBusTest without errors', () => {
      const result = loadAndCompileDSL('32-memory-bus.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'MemoryBusTest');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) return;

      // Test that elaboration works without throwing
      const flatCircuit = elaborate(testCircuit, store);
      expect(flatCircuit.nodes.length).toBeGreaterThan(0);

      // Verify the circuit contains expected components
      const hasRAM = flatCircuit.nodes.some(n => n.primitiveType === 'RAM');
      const hasROM = flatCircuit.nodes.some(n => n.primitiveType === 'ROM');
      expect(hasRAM).toBe(true);
      expect(hasROM).toBe(true);
    });
  });

  describe('CPU Core Elaboration', () => {
    it('should elaborate CPU6502CoreTest without errors', () => {
      const result = loadAndCompileDSL('33-cpu-core.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'CPU6502CoreTest');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) return;

      // This tests that elaboration works without throwing
      const flatCircuit = elaborate(testCircuit, store);
      expect(flatCircuit.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('System Integration (34-system.dsl)', () => {
    it('should compile without errors', () => {
      // First load the dependencies
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      expect(memBusResult.errors).toHaveLength(0);
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }

      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      expect(cpuResult.errors).toHaveLength(0);
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }

      // Now load the system
      const result = loadAndCompileDSL('34-system.dsl');
      if (result.errors.length > 0) {
        console.log('System compilation errors:', result.errors.slice(0, 10));
      }
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('System6502');
      expect(circuitNames).toContain('Stage7Test');
    });

    it('should have correct System6502 interface', () => {
      // Load dependencies
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }
      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }

      const result = loadAndCompileDSL('34-system.dsl');
      expect(result.errors).toHaveLength(0);

      const system = result.circuits.find(c => c.name === 'System6502');
      expect(system).toBeDefined();

      const inputNames = system!.inputs.map(i => i.name);
      expect(inputNames).toContain('reset');

      const outputNames = system!.outputs.map(o => o.name);
      // CPU debug outputs
      expect(outputNames).toContain('pc');
      expect(outputNames).toContain('instruction');
      expect(outputNames).toContain('reg_a');
      expect(outputNames).toContain('reg_x');
      expect(outputNames).toContain('reg_y');
      expect(outputNames).toContain('reg_sp');
      // Bus debug outputs
      expect(outputNames).toContain('addr_lo');
      expect(outputNames).toContain('addr_hi');
      expect(outputNames).toContain('data_bus');
      expect(outputNames).toContain('rw');
    });

    it('should elaborate Stage7Test without errors', () => {
      // Load dependencies
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }
      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }

      const result = loadAndCompileDSL('34-system.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) return;

      // Test that elaboration works without throwing
      const flatCircuit = elaborate(testCircuit, store);
      expect(flatCircuit.nodes.length).toBeGreaterThan(0);

      // Verify key components are present
      const hasRAM = flatCircuit.nodes.some(n => n.primitiveType === 'RAM');
      const hasROM = flatCircuit.nodes.some(n => n.primitiveType === 'ROM');
      const hasRegisters = flatCircuit.nodes.some(n => n.primitiveType === 'Register');
      expect(hasRAM).toBe(true);
      expect(hasROM).toBe(true);
      expect(hasRegisters).toBe(true);
    });

    it('should simulate Stage7Test without cycle errors', () => {
      // Load dependencies
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }
      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }

      const result = loadAndCompileDSL('34-system.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) return;

      // Elaborate and simulate
      const flatCircuit = elaborate(testCircuit, store);

      // Debug: Check if Register primitives are marked as state-only
      const registerNodes = flatCircuit.nodes.filter(n => n.primitiveType === 'Register');
      console.log(`Found ${registerNodes.length} Register nodes`);

      const regCircuit = store.resolveComponent('Register');
      console.log('Register metadata:', regCircuit?.metadata);
      console.log('Register outputDependency:', regCircuit?.metadata?.outputDependency);

      const seqState = initializeFlatSequentialState(flatCircuit);

      // Run a simulation tick - this is where cycle detection happens
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      // Check for cycle error
      if (simResult.error) {
        console.log('Cycle error detected');
        // Count different node types to understand the circuit
        const nodeCounts = new Map<string, number>();
        for (const node of flatCircuit.nodes) {
          nodeCounts.set(node.primitiveType, (nodeCounts.get(node.primitiveType) || 0) + 1);
        }
        console.log('Node counts:', Object.fromEntries(nodeCounts));

        // Check ALL primitive types in the circuit
        const primitiveTypes = new Set(flatCircuit.nodes.map(n => n.primitiveType));
        console.log('All primitive types in circuit:');
        for (const typeName of primitiveTypes) {
          const comp = store.resolveComponent(typeName);
          const od = comp?.metadata?.outputDependency || 'undefined';
          const kind = comp?.metadata?.kind || 'undefined';
          console.log(`  ${typeName}: outputDependency=${od}, kind=${kind}`);
        }
      }

      expect(simResult.error).toBeUndefined();
    });

    it('should compare with original Stage6CPU', () => {
      // Test if original Stage6CPU also has cycle issue
      const stage6Result = loadAndCompileDSL('24-stage6-simple.dsl');
      expect(stage6Result.errors).toHaveLength(0);

      for (const circuit of stage6Result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = stage6Result.circuits.find(c => c.name === 'Stage6Test');
      if (!testCircuit) {
        console.log('Stage6Test not found');
        return;
      }

      const flatCircuit = elaborate(testCircuit, store);
      console.log(`Stage6Test has ${flatCircuit.nodes.length} nodes`);

      const seqState = initializeFlatSequentialState(flatCircuit);
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      console.log(`Stage6Test cycle error: ${simResult.error || 'none'}`);
      // Stage6 should work
      expect(simResult.error).toBeUndefined();
    });

    it('should trace the cycle in Stage7', () => {
      // Load Stage7
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }
      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }
      const result = loadAndCompileDSL('34-system.dsl');
      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      if (!testCircuit) return;

      const flatCircuit = elaborate(testCircuit, store);

      // Find connections involving data_in and addr ports
      const dataInConnections = flatCircuit.connections.filter(c =>
        c.source.portName === 'data_out' || c.target.portName === 'data_in' ||
        c.source.portName === 'addr_lo' || c.target.portName === 'addr_lo'
      );

      console.log('Key connections (first 20):');
      for (const conn of dataInConnections.slice(0, 20)) {
        console.log(`  ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
      }

      // Check total nodes
      console.log(`Total nodes: ${flatCircuit.nodes.length}`);
      console.log(`Total connections: ${flatCircuit.connections.length}`);
    });

    it('should test CPU6502Core alone without cycle', () => {
      // Load just the CPU
      const cpuResult = loadAndCompileDSL('33-cpu-core.dsl');
      for (const circuit of cpuResult.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = cpuResult.circuits.find(c => c.name === 'CPU6502CoreTest');
      if (!testCircuit) {
        console.log('CPU6502CoreTest not found');
        return;
      }

      const flatCircuit = elaborate(testCircuit, store);
      console.log(`CPU6502CoreTest has ${flatCircuit.nodes.length} nodes`);

      const seqState = initializeFlatSequentialState(flatCircuit);
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      console.log(`CPU6502CoreTest cycle error: ${simResult.error || 'none'}`);
      expect(simResult.error).toBeUndefined();
    });

    it('should test MemoryBusTest alone without cycle', () => {
      // Load just the memory bus
      const memBusResult = loadAndCompileDSL('32-memory-bus.dsl');
      for (const circuit of memBusResult.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = memBusResult.circuits.find(c => c.name === 'MemoryBusTest');
      if (!testCircuit) {
        console.log('MemoryBusTest not found');
        return;
      }

      const flatCircuit = elaborate(testCircuit, store);
      console.log(`MemoryBusTest has ${flatCircuit.nodes.length} nodes`);

      const seqState = initializeFlatSequentialState(flatCircuit);
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      console.log(`MemoryBusTest cycle error: ${simResult.error || 'none'}`);
      expect(simResult.error).toBeUndefined();
    });

    it('should load and simulate stage7-combined.dsl', () => {
      // This tests the exact file the UI loads
      const result = loadAndCompileDSL('stage7-combined.dsl');
      if (result.errors.length > 0) {
        console.log('Compilation errors:', result.errors.slice(0, 5));
      }
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'Stage7Test');
      expect(testCircuit).toBeDefined();
      if (!testCircuit) return;

      const flatCircuit = elaborate(testCircuit, store);
      console.log(`stage7-combined.dsl Stage7Test has ${flatCircuit.nodes.length} nodes`);

      const seqState = initializeFlatSequentialState(flatCircuit);
      const simResult = runFlatSimulationTick(flatCircuit, seqState);

      console.log(`stage7-combined.dsl cycle error: ${simResult.error || 'none'}`);
      expect(simResult.error).toBeUndefined();

      // Run simulation and verify actual execution
      let state = simResult.sequentialState;

      // Helper to find port value by pattern
      const findPort = (portValues: Map<string, any>, pattern: string): number => {
        for (const [key, value] of portValues.entries()) {
          if (key.includes(pattern)) {
            return busToNumber(value);
          }
        }
        return -1;
      };

      // Helper to find PC low byte (Stage 8: pc_reg split into pc_lo/pc_hi)
      const findPcLo = (portValues: Map<string, any>): number => {
        for (const [key, value] of portValues.entries()) {
          if (key.includes('CPU6502Core_pc_lo_') && key.endsWith('.q') &&
              !key.includes('pc_lo_temp') && !key.includes('pc_lo_inc') &&
              !key.includes('pc_lo_after') && !key.includes('pc_lo_max') &&
              !key.includes('pc_lo_minus')) {
            return busToNumber(value);
          }
        }
        return 0;
      };

      console.log('=== Stage 7 Execution Test ===');
      console.log('Program: SEC, SEI, PHP, CLC, CLI, PLP, LDA #$0F, AND #$F0, ORA #$F0, INY, INY, DEX, NOP');

      // Run for more cycles to execute the test program
      for (let cycle = 0; cycle < 50; cycle++) {
        const tick = runFlatSimulationTick(flatCircuit, state);
        expect(tick.error).toBeUndefined();
        state = tick.sequentialState;

        // Log key cycles - look for register outputs (.q ports)
        if (cycle === 2 || cycle === 20 || cycle === 30 || cycle === 40 || cycle === 45) {
          // Stage 8: pc_reg was split into pc_lo and pc_hi
          const pc = findPcLo(tick.portValues);
          const ir = findPort(tick.portValues, 'ir_') !== -1 ?
            findPort(tick.portValues, 'ir_') : 0;
          // Also find A register
          let regA = 0;
          for (const [key, value] of tick.portValues.entries()) {
            if (key.includes('RegisterFile_regA_') && key.endsWith('.q')) {
              regA = busToNumber(value);
            }
          }
          console.log(`Cycle ${cycle}: PC=0x${pc.toString(16).padStart(2, '0')} IR=0x${ir.toString(16).padStart(2, '0')} A=0x${regA.toString(16).padStart(2, '0')}`);
        }
      }

      // Get final state - look for register values
      const finalTick = runFlatSimulationTick(flatCircuit, state);

      // Debug: find register keys - search broader
      const allKeys = Array.from(finalTick.portValues.keys());
      const regKeys = allKeys.filter(k => k.endsWith('.q') && k.includes('CPU6502Core_registers'));
      console.log('Register keys found:', regKeys.slice(0, 10));

      // Find the registers module and its outputs
      // Stage 8: pc_reg was split into pc_lo and pc_hi
      let finalPC = findPcLo(finalTick.portValues);
      let finalA = 0, finalX = 0, finalY = 0, finalC = 0;
      for (const [key, value] of finalTick.portValues.entries()) {
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

      console.log(`\n=== Final State (after 40 cycles) ===`);
      console.log(`PC=0x${finalPC.toString(16).padStart(2, '0')}`);
      console.log(`A=0x${finalA.toString(16).padStart(2, '0')} (expected 0xF0)`);
      console.log(`X=0x${finalX.toString(16).padStart(2, '0')} (expected 0xFF)`);
      console.log(`Y=0x${finalY.toString(16).padStart(2, '0')} (expected 0x02)`);
      console.log(`C=${finalC} (expected 1)`);

      // Verify expected values (reset vector fetch now loads PC from $FFFC/$FFFD -> $C000)
      expect(finalA).toBe(0xF0);
      expect(finalX).toBe(0xFF);
      expect(finalY).toBe(0x02);
      expect(finalC).toBe(1);

      console.log('\n✓ All execution values correct!');
    });
  });
});
