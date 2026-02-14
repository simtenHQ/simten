/**
 * Sparse Change Benchmark
 *
 * Tests the O(K) benefit of event-driven simulation when only
 * a small fraction of nodes change each tick.
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
  type FlatPortValueMap,
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

describe('Sparse Change Benchmark', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;
  let library: ComponentLibrary;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new ComponentLibraryAdapter(store);
  });

  it('benchmarks circuit where only 1 register changes', () => {
    // Simpler circuit: one toggle DFF + many dormant registers
    const dsl = `
      circuit SparseBenchmark {
        output active_out: Bit
        output dormant_out: Bus[8]

        impl {
          // Active section: one toggle flip-flop
          node toggle: DFlipFlop
          node inverter: Not
          connect toggle.q -> inverter.in
          connect inverter.out -> toggle.d
          connect toggle.q -> active_out

          // Dormant section: 20 registers holding constant 0
          node zero: Constant(value=0)
          node one_bit: Constant(value=1)

          node d0: Register(initial=0)
          node d1: Register(initial=0)
          node d2: Register(initial=0)
          node d3: Register(initial=0)
          node d4: Register(initial=0)
          node d5: Register(initial=0)
          node d6: Register(initial=0)
          node d7: Register(initial=0)
          node d8: Register(initial=0)
          node d9: Register(initial=0)
          node d10: Register(initial=0)
          node d11: Register(initial=0)
          node d12: Register(initial=0)
          node d13: Register(initial=0)
          node d14: Register(initial=0)
          node d15: Register(initial=0)
          node d16: Register(initial=0)
          node d17: Register(initial=0)
          node d18: Register(initial=0)
          node d19: Register(initial=0)

          connect zero.out -> d0.data
          connect zero.out -> d1.data
          connect zero.out -> d2.data
          connect zero.out -> d3.data
          connect zero.out -> d4.data
          connect zero.out -> d5.data
          connect zero.out -> d6.data
          connect zero.out -> d7.data
          connect zero.out -> d8.data
          connect zero.out -> d9.data
          connect zero.out -> d10.data
          connect zero.out -> d11.data
          connect zero.out -> d12.data
          connect zero.out -> d13.data
          connect zero.out -> d14.data
          connect zero.out -> d15.data
          connect zero.out -> d16.data
          connect zero.out -> d17.data
          connect zero.out -> d18.data
          connect zero.out -> d19.data

          connect one_bit.out -> d0.we
          connect one_bit.out -> d1.we
          connect one_bit.out -> d2.we
          connect one_bit.out -> d3.we
          connect one_bit.out -> d4.we
          connect one_bit.out -> d5.we
          connect one_bit.out -> d6.we
          connect one_bit.out -> d7.we
          connect one_bit.out -> d8.we
          connect one_bit.out -> d9.we
          connect one_bit.out -> d10.we
          connect one_bit.out -> d11.we
          connect one_bit.out -> d12.we
          connect one_bit.out -> d13.we
          connect one_bit.out -> d14.we
          connect one_bit.out -> d15.we
          connect one_bit.out -> d16.we
          connect one_bit.out -> d17.we
          connect one_bit.out -> d18.we
          connect one_bit.out -> d19.we

          // Adders downstream of dormant registers
          node add0: Adder
          node add1: Adder
          node add2: Adder
          node add3: Adder
          node add4: Adder

          connect d0.q -> add0.a
          connect d1.q -> add0.b
          connect d2.q -> add1.a
          connect d3.q -> add1.b
          connect d4.q -> add2.a
          connect d5.q -> add2.b
          connect d6.q -> add3.a
          connect d7.q -> add3.b
          connect d8.q -> add4.a
          connect d9.q -> add4.b

          connect add0.sum -> dormant_out
        }
      }
    `;

    const result = compileDSL(dsl, library);
    if (result.errors.length > 0) {
      console.error('DSL errors:', result.errors);
    }
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = store.resolveComponent('SparseBenchmark');
    expect(testCircuit).toBeDefined();

    const flatCircuit = elaborate(testCircuit!, store);
    let seqState = initializeFlatSequentialState(flatCircuit);

    console.log('\n========================================');
    console.log('SPARSE CHANGE BENCHMARK');
    console.log('========================================');
    console.log('Nodes: ' + flatCircuit.nodes.length);
    console.log('Connections: ' + flatCircuit.connections.length);

    // Warmup - let dormant registers settle to 0
    let previousPortValues: FlatPortValueMap | undefined;
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);
      seqState = r.sequentialState!;
      previousPortValues = r.portValues;
    }

    // Benchmark WITHOUT previousPortValues (O(N) - evaluates all nodes)
    const CYCLES = 5000;
    const start1 = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, undefined); // No previous values!
      seqState = r.sequentialState!;
    }
    const elapsed1 = performance.now() - start1;
    const hz1 = (CYCLES / elapsed1) * 1000;

    // Reset state for fair comparison
    seqState = initializeFlatSequentialState(flatCircuit);
    previousPortValues = undefined;
    for (let i = 0; i < 10; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);
      seqState = r.sequentialState!;
      previousPortValues = r.portValues;
    }

    // Benchmark WITH previousPortValues (O(K) - skips unchanged nodes)
    const start2 = performance.now();
    for (let i = 0; i < CYCLES; i++) {
      const r = runFlatSimulationTick(flatCircuit, seqState, previousPortValues);
      seqState = r.sequentialState!;
      previousPortValues = r.portValues;
    }
    const elapsed2 = performance.now() - start2;
    const hz2 = (CYCLES / elapsed2) * 1000;

    console.log('\n=== Results (same circuit, ' + flatCircuit.nodes.length + ' nodes) ===');
    console.log('WITHOUT previousPortValues (O(N)): ' + hz1.toFixed(0) + ' Hz');
    console.log('WITH previousPortValues (O(K)):    ' + hz2.toFixed(0) + ' Hz');
    console.log('Speedup: ' + (hz2 / hz1).toFixed(1) + 'x');

    expect(hz2).toBeGreaterThan(hz1); // O(K) should be faster
  });
});
