/**
 * Circuit definitions for the "ChaCha20 in Hardware" blog post.
 *
 * Builds from the three ARX primitives (ADD, XOR, ROTL) up to the
 * full quarter-round that powers TLS encryption across the internet.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

// Shared rotation sub-circuits used by the quarter-round and step demos
const ROTATE_CIRCUITS = `
const RotateLeft16 = component('RotateLeft16')
  .in('x', bus(32))
  .out('out', bus(32))
  .node('sh_left', LeftShifter, { width: 32 })
  .node('sh_right', RightShifter, { width: 32 })
  .node('c16', Constant, { value: 16, width: 32 })
  .node('combine', BusOr, { width: 32 })
  .connect(({ in: inp, out, sh_left, sh_right, c16, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c16.out.to(sh_left.shift, sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ])
  .build()

const RotateLeft12 = component('RotateLeft12')
  .in('x', bus(32))
  .out('out', bus(32))
  .node('sh_left', LeftShifter, { width: 32 })
  .node('sh_right', RightShifter, { width: 32 })
  .node('c12', Constant, { value: 12, width: 32 })
  .node('c20', Constant, { value: 20, width: 32 })
  .node('combine', BusOr, { width: 32 })
  .connect(({ in: inp, out, sh_left, sh_right, c12, c20, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c12.out.to(sh_left.shift),
    c20.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ])
  .build()

const RotateLeft8 = component('RotateLeft8')
  .in('x', bus(32))
  .out('out', bus(32))
  .node('sh_left', LeftShifter, { width: 32 })
  .node('sh_right', RightShifter, { width: 32 })
  .node('c8', Constant, { value: 8, width: 32 })
  .node('c24', Constant, { value: 24, width: 32 })
  .node('combine', BusOr, { width: 32 })
  .connect(({ in: inp, out, sh_left, sh_right, c8, c24, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c8.out.to(sh_left.shift),
    c24.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ])
  .build()

const RotateLeft7 = component('RotateLeft7')
  .in('x', bus(32))
  .out('out', bus(32))
  .node('sh_left', LeftShifter, { width: 32 })
  .node('sh_right', RightShifter, { width: 32 })
  .node('c7', Constant, { value: 7, width: 32 })
  .node('c25', Constant, { value: 25, width: 32 })
  .node('combine', BusOr, { width: 32 })
  .connect(({ in: inp, out, sh_left, sh_right, c7, c25, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c7.out.to(sh_left.shift),
    c25.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ])
  .build()
`;

const QUARTER_ROUND_CIRCUIT = `
const ChaCha20QuarterRound = component('ChaCha20QuarterRound')
  .in('a', bus(32))
  .in('b', bus(32))
  .in('c', bus(32))
  .in('d', bus(32))
  .out('a_out', bus(32))
  .out('b_out', bus(32))
  .out('c_out', bus(32))
  .out('d_out', bus(32))
  .node('gnd', Constant, { value: 0 })
  .node('add1', Adder, { width: 32 })
  .node('xor1', BusXor, { width: 32 })
  .node('rot16', RotateLeft16)
  .node('add2', Adder, { width: 32 })
  .node('xor2', BusXor, { width: 32 })
  .node('rot12', RotateLeft12)
  .node('add3', Adder, { width: 32 })
  .node('xor3', BusXor, { width: 32 })
  .node('rot8', RotateLeft8)
  .node('add4', Adder, { width: 32 })
  .node('xor4', BusXor, { width: 32 })
  .node('rot7', RotateLeft7)
  .connect(({ in: inp, out, gnd, add1, xor1, rot16, add2, xor2, rot12, add3, xor3, rot8, add4, xor4, rot7 }) => [
    inp.a.to(add1.a),
    inp.b.to(add1.b, xor2.a),
    gnd.out.to(add1.carry_in, add2.carry_in, add3.carry_in, add4.carry_in),
    inp.d.to(xor1.a),
    add1.sum.to(xor1.b, add3.a),
    xor1.out.to(rot16.x),
    inp.c.to(add2.a),
    rot16.out.to(add2.b, xor3.a),
    add2.sum.to(xor2.b, add4.a),
    xor2.out.to(rot12.x),
    rot12.out.to(add3.b, xor4.a),
    add3.sum.to(xor3.b, out.a_out),
    xor3.out.to(rot8.x),
    rot8.out.to(add4.b, out.d_out),
    add4.sum.to(xor4.b, out.c_out),
    xor4.out.to(rot7.x),
    rot7.out.to(out.b_out),
  ])
  .build()
`;

export const CHACHA20_CIRCUITS: Record<string, BlogCircuit> = {
  // Demo 1: The three ARX operations side by side
  arxDemo: {
    name: "The Three Operations: ADD, XOR, ROTL",
    description:
      "The entire ChaCha20 cipher is built from just these three operations on 32-bit words. Try changing a and b.",
    displayDsl: `
const ARXDemo = component('ARXDemo')
  .node('a', Input, { value: 100, width: 32 })
  .node('b', Input, { value: 42, width: 32 })
  .node('gnd', Constant, { value: 0 })
  .node('add', Adder, { width: 32 })
  .node('sum', HexDisplay, { width: 32 })
  .node('xor', BusXor, { width: 32 })
  .node('xor_out', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, a, b, gnd, add, sum, xor, xor_out }) => [
    a.out.to(add.a, xor.a),
    b.out.to(add.b, xor.b),
    gnd.out.to(add.carry_in),
    add.sum.to(sum.in),
    xor.out.to(xor_out.in),
  ])
  .build()
`,
    dsl: `
const ARXDemo = component('ARXDemo')
  .node('a', Input, { value: 100, width: 32 })
  .node('b', Input, { value: 42, width: 32 })
  .node('gnd', Constant, { value: 0 })
  .node('add', Adder, { width: 32 })
  .node('sum', HexDisplay, { width: 32 })
  .node('xor', BusXor, { width: 32 })
  .node('xor_out', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, a, b, gnd, add, sum, xor, xor_out }) => [
    a.out.to(add.a, xor.a),
    b.out.to(add.b, xor.b),
    gnd.out.to(add.carry_in),
    add.sum.to(sum.in),
    xor.out.to(xor_out.in),
  ])
  .build()
`,
  },

  // Demo 2: Rotation — the "free" operation
  rotateDemo: {
    name: "Rotation: The Free Operation",
    description:
      "Left rotation rearranges bits with zero gate delay. In silicon, it's just rewiring.",
    displayDsl: `
const RotateDemo = component('RotateDemo')
  .node('val', Input, { value: 1, width: 32 })
  .node('rot16', RotateLeft16)
  .node('disp16', HexDisplay, { width: 32 })
  .node('rot7', RotateLeft7)
  .node('disp7', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, val, rot16, disp16, rot7, disp7 }) => [
    val.out.to(rot16.x, rot7.x),
    rot16.out.to(disp16.in),
    rot7.out.to(disp7.in),
  ])
  .build()
`,
    dsl: `${ROTATE_CIRCUITS}
const RotateDemo = component('RotateDemo')
  .node('val', Input, { value: 1, width: 32 })
  .node('rot16', RotateLeft16)
  .node('disp16', HexDisplay, { width: 32 })
  .node('rot7', RotateLeft7)
  .node('disp7', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, val, rot16, disp16, rot7, disp7 }) => [
    val.out.to(rot16.x, rot7.x),
    rot16.out.to(disp16.in),
    rot7.out.to(disp7.in),
  ])
  .build()
`,
  },

  // Demo 3: One ARX step (a += b; d ^= a; d <<<= 16)
  arxStep: {
    name: "One ARX Step: ADD, XOR, Rotate",
    description:
      "Each of the 4 steps in a quarter-round chains ADD → XOR → ROTL.",
    displayDsl: `
const ARXStep = component('ARXStep')
  .node('a', Input, { value: 100, width: 32 })
  .node('b', Input, { value: 42, width: 32 })
  .node('d', Input, { value: 255, width: 32 })
  .node('gnd', Constant, { value: 0 })
  .node('add', Adder, { width: 32 })
  .node('xor', BusXor, { width: 32 })
  .node('rot', RotateLeft16)
  .node('disp_a', HexDisplay, { width: 32 })
  .node('disp_d', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, a, b, d, gnd, add, xor, rot, disp_a, disp_d }) => [
    a.out.to(add.a),
    b.out.to(add.b),
    gnd.out.to(add.carry_in),
    d.out.to(xor.a),
    add.sum.to(xor.b, disp_a.in),
    xor.out.to(rot.x),
    rot.out.to(disp_d.in),
  ])
  .build()
`,
    dsl: `${ROTATE_CIRCUITS}
const ARXStep = component('ARXStep')
  .node('a', Input, { value: 100, width: 32 })
  .node('b', Input, { value: 42, width: 32 })
  .node('d', Input, { value: 255, width: 32 })
  .node('gnd', Constant, { value: 0 })
  .node('add', Adder, { width: 32 })
  .node('xor', BusXor, { width: 32 })
  .node('rot', RotateLeft16)
  .node('disp_a', HexDisplay, { width: 32 })
  .node('disp_d', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, a, b, d, gnd, add, xor, rot, disp_a, disp_d }) => [
    a.out.to(add.a),
    b.out.to(add.b),
    gnd.out.to(add.carry_in),
    d.out.to(xor.a),
    add.sum.to(xor.b, disp_a.in),
    xor.out.to(rot.x),
    rot.out.to(disp_d.in),
  ])
  .build()
`,
  },

  // Demo 4: The full quarter-round with RFC test vector
  quarterRound: {
    name: "ChaCha20 Quarter-Round",
    description:
      "The complete quarter-round — 4 chained ARX steps. Verified against RFC 7539 test vector.",
    displayDsl: `// RFC 7539 test vector:
//   In:  a=0x11111111  b=0x01020304
//        c=0x9b8d6f43  d=0x01234567
//   Out: a=0xea2a92f4  b=0xcb1cf8ce
//        c=0x4581472e  d=0x5881c4bb

const ChaCha20Demo = component('ChaCha20Demo')
  .node('in_a', Input, { value: 0x11111111, width: 32 })
  .node('in_b', Input, { value: 0x01020304, width: 32 })
  .node('in_c', Input, { value: 0x9b8d6f43, width: 32 })
  .node('in_d', Input, { value: 0x01234567, width: 32 })
  .node('qr', ChaCha20QuarterRound)
  .node('out_a', HexDisplay, { width: 32 })
  .node('out_b', HexDisplay, { width: 32 })
  .node('out_c', HexDisplay, { width: 32 })
  .node('out_d', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, in_a, in_b, in_c, in_d, qr, out_a, out_b, out_c, out_d }) => [
    in_a.out.to(qr.a),
    in_b.out.to(qr.b),
    in_c.out.to(qr.c),
    in_d.out.to(qr.d),
    qr.a_out.to(out_a.in),
    qr.b_out.to(out_b.in),
    qr.c_out.to(out_c.in),
    qr.d_out.to(out_d.in),
  ])
  .build()
`,
    dsl: `${ROTATE_CIRCUITS}
${QUARTER_ROUND_CIRCUIT}

const ChaCha20Demo = component('ChaCha20Demo')
  .node('in_a', Input, { value: 0x11111111, width: 32 })
  .node('in_b', Input, { value: 0x01020304, width: 32 })
  .node('in_c', Input, { value: 0x9b8d6f43, width: 32 })
  .node('in_d', Input, { value: 0x01234567, width: 32 })
  .node('qr', ChaCha20QuarterRound)
  .node('out_a', HexDisplay, { width: 32 })
  .node('out_b', HexDisplay, { width: 32 })
  .node('out_c', HexDisplay, { width: 32 })
  .node('out_d', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, in_a, in_b, in_c, in_d, qr, out_a, out_b, out_c, out_d }) => [
    in_a.out.to(qr.a),
    in_b.out.to(qr.b),
    in_c.out.to(qr.c),
    in_d.out.to(qr.d),
    qr.a_out.to(out_a.in),
    qr.b_out.to(out_b.in),
    qr.c_out.to(out_c.in),
    qr.d_out.to(out_d.in),
  ])
  .build()
`,
  },
};
