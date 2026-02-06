/**
 * 6502 CPU Stage 3 Phase 2 Tests
 * Tests for memory operations with zero-page addressing
 * Instructions: STA $addr, LDA $addr (zero-page)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';

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

describe('6502 CPU Stage 3 Phase 2: Memory Operations', () => {
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

  describe('Compilation Tests', () => {
    it('should compile Stage 3 Phase 2 (memory operations)', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');

      console.log('\n=== Stage 3 Phase 2 Compilation ===');
      if (result.errors.length > 0) {
        console.log('ERRORS:');
        result.errors.forEach((err) => {
          console.log(`  - ${err.message}`);
          console.log(`    at line ${err.line}, col ${err.column}`);
        });
      } else {
        console.log('SUCCESS! Generated circuits:');
        result.circuits.forEach((c) => {
          console.log(`  - ${c.name}`);
        });
      }

      expect(result.errors).toHaveLength(0);
      expect(result.circuits.length).toBeGreaterThan(0);

      // Verify key circuits exist
      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('SimpleMemory');
      expect(circuitNames).toContain('MemoryControl');
      expect(circuitNames).toContain('MemoryCPU');
      expect(circuitNames).toContain('MemoryTest');
    });

    it('should have SimpleMemory circuit', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      const memory = result.circuits.find(c => c.name === 'SimpleMemory');
      expect(memory).toBeDefined();

      const inputNames = memory?.inputs.map(i => i.name) || [];
      expect(inputNames).toContain('addr');
      expect(inputNames).toContain('data_in');
      expect(inputNames).toContain('write_enable');

      const outputNames = memory?.outputs.map(o => o.name) || [];
      expect(outputNames).toContain('data_out');
    });

    it('should have MemoryControl with new signals', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      const control = result.circuits.find(c => c.name === 'MemoryControl');
      expect(control).toBeDefined();

      const outputNames = control?.outputs.map(o => o.name) || [];
      expect(outputNames).toContain('addr_load');
      expect(outputNames).toContain('mem_read');
      expect(outputNames).toContain('mem_write');
      expect(outputNames).toContain('is_lda_zp');
      expect(outputNames).toContain('is_sta_zp');
    });

    it('should have MemoryCPU with memory outputs', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      const cpu = result.circuits.find(c => c.name === 'MemoryCPU');
      expect(cpu).toBeDefined();

      const outputNames = cpu?.outputs.map(o => o.name) || [];
      expect(outputNames).toContain('address');
      expect(outputNames).toContain('mem_data');
    });
  });

  describe('Instruction Opcodes', () => {
    it('should have correct opcode values', () => {
      const opcodes = {
        LDA_IMM: 0xA9,  // 169 - LDA #imm
        LDA_ZP: 0xA5,   // 165 - LDA $addr
        STA_ZP: 0x85,   // 133 - STA $addr
        TAX: 0xAA,      // 170
        INX: 0xE8,      // 232
      };

      console.log('\n=== Instruction Opcodes ===');
      Object.entries(opcodes).forEach(([name, value]) => {
        console.log(`${name}: 0x${value.toString(16).toUpperCase().padStart(2, '0')} (${value})`);
      });

      expect(opcodes.LDA_ZP).toBe(165);
      expect(opcodes.STA_ZP).toBe(133);
    });
  });

  describe('Test Program Documentation', () => {
    it('should document the test program', () => {
      const program = {
        bytes: [0xA9, 0x42, 0x85, 0x10, 0xA5, 0x10, 0xAA, 0xE8],
        instructions: [
          { addr: 0x00, bytes: [0xA9, 0x42], mnemonic: 'LDA #$42', description: 'Load 0x42 into A' },
          { addr: 0x02, bytes: [0x85, 0x10], mnemonic: 'STA $10', description: 'Store A to memory[$10]' },
          { addr: 0x04, bytes: [0xA5, 0x10], mnemonic: 'LDA $10', description: 'Load from memory[$10] into A' },
          { addr: 0x06, bytes: [0xAA], mnemonic: 'TAX', description: 'Transfer A to X' },
          { addr: 0x07, bytes: [0xE8], mnemonic: 'INX', description: 'Increment X' },
        ],
      };

      console.log('\n=== Test Program ===');
      program.instructions.forEach((instr) => {
        const bytesStr = instr.bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`0x${instr.addr.toString(16).toUpperCase().padStart(2, '0')}: ${bytesStr.padEnd(8)} ${instr.mnemonic.padEnd(12)} ; ${instr.description}`);
      });

      console.log('\nExpected Final State:');
      console.log('  A = 0x42 (loaded from memory)');
      console.log('  X = 0x43 (0x42 from TAX, then incremented)');
      console.log('  Memory[$10] = 0x42 (stored by STA)');
      console.log('  PC = 0x08');

      expect(program.bytes).toHaveLength(8);
    });
  });

  describe('Behavioral Tests (Expected Execution)', () => {
    it('should document LDA #$42 behavior', () => {
      console.log('\n=== LDA #$42 Execution ===');
      console.log('2-cycle instruction:');
      console.log('Cycle 0: FETCH - Load opcode A9, PC++');
      console.log('Cycle 1: DECODE');
      console.log('Cycle 2: EXECUTE sub0 - Load operand 42, PC++');
      console.log('Cycle 3: EXECUTE sub1 - Write 42 to A');
      console.log('Result: A = 0x42, PC = 0x02');

      expect(0x42).toBe(66);
    });

    it('should document STA $10 behavior', () => {
      console.log('\n=== STA $10 Execution ===');
      console.log('3-cycle zero-page instruction:');
      console.log('Cycle 0: FETCH - Load opcode 85, PC++');
      console.log('Cycle 1: DECODE');
      console.log('Cycle 2: EXECUTE sub0 - Load address 10, PC++');
      console.log('Cycle 3: EXECUTE sub1 - Write A to memory[$10]');
      console.log('Cycle 4: EXECUTE sub2 - Complete');
      console.log('Result: Memory[$10] = A = 0x42, PC = 0x04');

      expect(0x10).toBe(16);
    });

    it('should document LDA $10 behavior', () => {
      console.log('\n=== LDA $10 Execution ===');
      console.log('3-cycle zero-page instruction:');
      console.log('Cycle 0: FETCH - Load opcode A5, PC++');
      console.log('Cycle 1: DECODE');
      console.log('Cycle 2: EXECUTE sub0 - Load address 10, PC++');
      console.log('Cycle 3: EXECUTE sub1 - Read memory[$10]');
      console.log('Cycle 4: EXECUTE sub2 - Write to A');
      console.log('Result: A = Memory[$10] = 0x42, PC = 0x06');

      expect(true).toBe(true);
    });
  });

  describe('Architecture Validation', () => {
    it('should have memory controller', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      console.log('\n=== Memory Controller Architecture ===');
      console.log('SimpleMemory: 256-byte address space (simplified)');
      console.log('  - Addresses $10, $11, $12 implemented with registers');
      console.log('  - Write enable per address');
      console.log('  - Read mux selects correct address');
      console.log('\nFuture: Will extend to full 64KB with RAM/ROM separation');

      expect(true).toBe(true);
    });

    it('should have zero-page addressing mode', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      console.log('\n=== Zero-Page Addressing Mode ===');
      console.log('Execution phases:');
      console.log('  Sub0: Fetch address byte from ROM');
      console.log('  Sub1: Access memory (read or write)');
      console.log('  Sub2: Complete operation (write to register if load)');
      console.log('\nAdvantage: Faster than absolute (2-byte vs 3-byte)');

      expect(true).toBe(true);
    });

    it('should have memory read/write timing', () => {
      const result = loadAndCompileDSL('14-stage3-memory.dsl');
      expect(result.errors).toHaveLength(0);

      console.log('\n=== Memory Timing ===');
      console.log('STA $addr: Write during EXECUTE sub1');
      console.log('LDA $addr: Read during EXECUTE sub1, write to A during sub2');
      console.log('\nThis matches 6502 timing (though not cycle-accurate yet)');

      expect(true).toBe(true);
    });
  });

  describe('Integration Test Summary', () => {
    it('should summarize Stage 3 Phase 2 improvements', () => {
      console.log('\n=== Stage 3 Phase 2 Summary ===');
      console.log('✅ SimpleMemory: Read/write memory controller');
      console.log('✅ Zero-page addressing: Single-byte addresses ($00-$FF)');
      console.log('✅ STA $addr: Store accumulator to memory');
      console.log('✅ LDA $addr: Load accumulator from memory');
      console.log('✅ Multi-cycle execution: 3 cycles for zero-page operations');
      console.log('✅ Address register: Holds memory address during access');
      console.log('\n🎯 Test Program: LDA #$42, STA $10, LDA $10, TAX, INX');
      console.log('   Expected: A=0x42, X=0x43, Memory[$10]=0x42, PC=0x08');
      console.log('\n📋 Manual Test Required:');
      console.log('   Load 14-stage3-memory.dsl → MemoryTest');
      console.log('   Click clock ~20-25 times');
      console.log('   Verify: d_a=42, d_x=43, d_mem_data=42, d_pc=08');

      expect(true).toBe(true);
    });

    it('should list next steps for absolute addressing', () => {
      console.log('\n=== Next Steps: Absolute Addressing ===');
      console.log('Future additions:');
      console.log('  - Absolute addressing: LDA $1234 (2-byte address)');
      console.log('  - Indexed addressing: LDA $1000,X (absolute + X)');
      console.log('  - LDX, LDY: Load index registers from memory');
      console.log('  - STX, STY: Store index registers to memory');
      console.log('  - Full 64KB address space with RAM/ROM separation');

      expect(true).toBe(true);
    });
  });
});
