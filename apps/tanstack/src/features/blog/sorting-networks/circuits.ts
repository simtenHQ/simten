/**
 * Circuit definitions for the "Sorting Networks" blog post.
 *
 * Builds toward a 4-element Batcher odd-even merge sort network,
 * starting from a single compare-and-swap primitive.
 */

import { circuit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Input,
  HexDisplay,
  Comparator,
  Mux,
} from "@simten/core/std";

// ── Compare-and-swap subcircuit ──
// Outputs min on `lo`, max on `hi` — unconditionally, no branching.
// cmp.lt=1 means a < b, so lo=a (in1), hi=b (in1).
const CompareSwap = circuit("CompareSwap", {
  in: { a: bus(8), b: bus(8) },
  out: { lo: bus(8), hi: bus(8) },
  nodes: { cmp: Comparator, muxLo: Mux, muxHi: Mux },
  connect: ({ in: inp, out, cmp, muxLo, muxHi }) => [
    inp.a.to(cmp.a, muxLo.in1, muxHi.in0),
    inp.b.to(cmp.b, muxLo.in0, muxHi.in1),
    cmp.lt.to(muxLo.sel, muxHi.sel),
    muxLo.out.to(out.lo),
    muxHi.out.to(out.hi),
  ],
});

// ── Standalone demo: single compare-and-swap ──
export const CompareSwapDemo = circuit("CompareSwapDemo", {
  nodes: {
    a: Input,
    b: Input,
    cs: CompareSwap,
    loDisplay: HexDisplay,
    hiDisplay: HexDisplay,
  },
  nodeArgs: { a: { value: 7 }, b: { value: 3 } },
  connect: ({ a, b, cs, loDisplay, hiDisplay }) => [
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
export const SortNet4 = circuit("SortNet4", {
  in: { v0: bus(8), v1: bus(8), v2: bus(8), v3: bus(8) },
  out: { s0: bus(8), s1: bus(8), s2: bus(8), s3: bus(8) },
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
  connect: ({ in: inp, out, cs01, cs23, cs02, cs13, cs12 }) => [
    // Stage 1
    inp.v0.to(cs01.a),
    inp.v1.to(cs01.b),
    inp.v2.to(cs23.a),
    inp.v3.to(cs23.b),
    // Stage 2
    cs01.lo.to(cs02.a),
    cs23.lo.to(cs02.b),
    cs01.hi.to(cs13.a),
    cs23.hi.to(cs13.b),
    // Stage 3
    cs02.hi.to(cs12.a),
    cs13.lo.to(cs12.b),
    // Outputs
    cs02.lo.to(out.s0),
    cs12.lo.to(out.s1),
    cs12.hi.to(out.s2),
    cs13.hi.to(out.s3),
  ],
});

// ── Top-level demo: SortNet4 with Inputs and HexDisplays ──
export const SortDemo = circuit("SortDemo", {
  nodes: {
    v0: Input,
    v1: Input,
    v2: Input,
    v3: Input,
    sorter: SortNet4,
    d0: HexDisplay,
    d1: HexDisplay,
    d2: HexDisplay,
    d3: HexDisplay,
  },
  nodeArgs: {
    v0: { value: 42 },
    v1: { value: 7 },
    v2: { value: 200 },
    v3: { value: 13 },
  },
  connect: ({ v0, v1, v2, v3, sorter, d0, d1, d2, d3 }) => [
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
    name: "Compare-and-Swap",
    description:
      "Two inputs enter, the smaller exits on `lo` and the larger on `hi`. No branches — a Comparator drives two Muxes.",
    circuit: CompareSwapDemo,
  },

  sortDemo: {
    name: "4-Element Batcher Sort Network",
    description:
      "Three stages, five comparators. Any four 8-bit values emerge sorted in ascending order. Change the inputs and the result updates instantly.",
    circuit: SortDemo,
  },
};
