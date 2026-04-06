/**
 * Detailed trace of LDA #imm instruction execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, CircuitLibrary as DSLCircuitLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/dsl/types';
import { createSimulatorFromCircuit, type CircuitLibrary } from '@/core/simulator';

class CircuitLibraryAdapter implements DSLCircuitLibrary {
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

function getSimLibrary(): CircuitLibrary {
  const store = useCircuitLibraryStore.getState();
  return {
    resolveCircuit: (name) => store.resolveCircuit(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('LDA #imm Trace Test', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: DSLCircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
  });

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

  it('should trace LDA #$42 execution', () => {
    const result = compileDSL(readFileSync(resolve(__dirname, '..', '15-stage3-complete.dsl'), 'utf-8'), library);
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    const sim = createSimulatorFromCircuit(testCircuit, getSimLibrary());

    console.log('\n=== LDA #$42 Execution Trace ===');
    console.log('Program: A9 42 (LDA #$42)');
    console.log('Expected: After execution, A = 0x42\n');

    // Run 10 cycles and trace key signals
    for (let cycle = 0; cycle < 10; cycle++) {
      const simResult = sim.tick();

      const pc = busToNumber(simResult.portValues.get('.pc'));
      const instruction = busToNumber(simResult.portValues.get('.instruction'));
      const operand = busToNumber(simResult.portValues.get('.operand'));
      const state = busToNumber(simResult.portValues.get('.current_state'));
      const subcycle = busToNumber(simResult.portValues.get('.subcycle'));
      const a = busToNumber(simResult.portValues.get('.reg_a'));

      // Find control node to get internal signals
      const controlNode = testCircuit.nodes.find(n => n.componentRef === 'CompleteControl');
      let writeA = false;
      let operandLoad = false;
      let isDecode = false;
      let execDone = false;
      // Find nodes inside control for debugging
      const allPorts = Array.from(simResult.portValues.keys());
      const isDecodePort = allPorts.find(k => k.includes('is_decode') && k.endsWith('.eq'));
      const execDonePort = allPorts.find(k => k.includes('done_') && k.endsWith('.eq'));

      if (cycle === 0) {
        console.log(`  Debug: isDecodePort = ${isDecodePort}`);
        console.log(`  Debug: execDonePort = ${execDonePort}`);
        const stateRegPort = allPorts.find(k => k.includes('state_reg') && k.endsWith('.q'));
        if (stateRegPort) {
          console.log(`  Debug: ${stateRegPort} = ${busToNumber(simResult.portValues.get(stateRegPort))}`);
        }
      }

      if (controlNode) {
        writeA = busToNumber(simResult.portValues.get(`${controlNode.id}.write_a`)) !== 0;
        operandLoad = busToNumber(simResult.portValues.get(`${controlNode.id}.operand_load`)) !== 0;
      }
      if (isDecodePort) {
        isDecode = busToNumber(simResult.portValues.get(isDecodePort)) !== 0;
      }
      if (execDonePort) {
        execDone = busToNumber(simResult.portValues.get(execDonePort)) !== 0;
      }

      console.log(`Cycle ${cycle}: PC=${pc.toString(16).padStart(2, '0')} IR=${instruction.toString(16).padStart(2, '0')} State=${state} Sub=${subcycle} A=${a.toString(16).padStart(2, '0')} Op=${operand.toString(16).padStart(2, '0')} isDec=${isDecode ? '1' : '0'} done=${execDone ? '1' : '0'} writeA=${writeA ? '1' : '0'} opLoad=${operandLoad ? '1' : '0'}`);

      // Check expectations at key cycles
      if (cycle === 2 && state === 2) {
        console.log(`  → EXECUTE state entered`);
      }
      if (cycle >= 2 && operandLoad && operand !== 0x42) {
        console.log(`  ⚠️  operand_load=1 but operand=${operand.toString(16)} (expected 0x42)`);
      }
      if (cycle >= 3 && writeA && a !== 0x42) {
        console.log(`  ⚠️  write_a=1 but A=${a.toString(16)} (expected 0x42)`);
      }
    }

    const finalResult = sim.tick();
    const final_a = busToNumber(finalResult.portValues.get('.reg_a'));

    console.log(`\n=== Final Result ===`);
    console.log(`A = 0x${final_a.toString(16).padStart(2, '0')} (expected: 0x42)`);

    expect(final_a).toBe(0x42);
  });
});
