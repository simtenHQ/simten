/**
 * Circuit definitions for the "Sorting Networks" blog post.
 *
 * Builds toward a 4-element Batcher odd-even merge sort network,
 * starting from a single compare-and-swap primitive.
 */

import { bus, circuit } from '@simten/core/circuit';
import { Comparator, Constant, HexDisplay, Input, Mux, Register } from '@simten/core/std';
import type { BlogCircuit } from '../types';

// ── Compare-and-swap subcircuit ──
// Outputs min on `lo`, max on `hi`, unconditionally and with no branching.
// cmp.lt=1 means a < b, so lo=a (in1), hi=b (in1).
const CompareSwap = circuit('CompareSwap', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { lo: bus(8), hi: bus(8) },
  nodes: { cmp: Comparator(), muxLo: Mux(), muxHi: Mux() },
  connect: ({ inputs, outputs, nodes: { cmp, muxLo, muxHi } }) => [
    inputs.a.to(cmp.a, muxLo.in1, muxHi.in0),
    inputs.b.to(cmp.b, muxLo.in0, muxHi.in1),
    cmp.lt.to(muxLo.sel, muxHi.sel),
    muxLo.out.to(outputs.lo),
    muxHi.out.to(outputs.hi),
  ],
});

// ── Standalone demo: single compare-and-swap ──
export const CompareSwapDemo = circuit('CompareSwapDemo', {
  nodes: {
    a: Input({ value: 7 }),
    b: Input({ value: 3 }),
    cs: CompareSwap,
    loDisplay: HexDisplay,
    hiDisplay: HexDisplay,
  },
  connect: ({ nodes: { a, b, cs, loDisplay, hiDisplay } }) => [
    a.out.to(cs.a),
    b.out.to(cs.b),
    cs.lo.to(loDisplay.in),
    cs.hi.to(hiDisplay.in),
  ],
});

// ── 4-element Batcher odd-even merge sort ──
// 3 stages, 5 comparators, O(log²n) depth.
//
// Stage 1: (0,1) (2,3)
// Stage 2: (0,2) (1,3)
// Stage 3:    (1,2)
export const SortNet4 = circuit('SortNet4', {
  inputs: { v0: bus(8), v1: bus(8), v2: bus(8), v3: bus(8) },
  outputs: { s0: bus(8), s1: bus(8), s2: bus(8), s3: bus(8) },
  nodes: {
    // Stage 1
    cs01: CompareSwap,
    cs23: CompareSwap,
    // Stage 2
    cs02: CompareSwap,
    cs13: CompareSwap,
    // Stage 3
    cs12: CompareSwap,
  },
  connect: ({ inputs, outputs, nodes: { cs01, cs23, cs02, cs13, cs12 } }) => [
    // Stage 1
    inputs.v0.to(cs01.a),
    inputs.v1.to(cs01.b),
    inputs.v2.to(cs23.a),
    inputs.v3.to(cs23.b),
    // Stage 2
    cs01.lo.to(cs02.a),
    cs23.lo.to(cs02.b),
    cs01.hi.to(cs13.a),
    cs23.hi.to(cs13.b),
    // Stage 3
    cs02.hi.to(cs12.a),
    cs13.lo.to(cs12.b),
    // Outputs
    cs02.lo.to(outputs.s0),
    cs12.lo.to(outputs.s1),
    cs12.hi.to(outputs.s2),
    cs13.hi.to(outputs.s3),
  ],
});

// ── Top-level demo: SortNet4 with Inputs and HexDisplays ──
export const SortDemo = circuit('SortDemo', {
  nodes: {
    v0: Input({ value: 42 }),
    v1: Input({ value: 7 }),
    v2: Input({ value: 200 }),
    v3: Input({ value: 13 }),
    sorter: SortNet4,
    d0: HexDisplay,
    d1: HexDisplay,
    d2: HexDisplay,
    d3: HexDisplay,
  },
  connect: ({ nodes: { v0, v1, v2, v3, sorter, d0, d1, d2, d3 } }) => [
    v0.out.to(sorter.v0),
    v1.out.to(sorter.v1),
    v2.out.to(sorter.v2),
    v3.out.to(sorter.v3),
    sorter.s0.to(d0.in),
    sorter.s1.to(d1.in),
    sorter.s2.to(d2.in),
    sorter.s3.to(d3.in),
  ],
});

// ── Pipelined 4-element sort network ──
// Same 5 comparators as SortNet4, but register banks between each stage
// make inputs and outputs independent, so a new result emerges every clock cycle
// after 3 cycles of initial latency.
export const PipelinedSortNet4 = circuit('PipelinedSortNet4', {
  inputs: { v0: bus(8), v1: bus(8), v2: bus(8), v3: bus(8) },
  outputs: { s0: bus(8), s1: bus(8), s2: bus(8), s3: bus(8) },
  nodes: {
    // Stage 1 comparators
    cs01: CompareSwap,
    cs23: CompareSwap,
    // Registers between stage 1 and 2 (4 wires)
    r1_0: Register({ width: 8 }),
    r1_1: Register({ width: 8 }),
    r1_2: Register({ width: 8 }),
    r1_3: Register({ width: 8 }),
    // Stage 2 comparators
    cs02: CompareSwap,
    cs13: CompareSwap,
    // Registers between stage 2 and 3 (4 wires)
    r2_0: Register({ width: 8 }),
    r2_1: Register({ width: 8 }),
    r2_2: Register({ width: 8 }),
    r2_3: Register({ width: 8 }),
    // Stage 3 comparator
    cs12: CompareSwap,
    // Write-enable constant (always 1)
    we: Constant({ value: 1 }),
  },
  connect: ({
    inputs,
    outputs,
    nodes: { cs01, cs23, r1_0, r1_1, r1_2, r1_3, cs02, cs13, r2_0, r2_1, r2_2, r2_3, cs12, we },
  }) => [
    // Stage 1
    inputs.v0.to(cs01.a),
    inputs.v1.to(cs01.b),
    inputs.v2.to(cs23.a),
    inputs.v3.to(cs23.b),
    // Registers after stage 1
    cs01.lo.to(r1_0.data),
    cs01.hi.to(r1_1.data),
    cs23.lo.to(r1_2.data),
    cs23.hi.to(r1_3.data),
    we.out.to(r1_0.we, r1_1.we, r1_2.we, r1_3.we),
    // Stage 2 reads from stage-1 registers
    r1_0.q.to(cs02.a),
    r1_2.q.to(cs02.b),
    r1_1.q.to(cs13.a),
    r1_3.q.to(cs13.b),
    // Registers after stage 2
    cs02.lo.to(r2_0.data),
    cs02.hi.to(r2_1.data),
    cs13.lo.to(r2_2.data),
    cs13.hi.to(r2_3.data),
    we.out.to(r2_0.we, r2_1.we, r2_2.we, r2_3.we),
    // Stage 3 reads from stage-2 registers
    r2_1.q.to(cs12.a),
    r2_2.q.to(cs12.b),
    // Outputs
    r2_0.q.to(outputs.s0),
    cs12.lo.to(outputs.s1),
    cs12.hi.to(outputs.s2),
    r2_3.q.to(outputs.s3),
  ],
});

// ── Top-level demo: PipelinedSortNet4 with Inputs and HexDisplays ──
export const PipelinedSortDemo = circuit('PipelinedSortDemo', {
  nodes: {
    v0: Input({ value: 42 }),
    v1: Input({ value: 7 }),
    v2: Input({ value: 200 }),
    v3: Input({ value: 13 }),
    sorter: PipelinedSortNet4,
    d0: HexDisplay,
    d1: HexDisplay,
    d2: HexDisplay,
    d3: HexDisplay,
  },
  connect: ({ nodes: { v0, v1, v2, v3, sorter, d0, d1, d2, d3 } }) => [
    v0.out.to(sorter.v0),
    v1.out.to(sorter.v1),
    v2.out.to(sorter.v2),
    v3.out.to(sorter.v3),
    sorter.s0.to(d0.in),
    sorter.s1.to(d1.in),
    sorter.s2.to(d2.in),
    sorter.s3.to(d3.in),
  ],
});

export const SORTING_CIRCUITS: Record<string, BlogCircuit> = {
  compareSwapDemo: {
    name: 'Compare-and-Swap',
    description:
      'Two inputs enter, the smaller exits on `lo` and the larger on `hi`. No branches: a Comparator drives two Muxes.',
    circuit: CompareSwapDemo,
  },

  sortDemo: {
    name: '4-Element Batcher Sort Network',
    description:
      'Three stages, five comparators. Any four 8-bit values emerge sorted in ascending order. Change the inputs and the result updates instantly.',
    circuit: SortDemo,
  },

  pipelinedSortDemo: {
    name: 'Pipelined Sort Network',
    description:
      'Register banks between stages decouple inputs from outputs. After 3 cycles of latency, a new sorted result emerges every single clock cycle. Step through cycles to watch values propagate.',
    circuit: PipelinedSortDemo,
  },
};
