/** Standard Library — gate-level reference builds ("made of"). Display only. */

// Every stdlib primitive is eval-only: `Adder({ width: 16 })` computes
// `a + b + carry_in` in one step and has no internal structure, so drilling into
// one on the canvas hits a wall. These builders supply the missing picture — one
// way to construct the same function out of gates.
//
// DISPLAY ONLY. Nothing here is elaborated into a running netlist. The simulator,
// the Verilog exporter and the FPGA flow never see these circuits; they exist so
// the canvas can show a reader what an adder *is*. Keeping the primitives
// primitive is what keeps the synth voice at ~78k ticks/s and lets Yosys infer a
// carry chain instead of reading a thousand structural assigns.
//
// These are honest but not literal: a ripple-carry adder is the right way to
// teach addition and is not what synthesis emits. That distinction matters to
// whoever edits this file; it is not surfaced in the UI, because what the reader
// runs is the primitive's eval either way and the two are proven equivalent.
//
// They stop at Xor/And/Or/Not. The game already teaches NAND -> gates level by
// level; this covers gates -> arithmetic. No overlap.
//
// Each entry is checked against its primitive's `eval` by `made-of.verify.ts`,
// so a diagram cannot drift from the thing it explains.
//
// NOTE: this module is deliberately absent from `_allExports` in `index.ts`.
// `STDLIB_CIRCUITS` materializes exported functions by calling them with no
// arguments and keeping anything that returns a `BuiltCircuit`, so a builder
// exported bare from a std module could be silently registered as a duplicate
// stdlib circuit. `std/__tests__/made-of.test.ts` guards that.
//
// Skipped on purpose: Multiplier/Divider (a 256-adder array teaches nothing),
// memory (ROM/RAM map to hardened blocks, so a gate build would misrepresent the
// hardware), Constant, and the display peripherals.

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';
import type { ArgumentValue } from '../types/circuit.js';
import { FullAdder } from './arithmetic.js';
import { Constant } from './io.js';
import { And, Not, Or, Xnor, Xor } from './logic.js';
import { Slice } from './reconstruction.js';
import { Concat } from './routing.js';

/** A gate-level build of a primitive, specialized to that node's arguments. */
export type MadeOfBuilder = (args: Record<string, ArgumentValue>) => unknown;

/** Read a positive integer `width`, falling back when absent or malformed. */
function widthOf(args: Record<string, ArgumentValue>, fallback: number): number {
  const raw = args.width;
  const n = typeof raw === 'number' ? raw : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Fan a bus out to individual bits. Slicing is free in real hardware — it is
 * which wire you grab — but the IR connects port to port, so it needs a node.
 */
const bitsOf = (width: number) =>
  Array.from({ length: width }, (_, i) => Slice({ inWidth: width, offset: i, width: 1 }));

/**
 * Nodes to reassemble bits into a bus, LSB first. Folds left so each Concat
 * widens the accumulator by one.
 */
const joinNodes = (width: number) =>
  Array.from({ length: Math.max(0, width - 1) }, (_, i) => Concat({ hiWidth: 1, loWidth: i + 1 }));

// ============================================================================
// Adder — ripple carry
// ============================================================================

/**
 * `Adder({ width: N })` as N FullAdders in a ripple-carry chain.
 *
 * Each stage waits on the carry from the stage below it, which is why the
 * drill-down shows the carry rippling: bit 0 settles first, bit N-1 last.
 * Synthesis maps this to a carry-lookahead structure or the target's dedicated
 * carry chain, which is faster and looks nothing like this.
 */
function adderMadeOf(args: Record<string, ArgumentValue>) {
  const width = widthOf(args, 8);
  return circuit(`Adder${width}_madeOf`, {
    inputs: { a: bus(width), b: bus(width), carry_in: bit },
    outputs: { sum: bus(width), carry_out: bit },
    nodes: {
      aBit: bitsOf(width),
      bBit: bitsOf(width),
      fa: Array.from({ length: width }, () => FullAdder),
      join: joinNodes(width),
    },
    connect: ({ inputs, outputs, nodes: { aBit, bBit, fa, join } }) => [
      ...aBit.map((s) => inputs.a.to(s.in)),
      ...bBit.map((s) => inputs.b.to(s.in)),
      ...aBit.map((s, i) => s.out.to(fa[i].a)),
      ...bBit.map((s, i) => s.out.to(fa[i].b)),
      inputs.carry_in.to(fa[0].carry_in),
      ...fa.slice(0, -1).map((stage, i) => stage.carry_out.to(fa[i + 1].carry_in)),
      fa[width - 1].carry_out.to(outputs.carry_out),
      ...(width === 1
        ? [fa[0].sum.to(outputs.sum)]
        : [
            fa[0].sum.to(join[0].low),
            ...join.map((j, i) => fa[i + 1].sum.to(j.high)),
            ...join.slice(0, -1).map((j, i) => j.out.to(join[i + 1].low)),
            join[join.length - 1].out.to(outputs.sum),
          ]),
    ],
  });
}

// ============================================================================
// Subtractor — add the two's complement
// ============================================================================

/**
 * `Subtractor({ width: N })` as `a + ~b + !borrow_in`.
 *
 * Two's complement makes subtraction addition with the subtrahend inverted and
 * a carry forced in, so this is the adder again with a row of inverters on `b`.
 * `borrow_out` is the inverted carry: the chain carries out exactly when it did
 * *not* need to borrow.
 */
function subtractorMadeOf(args: Record<string, ArgumentValue>) {
  const width = widthOf(args, 8);
  return circuit(`Subtractor${width}_madeOf`, {
    inputs: { a: bus(width), b: bus(width), borrow_in: bit },
    outputs: { difference: bus(width), borrow_out: bit },
    nodes: {
      aBit: bitsOf(width),
      bBit: bitsOf(width),
      inv: Array.from({ length: width }, () => Not),
      notBorrow: Not,
      fa: Array.from({ length: width }, () => FullAdder),
      invCarry: Not,
      join: joinNodes(width),
    },
    connect: ({ inputs, outputs, nodes: { aBit, bBit, inv, notBorrow, fa, invCarry, join } }) => [
      ...aBit.map((s) => inputs.a.to(s.in)),
      ...bBit.map((s) => inputs.b.to(s.in)),
      ...aBit.map((s, i) => s.out.to(fa[i].a)),
      ...bBit.map((s, i) => s.out.to(inv[i].in)),
      ...inv.map((n, i) => n.out.to(fa[i].b)),
      inputs.borrow_in.to(notBorrow.in),
      notBorrow.out.to(fa[0].carry_in),
      ...fa.slice(0, -1).map((stage, i) => stage.carry_out.to(fa[i + 1].carry_in)),
      fa[width - 1].carry_out.to(invCarry.in),
      invCarry.out.to(outputs.borrow_out),
      ...(width === 1
        ? [fa[0].sum.to(outputs.difference)]
        : [
            fa[0].sum.to(join[0].low),
            ...join.map((j, i) => fa[i + 1].sum.to(j.high)),
            ...join.slice(0, -1).map((j, i) => j.out.to(join[i + 1].low)),
            join[join.length - 1].out.to(outputs.difference),
          ]),
    ],
  });
}

// ============================================================================
// Incrementer — half adders are enough
// ============================================================================

/**
 * `Incrementer` as a chain of half adders. Fixed 8-bit: the primitive is not
 * width-parameterized.
 *
 * Adding a constant 1 needs no full adder — there is no second operand, only
 * the carry. Bit 0 always flips, so it is a bare inverter. Bit i flips when
 * every bit below it was set, which is what the AND chain accumulates. The
 * carry out of the top bit is dropped, so 255 + 1 wraps to 0, matching
 * `(in + 1) & 0xff`.
 */
function incrementerMadeOf(_args: Record<string, ArgumentValue>) {
  const width = 8;
  // carry[1] is in[0] itself; carry[i] = in[i-1] & carry[i-1] for i >= 2.
  return circuit('Incrementer_madeOf', {
    inputs: { in: bus(width) },
    outputs: { out: bus(width) },
    nodes: {
      inBit: bitsOf(width),
      lsb: Not,
      flip: Array.from({ length: width - 1 }, () => Xor),
      carry: Array.from({ length: width - 2 }, () => And),
      join: joinNodes(width),
    },
    connect: ({ inputs, outputs, nodes: { inBit, lsb, flip, carry, join } }) => {
      // carrySig[i] drives flip[i - 1] (which produces out[i]).
      const carrySig = [inBit[0].out, ...carry.map((g) => g.out)];
      return [
        ...inBit.map((s) => inputs.in.to(s.in)),
        inBit[0].out.to(lsb.in),
        // carry[j] = in[j + 1] & carrySig[j]  ->  carrySig[j + 1]
        ...carry.map((g, j) => inBit[j + 1].out.to(g.a)),
        ...carry.map((g, j) => carrySig[j].to(g.b)),
        // out[i + 1] = in[i + 1] ^ carrySig[i]
        ...flip.map((x, i) => inBit[i + 1].out.to(x.a)),
        ...flip.map((x, i) => carrySig[i].to(x.b)),
        lsb.out.to(join[0].low),
        ...join.map((j, i) => flip[i].out.to(j.high)),
        ...join.slice(0, -1).map((j, i) => j.out.to(join[i + 1].low)),
        join[join.length - 1].out.to(outputs.out),
      ];
    },
  });
}

// ============================================================================
// Mux — one select line, N bit slices
// ============================================================================

/** The one-bit select: `out = (in0 & !sel) | (in1 & sel)`. */
function muxBitMadeOf() {
  return circuit('Mux1_madeOf', {
    inputs: { in0: bit, in1: bit, sel: bit },
    outputs: { out: bit },
    nodes: { notSel: Not, keep: And, take: And, pick: Or },
    connect: ({ inputs, outputs, nodes: { notSel, keep, take, pick } }) => [
      inputs.sel.to(notSel.in, take.b),
      notSel.out.to(keep.a),
      inputs.in0.to(keep.b),
      inputs.in1.to(take.a),
      keep.out.to(pick.a),
      take.out.to(pick.b),
      pick.out.to(outputs.out),
    ],
  });
}

/**
 * `Mux({ width: N })` as N copies of the one-bit select.
 *
 * The select line fans out to every bit and nothing ripples, so this one is
 * wide and flat where the adder is long and sequential — the picture of why a
 * mux is cheap and an adder is not.
 */
function muxMadeOf(args: Record<string, ArgumentValue>) {
  const width = widthOf(args, 1);
  if (width === 1) return muxBitMadeOf();
  return circuit(`Mux${width}_madeOf`, {
    inputs: { in0: bus(width), in1: bus(width), sel: bit },
    outputs: { out: bus(width) },
    nodes: {
      in0Bit: bitsOf(width),
      in1Bit: bitsOf(width),
      notSel: Not,
      keep: Array.from({ length: width }, () => And),
      take: Array.from({ length: width }, () => And),
      pick: Array.from({ length: width }, () => Or),
      join: joinNodes(width),
    },
    connect: ({ inputs, outputs, nodes: { in0Bit, in1Bit, notSel, keep, take, pick, join } }) => [
      ...in0Bit.map((s) => inputs.in0.to(s.in)),
      ...in1Bit.map((s) => inputs.in1.to(s.in)),
      inputs.sel.to(notSel.in, ...take.map((g) => g.b)),
      notSel.out.to(...keep.map((g) => g.a)),
      ...in0Bit.map((s, i) => s.out.to(keep[i].b)),
      ...in1Bit.map((s, i) => s.out.to(take[i].a)),
      ...keep.map((g, i) => g.out.to(pick[i].a)),
      ...take.map((g, i) => g.out.to(pick[i].b)),
      pick[0].out.to(join[0].low),
      ...join.map((j, i) => pick[i + 1].out.to(j.high)),
      ...join.slice(0, -1).map((j, i) => j.out.to(join[i + 1].low)),
      join[join.length - 1].out.to(outputs.out),
    ],
  });
}

// ============================================================================
// Comparator — equality by XNOR, ordering by subtraction
// ============================================================================

/**
 * `Comparator({ width: N })` as an equality tree plus one subtraction.
 *
 * `eq` is every bit pair agreeing: an AND reduction over XNORs. Ordering falls
 * out of `a - b` — if the subtraction borrows, `a < b`. The remaining four
 * outputs are combinations of those two facts, which is why a comparator costs
 * about one adder rather than six separate circuits.
 */
function comparatorMadeOf(args: Record<string, ArgumentValue>) {
  const width = widthOf(args, 8);
  return circuit(`Comparator${width}_madeOf`, {
    inputs: { a: bus(width), b: bus(width) },
    outputs: { eq: bit, ne: bit, lt: bit, le: bit, gt: bit, ge: bit },
    nodes: {
      aBit: bitsOf(width),
      bBit: bitsOf(width),
      // Equality per bit is exactly XNOR. Building it from Xor + Not would add
      // a gate per bit and teach nothing extra.
      same: Array.from({ length: width }, () => Xnor),
      allSame: Array.from({ length: Math.max(0, width - 1) }, () => And),
      notEq: Not,
      // a < b is the borrow out of a - b == a + ~b + 1.
      inv: Array.from({ length: width }, () => Not),
      one: Constant({ value: 1 }),
      fa: Array.from({ length: width }, () => FullAdder),
      isLt: Not,
      le: Or,
      gt: And,
    },
    connect: ({
      inputs,
      outputs,
      nodes: { aBit, bBit, same, allSame, notEq, inv, one, fa, isLt, le, gt },
    }) => {
      // With one bit there is nothing to reduce; `same[0]` is already equality.
      const eqSignal = width === 1 ? same[0].out : allSame[allSame.length - 1].out;
      return [
        ...aBit.map((s) => inputs.a.to(s.in)),
        ...bBit.map((s) => inputs.b.to(s.in)),
        ...aBit.map((s, i) => s.out.to(same[i].a, fa[i].a)),
        ...bBit.map((s, i) => s.out.to(same[i].b, inv[i].in)),
        // Fold the per-bit agreements: allSame[0] = same[0] & same[1], then
        // each further gate ANDs in the next bit.
        ...(width === 1
          ? []
          : [
              same[0].out.to(allSame[0].a),
              same[1].out.to(allSame[0].b),
              ...allSame.slice(1).map((g, i) => same[i + 2].out.to(g.b)),
              ...allSame.slice(0, -1).map((g, i) => g.out.to(allSame[i + 1].a)),
            ]),
        eqSignal.to(outputs.eq, notEq.in, le.b),
        notEq.out.to(outputs.ne, gt.b),
        // a + ~b + 1
        ...inv.map((n, i) => n.out.to(fa[i].b)),
        one.out.to(fa[0].carry_in),
        ...fa.slice(0, -1).map((stage, i) => stage.carry_out.to(fa[i + 1].carry_in)),
        // carry_out == 1 means no borrow, so a >= b.
        fa[width - 1].carry_out.to(outputs.ge, isLt.in, gt.a),
        isLt.out.to(outputs.lt, le.a),
        le.out.to(outputs.le),
        gt.out.to(outputs.gt),
      ];
    },
  });
}

// ============================================================================
// The table
// ============================================================================

// Deliberately not a mutable registry: the set is fixed at build time and
// nothing registers into it at runtime, unlike `eval-registry`, which exists
// because user code defines evals dynamically.
/** Gate-level reference builds, keyed by primitive name. Display only. */
export const MADE_OF: Readonly<Record<string, MadeOfBuilder>> = Object.freeze({
  Adder: adderMadeOf,
  Subtractor: subtractorMadeOf,
  Incrementer: incrementerMadeOf,
  Mux: muxMadeOf,
  Comparator: comparatorMadeOf,
});

/** The primitives that have a gate-level reference build. */
export const MADE_OF_NAMES: readonly string[] = Object.freeze(Object.keys(MADE_OF));

/** Whether a primitive has a gate-level reference build to drill into. */
export function hasMadeOf(componentRef: string): boolean {
  return Object.hasOwn(MADE_OF, componentRef);
}
