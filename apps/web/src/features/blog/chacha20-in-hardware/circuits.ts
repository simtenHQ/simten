/**
 * Circuit definitions for the "ChaCha20 in Hardware" blog post.
 *
 * Builds from the three ARX primitives (ADD, XOR, ROTL) up to the
 * full quarter-round that powers TLS encryption across the internet.
 */

import { circuit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Input, HexDisplay, Constant,
  Adder, BusXor, BusOr,
  LeftShifter, RightShifter,
} from "@simten/core/std";

// ── Rotation sub-circuits ──

export const RotateLeft16 = circuit('RotateLeft16', {
  inputs: { x: bus(32) },
  outputs: { out: bus(32) },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c16: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c16: { value: 16, width: 32 }, combine: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { sh_left, sh_right, c16, combine } }) => [
    inputs.x.to(sh_left.value, sh_right.value),
    c16.out.to(sh_left.shift, sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(outputs.out),
  ],
});

export const RotateLeft12 = circuit('RotateLeft12', {
  inputs: { x: bus(32) },
  outputs: { out: bus(32) },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c12: Constant, c20: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c12: { value: 12, width: 32 }, c20: { value: 20, width: 32 }, combine: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { sh_left, sh_right, c12, c20, combine } }) => [
    inputs.x.to(sh_left.value, sh_right.value),
    c12.out.to(sh_left.shift),
    c20.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(outputs.out),
  ],
});

export const RotateLeft8 = circuit('RotateLeft8', {
  inputs: { x: bus(32) },
  outputs: { out: bus(32) },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c8: Constant, c24: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c8: { value: 8, width: 32 }, c24: { value: 24, width: 32 }, combine: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { sh_left, sh_right, c8, c24, combine } }) => [
    inputs.x.to(sh_left.value, sh_right.value),
    c8.out.to(sh_left.shift),
    c24.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(outputs.out),
  ],
});

export const RotateLeft7 = circuit('RotateLeft7', {
  inputs: { x: bus(32) },
  outputs: { out: bus(32) },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c7: Constant, c25: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c7: { value: 7, width: 32 }, c25: { value: 25, width: 32 }, combine: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { sh_left, sh_right, c7, c25, combine } }) => [
    inputs.x.to(sh_left.value, sh_right.value),
    c7.out.to(sh_left.shift),
    c25.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(outputs.out),
  ],
});

// ── Quarter-round ──

export const ChaCha20QuarterRound = circuit('ChaCha20QuarterRound', {
  inputs: { a: bus(32), b: bus(32), c: bus(32), d: bus(32) },
  outputs: { a_out: bus(32), b_out: bus(32), c_out: bus(32), d_out: bus(32) },
  nodes: { gnd: Constant, add1: Adder, xor1: BusXor, rot16: RotateLeft16, add2: Adder, xor2: BusXor, rot12: RotateLeft12, add3: Adder, xor3: BusXor, rot8: RotateLeft8, add4: Adder, xor4: BusXor, rot7: RotateLeft7 },
  nodeArgs: { gnd: { value: 0 }, add1: { width: 32 }, xor1: { width: 32 }, add2: { width: 32 }, xor2: { width: 32 }, add3: { width: 32 }, xor3: { width: 32 }, add4: { width: 32 }, xor4: { width: 32 } },
  connect: ({ inputs, outputs, nodes: { gnd, add1, xor1, rot16, add2, xor2, rot12, add3, xor3, rot8, add4, xor4, rot7 } }) => [
    inputs.a.to(add1.a),
    inputs.b.to(add1.b, xor2.a),
    gnd.out.to(add1.carry_in, add2.carry_in, add3.carry_in, add4.carry_in),
    inputs.d.to(xor1.a),
    add1.sum.to(xor1.b, add3.a),
    xor1.out.to(rot16.x),
    inputs.c.to(add2.a),
    rot16.out.to(add2.b, xor3.a),
    add2.sum.to(xor2.b, add4.a),
    xor2.out.to(rot12.x),
    rot12.out.to(add3.b, xor4.a),
    add3.sum.to(xor3.b, outputs.a_out),
    xor3.out.to(rot8.x),
    rot8.out.to(add4.b, outputs.d_out),
    add4.sum.to(xor4.b, outputs.c_out),
    xor4.out.to(rot7.x),
    rot7.out.to(outputs.b_out),
  ],
});

// ── Self-contained demo circuits ──

export const ARXDemo = circuit('ARXDemo', {
  nodes: { a: Input, b: Input, gnd: Constant, add: Adder, sum: HexDisplay, xor: BusXor, xor_out: HexDisplay },
  nodeArgs: { a: { value: 100, width: 32 }, b: { value: 42, width: 32 }, gnd: { value: 0 }, add: { width: 32 }, sum: { width: 32 }, xor: { width: 32 }, xor_out: { width: 32 } },
  connect: ({ nodes: { a, b, gnd, add, sum, xor, xor_out } }) => [
    a.out.to(add.a, xor.a),
    b.out.to(add.b, xor.b),
    gnd.out.to(add.carry_in),
    add.sum.to(sum.in),
    xor.out.to(xor_out.in),
  ],
});

export const RotateDemo = circuit('RotateDemo', {
  nodes: { val: Input, rot16: RotateLeft16, disp16: HexDisplay, rot7: RotateLeft7, disp7: HexDisplay },
  nodeArgs: { val: { value: 1, width: 32 }, disp16: { width: 32 }, disp7: { width: 32 } },
  connect: ({ nodes: { val, rot16, disp16, rot7, disp7 } }) => [
    val.out.to(rot16.x, rot7.x),
    rot16.out.to(disp16.in),
    rot7.out.to(disp7.in),
  ],
});

export const ARXStep = circuit('ARXStep', {
  nodes: { a: Input, b: Input, d: Input, gnd: Constant, add: Adder, xor: BusXor, rot: RotateLeft16, disp_a: HexDisplay, disp_d: HexDisplay },
  nodeArgs: { a: { value: 100, width: 32 }, b: { value: 42, width: 32 }, d: { value: 255, width: 32 }, gnd: { value: 0 }, add: { width: 32 }, xor: { width: 32 }, disp_a: { width: 32 }, disp_d: { width: 32 } },
  connect: ({ nodes: { a, b, d, gnd, add, xor, rot, disp_a, disp_d } }) => [
    a.out.to(add.a),
    b.out.to(add.b),
    gnd.out.to(add.carry_in),
    d.out.to(xor.a),
    add.sum.to(xor.b, disp_a.in),
    xor.out.to(rot.x),
    rot.out.to(disp_d.in),
  ],
});

export const ChaCha20Demo = circuit('ChaCha20Demo', {
  nodes: { in_a: Input, in_b: Input, in_c: Input, in_d: Input, qr: ChaCha20QuarterRound, out_a: HexDisplay, out_b: HexDisplay, out_c: HexDisplay, out_d: HexDisplay },
  nodeArgs: { in_a: { value: 0x11111111, width: 32 }, in_b: { value: 0x01020304, width: 32 }, in_c: { value: 0x9b8d6f43, width: 32 }, in_d: { value: 0x01234567, width: 32 }, out_a: { width: 32 }, out_b: { width: 32 }, out_c: { width: 32 }, out_d: { width: 32 } },
  connect: ({ nodes: { in_a, in_b, in_c, in_d, qr, out_a, out_b, out_c, out_d } }) => [
    in_a.out.to(qr.a),
    in_b.out.to(qr.b),
    in_c.out.to(qr.c),
    in_d.out.to(qr.d),
    qr.a_out.to(out_a.in),
    qr.b_out.to(out_b.in),
    qr.c_out.to(out_c.in),
    qr.d_out.to(out_d.in),
  ],
});

export const CHACHA20_CIRCUITS: Record<string, BlogCircuit> = {
  arxDemo: {
    name: "The Three Operations: ADD, XOR, ROTL",
    description:
      "The entire ChaCha20 cipher is built from just these three operations on 32-bit words. Try changing a and b.",
    circuit: ARXDemo,
  },

  rotateDemo: {
    name: "Rotation: The Free Operation",
    description:
      "Left rotation rearranges bits with zero gate delay. In silicon, it's just rewiring.",
    circuit: RotateDemo,
  },

  arxStep: {
    name: "One ARX Step: ADD, XOR, Rotate",
    description:
      "Each of the 4 steps in a quarter-round chains ADD -> XOR -> ROTL.",
    circuit: ARXStep,
  },

  quarterRound: {
    name: "ChaCha20 Quarter-Round",
    description:
      "The complete quarter-round -- 4 chained ARX steps. Verified against RFC 7539 test vector.",
    circuit: ChaCha20Demo,
  },
};
