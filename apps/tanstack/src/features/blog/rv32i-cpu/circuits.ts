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
    displayDsl: `circuit ProgramCounter {
  input stall: Bit
  output pc_out: Bus[32]
  impl {
    node pc: Register(width=32)
    node four: Constant(value=4, width=32)
    node adder: Adder(width=32)
    node stall_inv: Not
    connect pc.q -> adder.a
    connect four.out -> adder.b
    connect adder.sum -> pc.data
    connect stall -> stall_inv.in
    connect stall_inv.out -> pc.we
    connect pc.q -> pc_out
  }
}`,
    dsl: `circuit ProgramCounter {
  input stall: Bit
  output pc_out: Bus[32]
  impl {
    node pc: Register(width=32)
    node four: Constant(value=4, width=32)
    node adder: Adder(width=32)
    node stall_inv: Not
    connect pc.q -> adder.a
    connect four.out -> adder.b
    connect adder.sum -> pc.data
    connect stall -> stall_inv.in
    connect stall_inv.out -> pc.we
    connect pc.q -> pc_out
  }
}

circuit DemoProgramCounter {
  impl {
    node sw_stall: Switch
    node pc: ProgramCounter
    node led: Output(width=32)
    connect sw_stall.out -> pc.stall
    connect pc.pc_out -> led.in
  }
}`,
  },

  pipelineRegister: {
    name: "Pipeline Register",
    description:
      "A register between pipeline stages. It latches data on each clock edge so each stage works on a different instruction.",
    displayDsl: `circuit PipelineReg {
  input data_in: Bus[32]
  input flush: Bit
  output data_out: Bus[32]
  impl {
    node zero: Constant(value=0, width=32)
    node mux: Mux(width=32)
    node reg: Register(width=32)
    node one: Constant(value=1, width=1)
    connect data_in -> mux.in0
    connect zero.out -> mux.in1
    connect flush -> mux.sel
    connect mux.out -> reg.data
    connect one.out -> reg.we
    connect reg.q -> data_out
  }
}`,
    dsl: `circuit PipelineReg {
  input data_in: Bus[32]
  input flush: Bit
  output data_out: Bus[32]
  impl {
    node zero: Constant(value=0, width=32)
    node mux: Mux(width=32)
    node reg: Register(width=32)
    node one: Constant(value=1, width=1)
    connect data_in -> mux.in0
    connect zero.out -> mux.in1
    connect flush -> mux.sel
    connect mux.out -> reg.data
    connect one.out -> reg.we
    connect reg.q -> data_out
  }
}

circuit DemoPipelineReg {
  impl {
    node input_val: Input(width=32)
    node sw_flush: Switch
    node pipe: PipelineReg
    node led: Output(width=32)
    connect input_val.out -> pipe.data_in
    connect sw_flush.out -> pipe.flush
    connect pipe.data_out -> led.in
  }
}`,
  },

  forwardingMux: {
    name: "Forwarding Mux",
    description:
      "When a later instruction needs a result that hasn't been written back yet, the forwarding mux bypasses the register file.",
    displayDsl: `circuit ForwardingMux {
  input reg_val: Bus[32]
  input ex_val: Bus[32]
  input mem_val: Bus[32]
  input sel: Bus[2]
  output out: Bus[32]
  impl {
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node mux1: Mux(width=32)
    node mux2: Mux(width=32)
    connect sel -> bit0.in
    connect sel -> bit1.in
    connect reg_val -> mux1.in0
    connect ex_val -> mux1.in1
    connect bit0.out -> mux1.sel
    connect mux1.out -> mux2.in0
    connect mem_val -> mux2.in1
    connect bit1.out -> mux2.sel
    connect mux2.out -> out
  }
}`,
    dsl: `circuit ForwardingMux {
  input reg_val: Bus[32]
  input ex_val: Bus[32]
  input mem_val: Bus[32]
  input sel: Bus[2]
  output out: Bus[32]
  impl {
    node bit0: BitSlice(low=0, high=0)
    node bit1: BitSlice(low=1, high=1)
    node mux1: Mux(width=32)
    node mux2: Mux(width=32)
    connect sel -> bit0.in
    connect sel -> bit1.in
    connect reg_val -> mux1.in0
    connect ex_val -> mux1.in1
    connect bit0.out -> mux1.sel
    connect mux1.out -> mux2.in0
    connect mem_val -> mux2.in1
    connect bit1.out -> mux2.sel
    connect mux2.out -> out
  }
}

circuit DemoForwardingMux {
  impl {
    node reg: Input(width=32)
    node ex: Input(width=32)
    node mem: Input(width=32)
    node sel: Input(width=2)
    node fwd: ForwardingMux
    node led: Output(width=32)
    connect reg.out -> fwd.reg_val
    connect ex.out -> fwd.ex_val
    connect mem.out -> fwd.mem_val
    connect sel.out -> fwd.sel
    connect fwd.out -> led.in
  }
}`,
  },

  aluSlice: {
    name: "ALU",
    description:
      "The arithmetic logic unit. It performs addition, subtraction, shifts, and comparisons based on a 4-bit control signal.",
    displayDsl: `circuit SimpleALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[2]
  output result: Bus[8]
  impl {
    node adder: Adder(width=8)
    node sub: Subtractor(width=8)
    node and_gate: BusAnd(width=8)
    node or_gate: BusOr(width=8)
    node mux_lo: Mux(width=8)
    node mux_hi: Mux(width=8)
    node op0: BitSlice(low=0, high=0)
    node op1: BitSlice(low=1, high=1)
    connect a -> adder.a
    connect b -> adder.b
    connect a -> sub.a
    connect b -> sub.b
    connect a -> and_gate.a
    connect b -> and_gate.b
    connect a -> or_gate.a
    connect b -> or_gate.b
    connect op -> op0.in
    connect op -> op1.in
    connect adder.sum -> mux_lo.in0
    connect sub.difference -> mux_lo.in1
    connect op0.out -> mux_lo.sel
    connect and_gate.out -> mux_hi.in0
    connect or_gate.out -> mux_hi.in1
    connect op0.out -> mux_hi.sel
    node mux_final: Mux(width=8)
    connect mux_lo.out -> mux_final.in0
    connect mux_hi.out -> mux_final.in1
    connect op1.out -> mux_final.sel
    connect mux_final.out -> result
  }
}`,
    dsl: `circuit SimpleALU {
  input a: Bus[8]
  input b: Bus[8]
  input op: Bus[2]
  output result: Bus[8]
  impl {
    node adder: Adder(width=8)
    node sub: Subtractor(width=8)
    node and_gate: BusAnd(width=8)
    node or_gate: BusOr(width=8)
    node mux_lo: Mux(width=8)
    node mux_hi: Mux(width=8)
    node op0: BitSlice(low=0, high=0)
    node op1: BitSlice(low=1, high=1)
    connect a -> adder.a
    connect b -> adder.b
    connect a -> sub.a
    connect b -> sub.b
    connect a -> and_gate.a
    connect b -> and_gate.b
    connect a -> or_gate.a
    connect b -> or_gate.b
    connect op -> op0.in
    connect op -> op1.in
    connect adder.sum -> mux_lo.in0
    connect sub.difference -> mux_lo.in1
    connect op0.out -> mux_lo.sel
    connect and_gate.out -> mux_hi.in0
    connect or_gate.out -> mux_hi.in1
    connect op0.out -> mux_hi.sel
    node mux_final: Mux(width=8)
    connect mux_lo.out -> mux_final.in0
    connect mux_hi.out -> mux_final.in1
    connect op1.out -> mux_final.sel
    connect mux_final.out -> result
  }
}

circuit DemoALU {
  impl {
    node a: Input(width=8)
    node b: Input(width=8)
    node op: Input(width=2)
    node alu: SimpleALU
    node led: Output(width=8)
    connect a.out -> alu.a
    connect b.out -> alu.b
    connect op.out -> alu.op
    connect alu.result -> led.in
  }
}`,
  },
};
