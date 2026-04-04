// Auto-generated from DSL

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

const ChaCha20Demo = component('ChaCha20Demo')
  .node('in_a', Input, { value: 286331153, width: 32 })
  .node('in_b', Input, { value: 16909060, width: 32 })
  .node('in_c', Input, { value: 2609737539, width: 32 })
  .node('in_d', Input, { value: 19088743, width: 32 })
  .node('qr', ChaCha20QuarterRound)
  .node('disp_in_a', HexDisplay, { width: 32 })
  .node('disp_in_b', HexDisplay, { width: 32 })
  .node('disp_in_c', HexDisplay, { width: 32 })
  .node('disp_in_d', HexDisplay, { width: 32 })
  .node('disp_out_a', HexDisplay, { width: 32 })
  .node('disp_out_b', HexDisplay, { width: 32 })
  .node('disp_out_c', HexDisplay, { width: 32 })
  .node('disp_out_d', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, in_a, in_b, in_c, in_d, qr, disp_in_a, disp_in_b, disp_in_c, disp_in_d, disp_out_a, disp_out_b, disp_out_c, disp_out_d }) => [
    in_a.out.to(qr.a, disp_in_a.in),
    in_b.out.to(qr.b, disp_in_b.in),
    in_c.out.to(qr.c, disp_in_c.in),
    in_d.out.to(qr.d, disp_in_d.in),
    qr.a_out.to(disp_out_a.in),
    qr.b_out.to(disp_out_b.in),
    qr.c_out.to(disp_out_c.in),
    qr.d_out.to(disp_out_d.in),
  ])
  .build()
