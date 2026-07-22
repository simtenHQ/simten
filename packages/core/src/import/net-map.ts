/**
 * Bit-vector reconstruction — the core of the Verilog importer.
 *
 * Yosys wires cells with arbitrary bit-id vectors (LSB-first). Simten connects
 * whole named ports. `segmentBits` bridges the two: it splits a bit vector into
 * maximal segments, each either a constant run or a contiguous ascending slice
 * of one driver port. The caller turns segments into direct connections,
 * `RtlSlice`, `RtlConcat2`, and `Constant` nodes.
 *
 * Pure and driver-agnostic (takes a `driverOf` lookup) so it can be unit-tested
 * over hand-built bit arrays without a real netlist. See net-map.test.ts.
 */

/** A yosys bit: a net id (number), a constant ('0'/'1'), or unknown ('x'/'z'). */
export type YosysBit = number | '0' | '1' | 'x' | 'z';

/** Who drives a given net bit, and at which index within its source port. */
export interface BitDriver {
  /** Source node id; '' denotes a top-level module input port. */
  nodeId: string;
  portName: string;
  /** Bit index within the source port (0 = LSB). */
  index: number;
}

export type Segment =
  | { kind: 'const'; value: number; width: number }
  | { kind: 'net'; nodeId: string; portName: string; offset: number; width: number };

// A constant bit is 0/1, or a don't-care (x/z). yosys emits `x` for the
// unreachable default of a fully-specified case and `z` for un-driven tristate;
// a 2-state sim resolves both to 0 (synthesis is likewise free to pick any
// value for a don't-care, and a correct design never selects that branch when
// it matters).
function isConst(b: YosysBit): b is '0' | '1' | 'x' | 'z' | 0 | 1 {
  return b === '0' || b === '1' || b === 'x' || b === 'z' || b === 0 || b === 1;
}

function constVal(b: YosysBit): number {
  return b === '1' || b === 1 ? 1 : 0;
}

/**
 * Split an LSB-first bit vector into maximal segments.
 *
 * - consecutive constant bits → one `const` segment
 * - consecutive net bits from the same driver port whose index increases by
 *   exactly 1 each step → one `net` segment (offset = first index, width = run)
 *
 * A repeated bit-id (e.g. sign extension `[b0,b1,b2,b3, b3,b3,b3,b3]`) breaks
 * the +1 rule, so the replicated MSB becomes its own 1-wide `net` segments —
 * folded downstream into `RtlConcat2(run, sliceₘₛᵦ, …)`.
 *
 * `x`/`z` bits resolve to constant 0 (see `isConst`).
 */
export function segmentBits(bits: YosysBit[], driverOf: (net: number) => BitDriver): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  while (i < bits.length) {
    const b = bits[i];
    if (isConst(b)) {
      let value = 0;
      let k = 0;
      while (i < bits.length && isConst(bits[i])) {
        value |= constVal(bits[i]) << k;
        i++;
        k++;
      }
      segs.push({ kind: 'const', value: value >>> 0, width: k });
      continue;
    }
    // net segment
    const d = driverOf(b as number);
    let width = 1;
    let j = i + 1;
    while (j < bits.length && typeof bits[j] === 'number') {
      const dj = driverOf(bits[j] as number);
      if (dj.nodeId === d.nodeId && dj.portName === d.portName && dj.index === d.index + width) {
        width++;
        j++;
      } else {
        break;
      }
    }
    segs.push({ kind: 'net', nodeId: d.nodeId, portName: d.portName, offset: d.index, width });
    i = j;
  }
  return segs;
}
