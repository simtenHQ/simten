/**
 * Trace address register loading
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, ComponentLibrary } from '../../../src/features/dsl/index';
import { useComponentLibraryStore } from '../../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../../src/features/dsl/types';
import {
  initializeSequentialState,
  runSimulationTick,
  getPortValue,
} from '../../../src/features/visual-editor/lib/simulator-v0.1';

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

describe('Address Register Trace', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
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

  it('should trace address register during STA execution', () => {
    const result = compileDSL(readFileSync(resolve(__dirname, '..', '15-stage3-complete.dsl'), 'utf-8'), library);
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'CompleteCPU');
    expect(testCircuit).toBeDefined();
    if (!testCircuit) return;

    let seqState = initializeSequentialState(testCircuit);

    console.log('\n=== Address Register Trace ===');
    console.log('Program: A9 42 8D FF 12 (LDA #$42, STA $12FF)');
    console.log('ROM: [01]=A9 [02]=42 [03]=8D [04]=FF [05]=12');
    console.log('Watching: addr_lo_reg, addr_hi_reg, effective_addr');
    console.log('Expected: AddrLo=FF, AddrHi=12\n');

    // Find register nodes
    const addrLoNode = testCircuit.nodes.find(n => n.id.includes('addr_lo_reg'));
    const addrHiNode = testCircuit.nodes.find(n => n.id.includes('addr_hi_reg'));
    const controlNode = testCircuit.nodes.find(n => n.componentRef === 'CompleteControl');

    // Run 10 cycles
    for (let cycle = 0; cycle < 10; cycle++) {
      const simResult = runSimulationTick(testCircuit, seqState);
      if (simResult.sequentialState) {
        seqState = simResult.sequentialState;
      }

      const pc = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'pc' }));
      const instruction = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'instruction' }));
      const state = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'current_state' }));
      const subcycle = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'subcycle' }));
      const address = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'address' }));
      const a = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'reg_a' }));
      const mem_data = busToNumber(getPortValue(simResult.portValues, { nodeId: '', portName: 'mem_data' }));

      let addrLo = 0;
      let addrHi = 0;
      let pcInc = false;
      let addrLoLoad = false;
      let addrHiLoad = false;

      if (addrLoNode) {
        addrLo = busToNumber(simResult.portValues.get(`${addrLoNode.id}.q`));
      }
      if (addrHiNode) {
        addrHi = busToNumber(simResult.portValues.get(`${addrHiNode.id}.q`));
      }
      if (controlNode) {
        pcInc = busToNumber(simResult.portValues.get(`${controlNode.id}.pc_increment`)) !== 0;
        addrLoLoad = busToNumber(simResult.portValues.get(`${controlNode.id}.addr_lo_load`)) !== 0;
        addrHiLoad = busToNumber(simResult.portValues.get(`${controlNode.id}.addr_hi_load`)) !== 0;
      }

      console.log(`Cycle ${cycle}: PC=${pc.toString(16).padStart(2, '0')} IR=${instruction.toString(16).padStart(2, '0')} State=${state} Sub=${subcycle} A=${a.toString(16).padStart(2, '0')} Mem=${mem_data.toString(16).padStart(2, '0')} AddrLo=${addrLo.toString(16).padStart(2, '0')} AddrHi=${addrHi.toString(16).padStart(2, '0')} Addr=${address.toString(16).padStart(4, '0')} pcInc=${pcInc ? '1' : '0'} loLd=${addrLoLoad ? '1' : '0'} hiLd=${addrHiLoad ? '1' : '0'}`);
    }
  });
});
