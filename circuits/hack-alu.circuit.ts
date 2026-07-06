/**
 * HackALU — the nand2tetris Hack ALU, built in Simten.
 *
 * Same chip students build in Project 2: two 16-bit inputs x, y and six
 * control bits that compose into 18 useful functions. This is a faithful,
 * combinational implementation using the same building blocks the course
 * uses (Mux16, Add16, And16, Not16) so it reads 1:1 with the .hdl version.
 *
 *   if (zx) x = 0          // 16-bit zero
 *   if (nx) x = !x         // bitwise Not
 *   if (zy) y = 0
 *   if (ny) y = !y
 *   if (f)  out = x + y    // 2's-complement add   (f == 0 → out = x & y)
 *   if (no) out = !out
 *   zr = (out == 0)
 *   ng = (out < 0)         // i.e. out[15], the sign bit
 */

import { circuit, bit, bus } from '@simten/core/circuit';
import { Mux, Adder, BusAnd, BusXor, Comparator, BitSlice, Constant } from '@simten/core/std';

export const HackALU = circuit('HackALU', {
  inputs: {
    x: bus(16),
    y: bus(16),
    zx: bit,
    nx: bit,
    zy: bit,
    ny: bit,
    f: bit,
    no: bit,
  },
  outputs: {
    out: bus(16),
    zr: bit,
    ng: bit,
  },
  nodes: {
    zero16: Constant({ value: 0, width: 16 }), // 16-bit false constant
    ones16: Constant({ value: 65535, width: 16 }), // 0xFFFF — XOR mask for 16-bit NOT
    carry0: Constant({ value: 0 }), // adder carry-in = 0

    // x preprocessing: zero then negate (NOT via XOR with 0xFFFF)
    muxZX: Mux({ width: 16 }),
    notX: BusXor({ width: 16 }),
    muxNX: Mux({ width: 16 }),

    // y preprocessing: zero then negate
    muxZY: Mux({ width: 16 }),
    notY: BusXor({ width: 16 }),
    muxNY: Mux({ width: 16 }),

    // function: add vs and, selected by f
    add16: Adder({ width: 16 }),
    and16: BusAnd({ width: 16 }),
    muxF: Mux({ width: 16 }),

    // output negate
    notOut: BusXor({ width: 16 }),
    muxNO: Mux({ width: 16 }),

    // flags
    zrCmp: Comparator({ width: 16 }), // out == 0
    sign: BitSlice({ low: 15, high: 15 }), // out[15] → ng
  },
  connect: ({ inputs, outputs, nodes }) => [
    // --- x: zero (zx) ---
    inputs.x.to(nodes.muxZX.in0),
    nodes.zero16.out.to(nodes.muxZX.in1),
    inputs.zx.to(nodes.muxZX.sel),

    // --- x: negate (nx) ---
    nodes.muxZX.out.to(nodes.notX.a, nodes.muxNX.in0),
    nodes.ones16.out.to(nodes.notX.b),
    nodes.notX.out.to(nodes.muxNX.in1),
    inputs.nx.to(nodes.muxNX.sel),

    // --- y: zero (zy) ---
    inputs.y.to(nodes.muxZY.in0),
    nodes.zero16.out.to(nodes.muxZY.in1),
    inputs.zy.to(nodes.muxZY.sel),

    // --- y: negate (ny) ---
    nodes.muxZY.out.to(nodes.notY.a, nodes.muxNY.in0),
    nodes.ones16.out.to(nodes.notY.b),
    nodes.notY.out.to(nodes.muxNY.in1),
    inputs.ny.to(nodes.muxNY.sel),

    // --- function: f ? (x + y) : (x & y) ---
    nodes.muxNX.out.to(nodes.add16.a, nodes.and16.a),
    nodes.muxNY.out.to(nodes.add16.b, nodes.and16.b),
    nodes.carry0.out.to(nodes.add16.carry_in),
    nodes.and16.out.to(nodes.muxF.in0), // f = 0 → AND
    nodes.add16.sum.to(nodes.muxF.in1), // f = 1 → ADD
    inputs.f.to(nodes.muxF.sel),

    // --- output negate: no ---
    nodes.muxF.out.to(nodes.notOut.a, nodes.muxNO.in0),
    nodes.ones16.out.to(nodes.notOut.b),
    nodes.notOut.out.to(nodes.muxNO.in1),
    inputs.no.to(nodes.muxNO.sel),

    // --- final out + flags ---
    nodes.muxNO.out.to(outputs.out, nodes.zrCmp.a, nodes.sign.in),
    nodes.zero16.out.to(nodes.zrCmp.b),
    nodes.zrCmp.eq.to(outputs.zr),
    nodes.sign.out.to(outputs.ng),
  ],
});
