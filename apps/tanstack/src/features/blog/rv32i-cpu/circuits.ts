/**
 * Circuit definitions for the "RISC-V CPU" blog post.
 *
 * Small, focused circuits that illustrate individual pipeline concepts.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  programCounter: {
    name: "Program Counter",
    description:
      "A register that holds the current instruction address, incrementing by 4 each cycle.",
    displayDsl: `
const ProgramCounter = component('ProgramCounter')
  .in('stall', bit)
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('stall_inv', Not)
  .connect(({ in: inp, out, pc, four, adder, stall_inv }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
  ])
  .build()
`,
    dsl: `
const ProgramCounter = component('ProgramCounter')
  .in('stall', bit)
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('stall_inv', Not)
  .connect(({ in: inp, out, pc, four, adder, stall_inv }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
  ])
  .build()

const DemoProgramCounter = component('DemoProgramCounter')
  .node('stall', Switch)
  .node('pc', ProgramCounter)
  .node('address', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, stall, pc, address }) => [
    stall.out.to(pc.stall),
    pc.pc_out.to(address.in),
  ])
  .build()
`,
  },

  pcWithMux: {
    name: "PC with Next-PC Mux",
    description:
      "The full program counter with a mux selecting between PC+4, branch target, and jump target. Stall freezes the PC.",
    displayDsl: `
const PCWithMux = component('PCWithMux')
  .in('stall', bit)
  .in('branch_taken', bit)
  .in('jump', bit)
  .in('branch_target', bus(32))
  .in('jump_target', bus(32))
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('stall_inv', Not)
  .node('branch_mux', Mux, { width: 32 })
  .node('jump_mux', Mux, { width: 32 })
  .connect(({ in: inp, out, pc, four, adder, stall_inv, branch_mux, jump_mux }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
    adder.sum.to(branch_mux.in0),
    inp.branch_target.to(branch_mux.in1),
    inp.branch_taken.to(branch_mux.sel),
    branch_mux.out.to(jump_mux.in0),
    inp.jump_target.to(jump_mux.in1),
    inp.jump.to(jump_mux.sel),
    jump_mux.out.to(pc.data),
  ])
  .build()
`,
    dsl: `
const PCWithMux = component('PCWithMux')
  .in('stall', bit)
  .in('branch_taken', bit)
  .in('jump', bit)
  .in('branch_target', bus(32))
  .in('jump_target', bus(32))
  .out('pc_out', bus(32))
  .node('pc', Register, { width: 32 })
  .node('four', Constant, { value: 4, width: 32 })
  .node('adder', Adder, { width: 32 })
  .node('stall_inv', Not)
  .node('branch_mux', Mux, { width: 32 })
  .node('jump_mux', Mux, { width: 32 })
  .connect(({ in: inp, out, pc, four, adder, stall_inv, branch_mux, jump_mux }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
    adder.sum.to(branch_mux.in0),
    inp.branch_target.to(branch_mux.in1),
    inp.branch_taken.to(branch_mux.sel),
    branch_mux.out.to(jump_mux.in0),
    inp.jump_target.to(jump_mux.in1),
    inp.jump.to(jump_mux.sel),
    jump_mux.out.to(pc.data),
  ])
  .build()

const DemoPCWithMux = component('DemoPCWithMux')
  .node('stall_sw', Switch)
  .node('branch_sw', Switch)
  .node('jump_sw', Switch)
  .node('branch_addr', Input, { value: 256 })
  .node('jump_addr', Input, { value: 1024 })
  .node('pc', PCWithMux)
  .node('address', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, stall_sw, branch_sw, jump_sw, branch_addr, jump_addr, pc, address }) => [
    stall_sw.out.to(pc.stall),
    branch_sw.out.to(pc.branch_taken),
    jump_sw.out.to(pc.jump),
    branch_addr.out.to(pc.branch_target),
    jump_addr.out.to(pc.jump_target),
    pc.pc_out.to(address.in),
  ])
  .build()
`,
  },

  pipelineRegister: {
    name: "Pipeline Register",
    description:
      "A register between pipeline stages. It latches data on each clock edge so each stage works on a different instruction.",
    displayDsl: `
const PipelineReg = component('PipelineReg')
  .in('data_in', bus(8))
  .in('flush', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0, width: 8 })
  .node('mux', Mux, { width: 8 })
  .node('reg', Register, { width: 8 })
  .node('one', Constant, { value: 1, width: 1 })
  .connect(({ in: inp, out, zero, mux, reg, one }) => [
    inp.data_in.to(mux.in0),
    zero.out.to(mux.in1),
    inp.flush.to(mux.sel),
    mux.out.to(reg.data),
    one.out.to(reg.we),
    reg.q.to(out.data_out),
  ])
  .build()
`,
    dsl: `
const PipelineReg = component('PipelineReg')
  .in('data_in', bus(8))
  .in('flush', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0, width: 8 })
  .node('mux', Mux, { width: 8 })
  .node('reg', Register, { width: 8 })
  .node('one', Constant, { value: 1, width: 1 })
  .connect(({ in: inp, out, zero, mux, reg, one }) => [
    inp.data_in.to(mux.in0),
    zero.out.to(mux.in1),
    inp.flush.to(mux.sel),
    mux.out.to(reg.data),
    one.out.to(reg.we),
    reg.q.to(out.data_out),
  ])
  .build()

const DemoPipelineReg = component('DemoPipelineReg')
  .node('data', Input, { width: 8 })
  .node('flush', Switch)
  .node('pipe', PipelineReg)
  .node('result', HexDisplay, { width: 8 })
  .connect(({ in: inp, out, data, flush, pipe, result }) => [
    data.out.to(pipe.data_in),
    flush.out.to(pipe.flush),
    pipe.data_out.to(result.in),
  ])
  .build()
`,
  },

  forwardingMux: {
    name: "Forwarding Mux",
    description:
      "When a later instruction needs a result that hasn't been written back yet, the forwarding mux bypasses the register file.",
    displayDsl: `
const ForwardingMux = component('ForwardingMux')
  .in('reg_val', bus(32))
  .in('ex_val', bus(32))
  .in('mem_val', bus(32))
  .in('sel', bus(2))
  .out('out', bus(32))
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('mux1', Mux, { width: 32 })
  .node('mux2', Mux, { width: 32 })
  .connect(({ in: inp, out, bit0, bit1, mux1, mux2 }) => [
    inp.sel.to(bit0.in, bit1.in),
    inp.reg_val.to(mux1.in0),
    inp.ex_val.to(mux1.in1),
    bit0.out.to(mux1.sel),
    mux1.out.to(mux2.in0),
    inp.mem_val.to(mux2.in1),
    bit1.out.to(mux2.sel),
    mux2.out.to(out.out),
  ])
  .build()
`,
    dsl: `
const ForwardingMux = component('ForwardingMux')
  .in('reg_val', bus(32))
  .in('ex_val', bus(32))
  .in('mem_val', bus(32))
  .in('sel', bus(2))
  .out('out', bus(32))
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('mux1', Mux, { width: 32 })
  .node('mux2', Mux, { width: 32 })
  .connect(({ in: inp, out, bit0, bit1, mux1, mux2 }) => [
    inp.sel.to(bit0.in, bit1.in),
    inp.reg_val.to(mux1.in0),
    inp.ex_val.to(mux1.in1),
    bit0.out.to(mux1.sel),
    mux1.out.to(mux2.in0),
    inp.mem_val.to(mux2.in1),
    bit1.out.to(mux2.sel),
    mux2.out.to(out.out),
  ])
  .build()

const DemoForwardingMux = component('DemoForwardingMux')
  .node('reg_value', Input, { width: 32 })
  .node('ex_value', Input, { width: 32 })
  .node('mem_value', Input, { width: 32 })
  .node('select', Input, { width: 2 })
  .node('fwd', ForwardingMux)
  .node('result', HexDisplay, { width: 32 })
  .connect(({ in: inp, out, reg_value, ex_value, mem_value, select, fwd, result }) => [
    reg_value.out.to(fwd.reg_val),
    ex_value.out.to(fwd.ex_val),
    mem_value.out.to(fwd.mem_val),
    select.out.to(fwd.sel),
    fwd.out.to(result.in),
  ])
  .build()
`,
  },

  aluSlice: {
    name: "ALU",
    description:
      "The arithmetic logic unit. It performs addition, subtraction, shifts, and comparisons based on a 4-bit control signal.",
    displayDsl: `
const SimpleALU = component('SimpleALU')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('op', bus(2))
  .out('result', bus(8))
  .node('adder', Adder, { width: 8 })
  .node('sub', Subtractor, { width: 8 })
  .node('and_gate', BusAnd, { width: 8 })
  .node('or_gate', BusOr, { width: 8 })
  .node('mux_lo', Mux, { width: 8 })
  .node('mux_hi', Mux, { width: 8 })
  .node('op0', BitSlice, { low: 0, high: 0 })
  .node('op1', BitSlice, { low: 1, high: 1 })
  .node('mux_final', Mux, { width: 8 })
  .connect(({ in: inp, out, adder, sub, and_gate, or_gate, mux_lo, mux_hi, op0, op1, mux_final }) => [
    inp.a.to(adder.a, sub.a, and_gate.a, or_gate.a),
    inp.b.to(adder.b, sub.b, and_gate.b, or_gate.b),
    inp.op.to(op0.in, op1.in),
    adder.sum.to(mux_lo.in0),
    sub.difference.to(mux_lo.in1),
    op0.out.to(mux_lo.sel, mux_hi.sel),
    and_gate.out.to(mux_hi.in0),
    or_gate.out.to(mux_hi.in1),
    mux_lo.out.to(mux_final.in0),
    mux_hi.out.to(mux_final.in1),
    op1.out.to(mux_final.sel),
    mux_final.out.to(out.result),
  ])
  .build()
`,
    dsl: `
const SimpleALU = component('SimpleALU')
  .in('a', bus(8))
  .in('b', bus(8))
  .in('op', bus(2))
  .out('result', bus(8))
  .node('adder', Adder, { width: 8 })
  .node('sub', Subtractor, { width: 8 })
  .node('and_gate', BusAnd, { width: 8 })
  .node('or_gate', BusOr, { width: 8 })
  .node('mux_lo', Mux, { width: 8 })
  .node('mux_hi', Mux, { width: 8 })
  .node('op0', BitSlice, { low: 0, high: 0 })
  .node('op1', BitSlice, { low: 1, high: 1 })
  .node('mux_final', Mux, { width: 8 })
  .connect(({ in: inp, out, adder, sub, and_gate, or_gate, mux_lo, mux_hi, op0, op1, mux_final }) => [
    inp.a.to(adder.a, sub.a, and_gate.a, or_gate.a),
    inp.b.to(adder.b, sub.b, and_gate.b, or_gate.b),
    inp.op.to(op0.in, op1.in),
    adder.sum.to(mux_lo.in0),
    sub.difference.to(mux_lo.in1),
    op0.out.to(mux_lo.sel, mux_hi.sel),
    and_gate.out.to(mux_hi.in0),
    or_gate.out.to(mux_hi.in1),
    mux_lo.out.to(mux_final.in0),
    mux_hi.out.to(mux_final.in1),
    op1.out.to(mux_final.sel),
    mux_final.out.to(out.result),
  ])
  .build()

const DemoALU = component('DemoALU')
  .node('a', Input, { width: 8 })
  .node('b', Input, { width: 8 })
  .node('op', Input, { width: 2 })
  .node('alu', SimpleALU)
  .node('result', HexDisplay, { width: 8 })
  .connect(({ in: inp, out, a, b, op, alu, result }) => [
    a.out.to(alu.a),
    b.out.to(alu.b),
    op.out.to(alu.op),
    alu.result.to(result.in),
  ])
  .build()
`,
  },
};
