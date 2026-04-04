// Auto-generated from DSL

const RotateLeft16 = component('RotateLeft16', {
  in: { x: bus(32) },
  out: { out: bus(32) },
  meta: { description: "32-bit left rotation by 16 bits" },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c16: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c16: { value: 16, width: 32 }, combine: { width: 32 } },
  connect: ({ in: inp, out, sh_left, sh_right, c16, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c16.out.to(sh_left.shift, sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ],
})

const RotateLeft12 = component('RotateLeft12', {
  in: { x: bus(32) },
  out: { out: bus(32) },
  meta: { description: "32-bit left rotation by 12 bits" },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c12: Constant, c20: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c12: { value: 12, width: 32 }, c20: { value: 20, width: 32 }, combine: { width: 32 } },
  connect: ({ in: inp, out, sh_left, sh_right, c12, c20, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c12.out.to(sh_left.shift),
    c20.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ],
})

const RotateLeft8 = component('RotateLeft8', {
  in: { x: bus(32) },
  out: { out: bus(32) },
  meta: { description: "32-bit left rotation by 8 bits" },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c8: Constant, c24: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c8: { value: 8, width: 32 }, c24: { value: 24, width: 32 }, combine: { width: 32 } },
  connect: ({ in: inp, out, sh_left, sh_right, c8, c24, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c8.out.to(sh_left.shift),
    c24.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ],
})

const RotateLeft7 = component('RotateLeft7', {
  in: { x: bus(32) },
  out: { out: bus(32) },
  meta: { description: "32-bit left rotation by 7 bits" },
  nodes: { sh_left: LeftShifter, sh_right: RightShifter, c7: Constant, c25: Constant, combine: BusOr },
  nodeArgs: { sh_left: { width: 32 }, sh_right: { width: 32 }, c7: { value: 7, width: 32 }, c25: { value: 25, width: 32 }, combine: { width: 32 } },
  connect: ({ in: inp, out, sh_left, sh_right, c7, c25, combine }) => [
    inp.x.to(sh_left.value, sh_right.value),
    c7.out.to(sh_left.shift),
    c25.out.to(sh_right.shift),
    sh_left.result.to(combine.a),
    sh_right.result.to(combine.b),
    combine.out.to(out.out),
  ],
})

const ChaCha20QuarterRound = component('ChaCha20QuarterRound', {
  in: { a: bus(32), b: bus(32), c: bus(32), d: bus(32) },
  out: { a_out: bus(32), b_out: bus(32), c_out: bus(32), d_out: bus(32) },
  meta: { description: "ChaCha20 quarter-round: 4 ARX steps on 32-bit words (ADD, XOR, ROTL)" },
  nodes: { gnd: Constant, add1: Adder, xor1: BusXor, rot16: RotateLeft16, add2: Adder, xor2: BusXor, rot12: RotateLeft12, add3: Adder, xor3: BusXor, rot8: RotateLeft8, add4: Adder, xor4: BusXor, rot7: RotateLeft7 },
  nodeArgs: { gnd: { value: 0 }, add1: { width: 32 }, xor1: { width: 32 }, add2: { width: 32 }, xor2: { width: 32 }, add3: { width: 32 }, xor3: { width: 32 }, add4: { width: 32 }, xor4: { width: 32 } },
  connect: ({ in: inp, out, gnd, add1, xor1, rot16, add2, xor2, rot12, add3, xor3, rot8, add4, xor4, rot7 }) => [
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
  ],
})

const ChaCha20Demo = component('ChaCha20Demo', {
  meta: { description: "Interactive ChaCha20 quarter-round — RFC 7539 test vector, live hex display" },
  nodes: { in_a: Input, in_b: Input, in_c: Input, in_d: Input, qr: ChaCha20QuarterRound, disp_in_a: HexDisplay, disp_in_b: HexDisplay, disp_in_c: HexDisplay, disp_in_d: HexDisplay, disp_out_a: HexDisplay, disp_out_b: HexDisplay, disp_out_c: HexDisplay, disp_out_d: HexDisplay },
  nodeArgs: { in_a: { value: 286331153, width: 32 }, in_b: { value: 16909060, width: 32 }, in_c: { value: 2609737539, width: 32 }, in_d: { value: 19088743, width: 32 }, disp_in_a: { width: 32 }, disp_in_b: { width: 32 }, disp_in_c: { width: 32 }, disp_in_d: { width: 32 }, disp_out_a: { width: 32 }, disp_out_b: { width: 32 }, disp_out_c: { width: 32 }, disp_out_d: { width: 32 } },
  connect: ({ in: inp, out, in_a, in_b, in_c, in_d, qr, disp_in_a, disp_in_b, disp_in_c, disp_in_d, disp_out_a, disp_out_b, disp_out_c, disp_out_d }) => [
    in_a.out.to(qr.a, disp_in_a.in),
    in_b.out.to(qr.b, disp_in_b.in),
    in_c.out.to(qr.c, disp_in_c.in),
    in_d.out.to(qr.d, disp_in_d.in),
    qr.a_out.to(disp_out_a.in),
    qr.b_out.to(disp_out_b.in),
    qr.c_out.to(disp_out_c.in),
    qr.d_out.to(disp_out_d.in),
  ],
})
