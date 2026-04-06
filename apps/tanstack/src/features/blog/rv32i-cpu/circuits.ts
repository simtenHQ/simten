/**
 * Circuit definitions for the "RISC-V CPU" blog post.
 *
 * Small, focused circuits that illustrate individual pipeline concepts.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayCode: string;
  dsl: string;
}

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  programCounter: {
    name: "Program Counter",
    description:
      "A register that holds the current instruction address, incrementing by 4 each cycle.",
    displayCode: `
const ProgramCounter = circuit('ProgramCounter', {
  in: { stall: bit },
  out: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 } },
  connect: ({ in: inp, out, pc, four, adder, stall_inv }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
  ],
})
`,
    dsl: `
const ProgramCounter = circuit('ProgramCounter', {
  in: { stall: bit },
  out: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 } },
  connect: ({ in: inp, out, pc, four, adder, stall_inv }) => [
    pc.q.to(adder.a, out.pc_out),
    four.out.to(adder.b),
    adder.sum.to(pc.data),
    inp.stall.to(stall_inv.in),
    stall_inv.out.to(pc.we),
  ],
})

const DemoProgramCounter = circuit('DemoProgramCounter', {
  nodes: { stall: Switch, pc: ProgramCounter, address: HexDisplay },
  nodeArgs: { address: { width: 32 } },
  connect: ({ in: inp, out, stall, pc, address }) => [
    stall.out.to(pc.stall),
    pc.pc_out.to(address.in),
  ],
})
`,
  },

  pcWithMux: {
    name: "PC with Next-PC Mux",
    description:
      "The full program counter with a mux selecting between PC+4, branch target, and jump target. Stall freezes the PC.",
    displayCode: `
const PCWithMux = circuit('PCWithMux', {
  in: { stall: bit, branch_taken: bit, jump: bit, branch_target: bus(32), jump_target: bus(32) },
  out: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not, branch_mux: Mux, jump_mux: Mux },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 }, branch_mux: { width: 32 }, jump_mux: { width: 32 } },
  connect: ({ in: inp, out, pc, four, adder, stall_inv, branch_mux, jump_mux }) => [
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
  ],
})
`,
    dsl: `
const PCWithMux = circuit('PCWithMux', {
  in: { stall: bit, branch_taken: bit, jump: bit, branch_target: bus(32), jump_target: bus(32) },
  out: { pc_out: bus(32) },
  nodes: { pc: Register, four: Constant, adder: Adder, stall_inv: Not, branch_mux: Mux, jump_mux: Mux },
  nodeArgs: { pc: { width: 32 }, four: { value: 4, width: 32 }, adder: { width: 32 }, branch_mux: { width: 32 }, jump_mux: { width: 32 } },
  connect: ({ in: inp, out, pc, four, adder, stall_inv, branch_mux, jump_mux }) => [
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
  ],
})

const DemoPCWithMux = circuit('DemoPCWithMux', {
  nodes: { stall_sw: Switch, branch_sw: Switch, jump_sw: Switch, branch_addr: Input, jump_addr: Input, pc: PCWithMux, address: HexDisplay },
  nodeArgs: { branch_addr: { value: 256 }, jump_addr: { value: 1024 }, address: { width: 32 } },
  connect: ({ in: inp, out, stall_sw, branch_sw, jump_sw, branch_addr, jump_addr, pc, address }) => [
    stall_sw.out.to(pc.stall),
    branch_sw.out.to(pc.branch_taken),
    jump_sw.out.to(pc.jump),
    branch_addr.out.to(pc.branch_target),
    jump_addr.out.to(pc.jump_target),
    pc.pc_out.to(address.in),
  ],
})
`,
  },

  pipelineRegister: {
    name: "Pipeline Register",
    description:
      "A register between pipeline stages. It latches data on each clock edge so each stage works on a different instruction.",
    displayCode: `
const PipelineReg = circuit('PipelineReg', {
  in: { data_in: bus(8), flush: bit },
  out: { data_out: bus(8) },
  nodes: { zero: Constant, mux: Mux, reg: Register, one: Constant },
  nodeArgs: { zero: { value: 0, width: 8 }, mux: { width: 8 }, reg: { width: 8 }, one: { value: 1, width: 1 } },
  connect: ({ in: inp, out, zero, mux, reg, one }) => [
    inp.data_in.to(mux.in0),
    zero.out.to(mux.in1),
    inp.flush.to(mux.sel),
    mux.out.to(reg.data),
    one.out.to(reg.we),
    reg.q.to(out.data_out),
  ],
})
`,
    dsl: `
const PipelineReg = circuit('PipelineReg', {
  in: { data_in: bus(8), flush: bit },
  out: { data_out: bus(8) },
  nodes: { zero: Constant, mux: Mux, reg: Register, one: Constant },
  nodeArgs: { zero: { value: 0, width: 8 }, mux: { width: 8 }, reg: { width: 8 }, one: { value: 1, width: 1 } },
  connect: ({ in: inp, out, zero, mux, reg, one }) => [
    inp.data_in.to(mux.in0),
    zero.out.to(mux.in1),
    inp.flush.to(mux.sel),
    mux.out.to(reg.data),
    one.out.to(reg.we),
    reg.q.to(out.data_out),
  ],
})

const DemoPipelineReg = circuit('DemoPipelineReg', {
  nodes: { data: Input, flush: Switch, pipe: PipelineReg, result: HexDisplay },
  nodeArgs: { data: { width: 8 }, result: { width: 8 } },
  connect: ({ in: inp, out, data, flush, pipe, result }) => [
    data.out.to(pipe.data_in),
    flush.out.to(pipe.flush),
    pipe.data_out.to(result.in),
  ],
})
`,
  },

  forwardingMux: {
    name: "Forwarding Mux",
    description:
      "When a later instruction needs a result that hasn't been written back yet, the forwarding mux bypasses the register file.",
    displayCode: `
const ForwardingMux = circuit('ForwardingMux', {
  in: { reg_val: bus(32), ex_val: bus(32), mem_val: bus(32), sel: bus(2) },
  out: { out: bus(32) },
  nodes: { bit0: BitSlice, bit1: BitSlice, mux1: Mux, mux2: Mux },
  nodeArgs: { bit0: { low: 0, high: 0 }, bit1: { low: 1, high: 1 }, mux1: { width: 32 }, mux2: { width: 32 } },
  connect: ({ in: inp, out, bit0, bit1, mux1, mux2 }) => [
    inp.sel.to(bit0.in, bit1.in),
    inp.reg_val.to(mux1.in0),
    inp.ex_val.to(mux1.in1),
    bit0.out.to(mux1.sel),
    mux1.out.to(mux2.in0),
    inp.mem_val.to(mux2.in1),
    bit1.out.to(mux2.sel),
    mux2.out.to(out.out),
  ],
})
`,
    dsl: `
const ForwardingMux = circuit('ForwardingMux', {
  in: { reg_val: bus(32), ex_val: bus(32), mem_val: bus(32), sel: bus(2) },
  out: { out: bus(32) },
  nodes: { bit0: BitSlice, bit1: BitSlice, mux1: Mux, mux2: Mux },
  nodeArgs: { bit0: { low: 0, high: 0 }, bit1: { low: 1, high: 1 }, mux1: { width: 32 }, mux2: { width: 32 } },
  connect: ({ in: inp, out, bit0, bit1, mux1, mux2 }) => [
    inp.sel.to(bit0.in, bit1.in),
    inp.reg_val.to(mux1.in0),
    inp.ex_val.to(mux1.in1),
    bit0.out.to(mux1.sel),
    mux1.out.to(mux2.in0),
    inp.mem_val.to(mux2.in1),
    bit1.out.to(mux2.sel),
    mux2.out.to(out.out),
  ],
})

const DemoForwardingMux = circuit('DemoForwardingMux', {
  nodes: { reg_value: Input, ex_value: Input, mem_value: Input, select: Input, fwd: ForwardingMux, result: HexDisplay },
  nodeArgs: { reg_value: { width: 32 }, ex_value: { width: 32 }, mem_value: { width: 32 }, select: { width: 2 }, result: { width: 32 } },
  connect: ({ in: inp, out, reg_value, ex_value, mem_value, select, fwd, result }) => [
    reg_value.out.to(fwd.reg_val),
    ex_value.out.to(fwd.ex_val),
    mem_value.out.to(fwd.mem_val),
    select.out.to(fwd.sel),
    fwd.out.to(result.in),
  ],
})
`,
  },

  aluSlice: {
    name: "ALU",
    description:
      "The arithmetic logic unit. It performs addition, subtraction, shifts, and comparisons based on a 4-bit control signal.",
    displayCode: `
const SimpleALU = circuit('SimpleALU', {
  in: { a: bus(8), b: bus(8), op: bus(2) },
  out: { result: bus(8) },
  nodes: { adder: Adder, sub: Subtractor, and_gate: BusAnd, or_gate: BusOr, mux_lo: Mux, mux_hi: Mux, op0: BitSlice, op1: BitSlice, mux_final: Mux },
  nodeArgs: { adder: { width: 8 }, sub: { width: 8 }, and_gate: { width: 8 }, or_gate: { width: 8 }, mux_lo: { width: 8 }, mux_hi: { width: 8 }, op0: { low: 0, high: 0 }, op1: { low: 1, high: 1 }, mux_final: { width: 8 } },
  connect: ({ in: inp, out, adder, sub, and_gate, or_gate, mux_lo, mux_hi, op0, op1, mux_final }) => [
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
  ],
})
`,
    dsl: `
const SimpleALU = circuit('SimpleALU', {
  in: { a: bus(8), b: bus(8), op: bus(2) },
  out: { result: bus(8) },
  nodes: { adder: Adder, sub: Subtractor, and_gate: BusAnd, or_gate: BusOr, mux_lo: Mux, mux_hi: Mux, op0: BitSlice, op1: BitSlice, mux_final: Mux },
  nodeArgs: { adder: { width: 8 }, sub: { width: 8 }, and_gate: { width: 8 }, or_gate: { width: 8 }, mux_lo: { width: 8 }, mux_hi: { width: 8 }, op0: { low: 0, high: 0 }, op1: { low: 1, high: 1 }, mux_final: { width: 8 } },
  connect: ({ in: inp, out, adder, sub, and_gate, or_gate, mux_lo, mux_hi, op0, op1, mux_final }) => [
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
  ],
})

const DemoALU = circuit('DemoALU', {
  nodes: { a: Input, b: Input, op: Input, alu: SimpleALU, result: HexDisplay },
  nodeArgs: { a: { width: 8 }, b: { width: 8 }, op: { width: 2 }, result: { width: 8 } },
  connect: ({ in: inp, out, a, b, op, alu, result }) => [
    a.out.to(alu.a),
    b.out.to(alu.b),
    op.out.to(alu.op),
    alu.result.to(result.in),
  ],
})
`,
  },
};
