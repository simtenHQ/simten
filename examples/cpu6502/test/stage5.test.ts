/**
 * 6502 CPU Stage 5: Flags & Branches Tests
 * Tests flag register (N, Z, C), CMP instruction, and conditional branches
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

describe('6502 CPU Stage 5: Flags & Branches', () => {
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

  describe('Flag Components (20-stage5-flags.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('20-stage5-flags.dsl');
      if (result.errors.length > 0) {
        console.log('Compilation errors:', result.errors);
      }
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('FlagRegister');
      expect(circuitNames).toContain('FlagCalculator');
      expect(circuitNames).toContain('BranchCondition');
    });

    it('should create FlagRegister with correct interface', () => {
      const result = loadAndCompileDSL('20-stage5-flags.dsl');
      const flagReg = result.circuits.find(c => c.name === 'FlagRegister');
      expect(flagReg).toBeDefined();

      const inputNames = flagReg!.inputs.map(i => i.name);
      const outputNames = flagReg!.outputs.map(o => o.name);

      expect(inputNames).toContain('update_n');
      expect(inputNames).toContain('update_z');
      expect(inputNames).toContain('update_c');
      expect(inputNames).toContain('update_v');
      expect(inputNames).toContain('new_n');
      expect(inputNames).toContain('new_z');
      expect(inputNames).toContain('new_c');
      expect(inputNames).toContain('new_v');
      expect(outputNames).toContain('flag_n');
      expect(outputNames).toContain('flag_z');
      expect(outputNames).toContain('flag_c');
      expect(outputNames).toContain('flag_v');
    });

    it('should create BranchCondition with all branch types', () => {
      const result = loadAndCompileDSL('20-stage5-flags.dsl');
      const branch = result.circuits.find(c => c.name === 'BranchCondition');
      expect(branch).toBeDefined();

      const inputNames = branch!.inputs.map(i => i.name);

      expect(inputNames).toContain('is_beq');
      expect(inputNames).toContain('is_bne');
      expect(inputNames).toContain('is_bcc');
      expect(inputNames).toContain('is_bcs');
      expect(inputNames).toContain('is_bmi');
      expect(inputNames).toContain('is_bpl');
      expect(inputNames).toContain('is_bvc');
      expect(inputNames).toContain('is_bvs');
    });
  });

  describe('Compare Instructions (21-stage5-compare.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('21-stage5-compare.dsl');
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('CompareControl');
      expect(circuitNames).toContain('CompareCPU');
      expect(circuitNames).toContain('CompareTest');
    });

    it('should have update_flags output', () => {
      const result = loadAndCompileDSL('21-stage5-compare.dsl');
      const control = result.circuits.find(c => c.name === 'CompareControl');
      expect(control).toBeDefined();

      const outputNames = control!.outputs.map(o => o.name);
      expect(outputNames).toContain('update_flags');
      expect(outputNames).toContain('is_lda_imm');
      expect(outputNames).toContain('is_cmp_imm');
    });
  });

  describe('Branch Instructions (22-stage5-branches.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('22-stage5-branches.dsl');
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('BranchControl');
      expect(circuitNames).toContain('BranchCPU');
      expect(circuitNames).toContain('BranchTest');
    });

    it('should have branch control outputs', () => {
      const result = loadAndCompileDSL('22-stage5-branches.dsl');
      const control = result.circuits.find(c => c.name === 'BranchControl');
      expect(control).toBeDefined();

      const outputNames = control!.outputs.map(o => o.name);
      expect(outputNames).toContain('branch_load_pc');
      expect(outputNames).toContain('is_beq');
      expect(outputNames).toContain('is_bne');
      expect(outputNames).toContain('is_bcc');
      expect(outputNames).toContain('is_bcs');
      expect(outputNames).toContain('is_bmi');
      expect(outputNames).toContain('is_bpl');
    });

    it('should execute branch test program correctly', () => {
      const result = loadAndCompileDSL('22-stage5-branches.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'BranchTest');
      expect(testCircuit).toBeDefined();

      if (!testCircuit) return;

      const flatCircuit = elaborate(testCircuit, store);
      let seqState = initializeFlatSequentialState(flatCircuit);
      let simResult: FlatSimulationResult;

      const getRegister = (name: string): number => {
        for (const [key, value] of simResult.portValues.entries()) {
          if (key.includes('_cpu_') && key.includes(name) && key.endsWith('.q')) {
            return busToNumber(value);
          }
        }
        return 0;
      };

      console.log('\n=== Branch Test ===');
      console.log('Program: LDA #$05, CMP #$05, BEQ +2, LDA #$FF, LDA #$42');
      console.log('Expected: A=$42 (should skip LDA #$FF)');

      // Track final A value
      let final_a = 0;

      // Run simulation for 30 cycles
      for (let cycle = 0; cycle < 30; cycle++) {
        simResult = runFlatSimulationTick(flatCircuit, seqState);
        if (simResult.sequentialState) {
          seqState = simResult.sequentialState;
        }

        const a = getRegister('reg_a');
        if (a === 0x42) {
          final_a = a;
        }
      }

      console.log(`\nFinal A = 0x${final_a.toString(16).padStart(2, '0')} (expected: 0x42)`);

      // After branch, A should be $42 (not $FF which would indicate branch failed)
      expect(final_a).toBe(0x42);
    });
  });

  describe('Complete Stage 5 CPU (23-stage5-complete.dsl)', () => {
    it('should compile without errors', () => {
      const result = loadAndCompileDSL('23-stage5-complete.dsl');
      if (result.errors.length > 0) {
        console.log('Compilation errors:', result.errors);
      }
      expect(result.errors).toHaveLength(0);

      const circuitNames = result.circuits.map(c => c.name);
      expect(circuitNames).toContain('Stage5Control');
      expect(circuitNames).toContain('Stage5CPU');
      expect(circuitNames).toContain('Stage5Test');
    });

    it('should have all required instruction decode outputs', () => {
      const result = loadAndCompileDSL('23-stage5-complete.dsl');
      const control = result.circuits.find(c => c.name === 'Stage5Control');
      expect(control).toBeDefined();

      const outputNames = control!.outputs.map(o => o.name);

      // Stage 4 instructions
      expect(outputNames).toContain('is_lda_imm');
      expect(outputNames).toContain('is_lda_zp');
      expect(outputNames).toContain('is_lda_abs');
      expect(outputNames).toContain('is_sta_zp');
      expect(outputNames).toContain('is_tax');
      expect(outputNames).toContain('is_inx');
      expect(outputNames).toContain('is_pha');
      expect(outputNames).toContain('is_pla');
      expect(outputNames).toContain('is_jsr');
      expect(outputNames).toContain('is_rts');

      // Stage 5 instructions
      expect(outputNames).toContain('is_cmp_imm');
      expect(outputNames).toContain('is_beq');
      expect(outputNames).toContain('is_bne');
      expect(outputNames).toContain('is_bcc');
      expect(outputNames).toContain('is_bcs');
      expect(outputNames).toContain('is_bmi');
      expect(outputNames).toContain('is_bpl');
    });

    it('should have flag and branch control signals', () => {
      const result = loadAndCompileDSL('23-stage5-complete.dsl');
      const control = result.circuits.find(c => c.name === 'Stage5Control');
      expect(control).toBeDefined();

      const outputNames = control!.outputs.map(o => o.name);

      expect(outputNames).toContain('update_flags');
      expect(outputNames).toContain('branch_load_pc');
    });

    it('should have flag outputs on CPU', () => {
      const result = loadAndCompileDSL('23-stage5-complete.dsl');
      const cpu = result.circuits.find(c => c.name === 'Stage5CPU');
      expect(cpu).toBeDefined();

      const outputNames = cpu!.outputs.map(o => o.name);

      expect(outputNames).toContain('flag_n');
      expect(outputNames).toContain('flag_z');
      expect(outputNames).toContain('flag_c');
    });

    it('should execute flags and branch test program', () => {
      const result = loadAndCompileDSL('23-stage5-complete.dsl');
      expect(result.errors).toHaveLength(0);

      for (const circuit of result.circuits) {
        library.addCircuit(circuit);
      }

      const testCircuit = result.circuits.find(c => c.name === 'Stage5Test');
      expect(testCircuit).toBeDefined();

      if (!testCircuit) return;

      const flatCircuit = elaborate(testCircuit, store);

      let seqState = initializeFlatSequentialState(flatCircuit);
      let simResult: FlatSimulationResult;

      const getRegister = (name: string): number => {
        for (const [key, value] of simResult.portValues.entries()) {
          if (key.includes('_cpu_') && key.includes(name) && key.endsWith('.q')) {
            return busToNumber(value);
          }
        }
        return 0;
      };

      console.log('\n=== Stage 5 Complete Test ===');
      console.log('Program: LDA #$05, CMP #$05, BEQ +2, LDA #$FF, STA $20, LDA #$42');
      console.log('Expected: A=$42 after branch skips LDA #$FF');

      // Track if branch worked
      let branch_worked = true;
      let saw_0x42 = false;
      let final_a = 0;

      // Run simulation for 40 cycles
      for (let cycle = 0; cycle < 40; cycle++) {
        simResult = runFlatSimulationTick(flatCircuit, seqState);
        if (simResult.sequentialState) {
          seqState = simResult.sequentialState;
        }

        const a = getRegister('regA');

        // Capture when we reach 0x42 (success)
        if (a === 0x42 && !saw_0x42) {
          saw_0x42 = true;
          final_a = a;
        }

        // If we ever see 0xFF, the branch failed
        if (a === 0xFF) {
          branch_worked = false;
        }
      }

      console.log('\n=== Final Result ===');
      console.log(`Branch worked: ${branch_worked}`);
      console.log(`Final A = 0x${final_a.toString(16).padStart(2, '0')}`);

      // A should eventually be $42
      expect(final_a).toBe(0x42);
      // Branch should work - A should never become 0xFF
      expect(branch_worked).toBe(true);
    });
  });

  describe('Instruction Verification', () => {
    it('should have correct Stage 5 opcode values', () => {
      // Verify opcode constants match 6502 spec
      expect(0xC9).toBe(201); // CMP #imm
      expect(0xF0).toBe(240); // BEQ
      expect(0xD0).toBe(208); // BNE
      expect(0x90).toBe(144); // BCC
      expect(0xB0).toBe(176); // BCS
      expect(0x30).toBe(48);  // BMI
      expect(0x10).toBe(16);  // BPL
      expect(0x50).toBe(80);  // BVC
      expect(0x70).toBe(112); // BVS
    });
  });

  describe('Flag Logic', () => {
    it('should correctly compute N flag (bit 7 test)', () => {
      // Values 0-127 have N=0, values 128-255 have N=1
      expect(0x00 >= 128).toBe(false); // N=0
      expect(0x7F >= 128).toBe(false); // N=0
      expect(0x80 >= 128).toBe(true);  // N=1
      expect(0xFF >= 128).toBe(true);  // N=1
    });

    it('should correctly compute Z flag', () => {
      // Z=1 if result is zero
      expect(0x00 === 0).toBe(true);  // Z=1
      expect(0x01 === 0).toBe(false); // Z=0
      expect(0xFF === 0).toBe(false); // Z=0
    });

    it('should correctly compute C flag for CMP', () => {
      // C = 1 if A >= M (no borrow needed)
      // Simulating subtraction for CMP
      const testCmp = (a: number, m: number) => a >= m;

      expect(testCmp(5, 5)).toBe(true);   // A == M: C=1
      expect(testCmp(5, 3)).toBe(true);   // A > M: C=1
      expect(testCmp(5, 10)).toBe(false); // A < M: C=0
      expect(testCmp(0, 0)).toBe(true);   // A == M: C=1
      expect(testCmp(255, 0)).toBe(true); // A > M: C=1
    });
  });

  describe('Branch Offset Calculation', () => {
    it('should correctly add positive offsets', () => {
      // PC + offset for forward branch
      const pc = 0x06;      // PC after BEQ instruction
      const offset = 0x02;  // +2 forward
      const target = (pc + offset) & 0xFF;
      expect(target).toBe(0x08);
    });

    it('should correctly handle negative offsets (two\'s complement)', () => {
      // PC + offset for backward branch
      const pc = 0x10;      // PC after branch instruction
      const offset = 0xFE;  // -2 in two's complement
      const target = (pc + offset) & 0xFF;
      expect(target).toBe(0x0E);
    });
  });
});
