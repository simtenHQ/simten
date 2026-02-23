/**
 * Circuit definitions for the "Building a CPU" blog post.
 *
 * Reuses basic gates from splash3 and adds sequential circuits
 * (SR Latch, D Flip-Flop, Register, Counter) for the memory sections.
 */

// Re-export gate circuits from splash3
export { CIRCUITS as GATE_CIRCUITS } from "@/app/splash3/circuits";

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const BLOG_CIRCUITS: Record<string, BlogCircuit> = {
  srLatch: {
    name: "SR Latch",
    description:
      "The simplest memory element. Set (S) stores a 1, Reset (R) clears to 0.",
    displayDsl: `circuit SRLatch {
  input s: Bit
  input r: Bit
  output q: Bit
  output q_bar: Bit
  impl {
    node nor1: Nor
    node nor2: Nor
    connect s -> nor1.a
    connect nor2.out -> nor1.b
    connect r -> nor2.a
    connect nor1.out -> nor2.b
    connect nor1.out -> q
    connect nor2.out -> q_bar
  }
}`,
    dsl: `
circuit SRLatch {
  input s: Bit
  input r: Bit
  output q: Bit
  output q_bar: Bit
  impl {
    node nor1: Nor
    node nor2: Nor
    connect s -> nor1.a
    connect nor2.out -> nor1.b
    connect r -> nor2.a
    connect nor1.out -> nor2.b
    connect nor1.out -> q
    connect nor2.out -> q_bar
  }
}

circuit DemoSRLatch {
  impl {
    node sw_s: Switch
    node sw_r: Switch
    node latch: SRLatch
    node led_q: Led
    node led_qbar: Led
    connect sw_s.out -> latch.s
    connect sw_r.out -> latch.r
    connect latch.q -> led_q.in
    connect latch.q_bar -> led_qbar.in
  }
}`,
  },

  dFlipFlop: {
    name: "D Flip-Flop",
    description:
      "Captures the input value on each clock edge. The building block of registers.",
    displayDsl: `circuit DemoFlipFlop {
  clock clk
  impl {
    node sw_d: Switch
    node dff: DFlipFlop
    node led_q: Led
    connect clk -> dff.clk
    connect sw_d.out -> dff.d
    connect dff.q -> led_q.in
  }
}`,
    dsl: `
circuit DemoFlipFlop {
  clock clk
  impl {
    node sw_d: Switch
    node dff: DFlipFlop
    node led_q: Led
    connect clk -> dff.clk
    connect sw_d.out -> dff.d
    connect dff.q -> led_q.in
  }
}`,
  },

  register4bit: {
    name: "4-Bit Register",
    description:
      "Four flip-flops in parallel store a nibble (4 bits) of data.",
    displayDsl: `circuit Reg4 {
  input d0: Bit
  input d1: Bit
  input d2: Bit
  input d3: Bit
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    connect d0 -> ff0.d
    connect d1 -> ff1.d
    connect d2 -> ff2.d
    connect d3 -> ff3.d
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}`,
    dsl: `
circuit Reg4 {
  input d0: Bit
  input d1: Bit
  input d2: Bit
  input d3: Bit
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    connect d0 -> ff0.d
    connect d1 -> ff1.d
    connect d2 -> ff2.d
    connect d3 -> ff3.d
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}

circuit DemoReg4 {
  clock clk
  impl {
    node sw_d0: Switch
    node sw_d1: Switch
    node sw_d2: Switch
    node sw_d3: Switch
    node reg: Reg4
    node led_q0: Led
    node led_q1: Led
    node led_q2: Led
    node led_q3: Led
    connect clk -> reg.clk
    connect sw_d0.out -> reg.d0
    connect sw_d1.out -> reg.d1
    connect sw_d2.out -> reg.d2
    connect sw_d3.out -> reg.d3
    connect reg.q0 -> led_q0.in
    connect reg.q1 -> led_q1.in
    connect reg.q2 -> led_q2.in
    connect reg.q3 -> led_q3.in
  }
}`,
  },

  counter4bit: {
    name: "4-Bit Counter",
    description:
      "Counts from 0 to 15 using a synchronous binary counter.",
    displayDsl: `circuit Counter4 {
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    // All flip-flops share one clock
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    // Bit 0: always toggles
    node inv0: Not
    connect ff0.q -> inv0.in
    connect inv0.out -> ff0.d
    // Bit 1: toggles when q0=1
    node xor1: Xor
    connect ff1.q -> xor1.a
    connect ff0.q -> xor1.b
    connect xor1.out -> ff1.d
    // Bit 2: toggles when q0 AND q1
    node and01: And
    node xor2: Xor
    connect ff0.q -> and01.a
    connect ff1.q -> and01.b
    connect ff2.q -> xor2.a
    connect and01.out -> xor2.b
    connect xor2.out -> ff2.d
    // Bit 3: toggles when q0 AND q1 AND q2
    node and012: And
    node xor3: Xor
    connect and01.out -> and012.a
    connect ff2.q -> and012.b
    connect ff3.q -> xor3.a
    connect and012.out -> xor3.b
    connect xor3.out -> ff3.d
    // Outputs
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}`,
    dsl: `
circuit Counter4 {
  clock clk
  output q0: Bit
  output q1: Bit
  output q2: Bit
  output q3: Bit
  impl {
    node ff0: DFlipFlop
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    node ff3: DFlipFlop
    connect clk -> ff0.clk
    connect clk -> ff1.clk
    connect clk -> ff2.clk
    connect clk -> ff3.clk
    node inv0: Not
    connect ff0.q -> inv0.in
    connect inv0.out -> ff0.d
    node xor1: Xor
    connect ff1.q -> xor1.a
    connect ff0.q -> xor1.b
    connect xor1.out -> ff1.d
    node and01: And
    node xor2: Xor
    connect ff0.q -> and01.a
    connect ff1.q -> and01.b
    connect ff2.q -> xor2.a
    connect and01.out -> xor2.b
    connect xor2.out -> ff2.d
    node and012: And
    node xor3: Xor
    connect and01.out -> and012.a
    connect ff2.q -> and012.b
    connect ff3.q -> xor3.a
    connect and012.out -> xor3.b
    connect xor3.out -> ff3.d
    connect ff0.q -> q0
    connect ff1.q -> q1
    connect ff2.q -> q2
    connect ff3.q -> q3
  }
}

circuit DemoCounter4 {
  clock clk
  impl {
    node ctr: Counter4
    node led_q0: Led
    node led_q1: Led
    node led_q2: Led
    node led_q3: Led
    connect clk -> ctr.clk
    connect ctr.q0 -> led_q0.in
    connect ctr.q1 -> led_q1.in
    connect ctr.q2 -> led_q2.in
    connect ctr.q3 -> led_q3.in
  }
}`,
  },

  adder4bit: {
    name: "4-Bit Adder",
    description:
      "Chains four full adders to add two 4-bit numbers with carry propagation.",
    displayDsl: `circuit Adder4 {
  input a0: Bit
  input a1: Bit
  input a2: Bit
  input a3: Bit
  input b0: Bit
  input b1: Bit
  input b2: Bit
  input b3: Bit
  output s0: Bit
  output s1: Bit
  output s2: Bit
  output s3: Bit
  output cout: Bit
  impl {
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder
    // Inputs
    connect a0 -> fa0.a
    connect b0 -> fa0.b
    connect a1 -> fa1.a
    connect b1 -> fa1.b
    connect a2 -> fa2.a
    connect b2 -> fa2.b
    connect a3 -> fa3.a
    connect b3 -> fa3.b
    // Carry chain
    connect fa0.cout -> fa1.cin
    connect fa1.cout -> fa2.cin
    connect fa2.cout -> fa3.cin
    // Outputs
    connect fa0.sum -> s0
    connect fa1.sum -> s1
    connect fa2.sum -> s2
    connect fa3.sum -> s3
    connect fa3.cout -> cout
  }
}`,
    dsl: `
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}

circuit Adder4 {
  input a0: Bit
  input a1: Bit
  input a2: Bit
  input a3: Bit
  input b0: Bit
  input b1: Bit
  input b2: Bit
  input b3: Bit
  output s0: Bit
  output s1: Bit
  output s2: Bit
  output s3: Bit
  output cout: Bit
  impl {
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder
    connect a0 -> fa0.a
    connect b0 -> fa0.b
    connect a1 -> fa1.a
    connect b1 -> fa1.b
    connect a2 -> fa2.a
    connect b2 -> fa2.b
    connect a3 -> fa3.a
    connect b3 -> fa3.b
    connect fa0.cout -> fa1.cin
    connect fa1.cout -> fa2.cin
    connect fa2.cout -> fa3.cin
    connect fa0.sum -> s0
    connect fa1.sum -> s1
    connect fa2.sum -> s2
    connect fa3.sum -> s3
    connect fa3.cout -> cout
  }
}

circuit DemoAdder4 {
  impl {
    node sw_a0: Switch
    node sw_a1: Switch
    node sw_a2: Switch
    node sw_a3: Switch
    node sw_b0: Switch
    node sw_b1: Switch
    node sw_b2: Switch
    node sw_b3: Switch
    node adder: Adder4
    node led_s0: Led
    node led_s1: Led
    node led_s2: Led
    node led_s3: Led
    node led_cout: Led
    connect sw_a0.out -> adder.a0
    connect sw_a1.out -> adder.a1
    connect sw_a2.out -> adder.a2
    connect sw_a3.out -> adder.a3
    connect sw_b0.out -> adder.b0
    connect sw_b1.out -> adder.b1
    connect sw_b2.out -> adder.b2
    connect sw_b3.out -> adder.b3
    connect adder.s0 -> led_s0.in
    connect adder.s1 -> led_s1.in
    connect adder.s2 -> led_s2.in
    connect adder.s3 -> led_s3.in
    connect adder.cout -> led_cout.in
  }
}`,
  },

  alu1bit: {
    name: "1-Bit ALU Slice",
    description:
      "Performs ADD, AND, OR, or XOR on one bit, selected by a 2-bit control signal.",
    displayDsl: `circuit ALU1 {
  input a: Bit
  input b: Bit
  input cin: Bit
  input op0: Bit
  input op1: Bit
  output result: Bit
  output cout: Bit
  impl {
    // Compute all four operations
    node add: FullAdder
    node op_and: And
    node op_or: Or
    node op_xor: Xor
    connect a -> add.a
    connect b -> add.b
    connect cin -> add.cin
    connect add.cout -> cout
    connect a -> op_and.a
    connect b -> op_and.b
    connect a -> op_or.a
    connect b -> op_or.b
    connect a -> op_xor.a
    connect b -> op_xor.b
    // 2-level mux tree to select result
    // op=00: ADD, op=01: AND
    // op=10: OR,  op=11: XOR
    node mux_lo: Mux
    node mux_hi: Mux
    node mux_out: Mux
    connect add.sum -> mux_lo.a
    connect op_and.out -> mux_lo.b
    connect op0 -> mux_lo.sel
    connect op_or.out -> mux_hi.a
    connect op_xor.out -> mux_hi.b
    connect op0 -> mux_hi.sel
    connect mux_lo.out -> mux_out.a
    connect mux_hi.out -> mux_out.b
    connect op1 -> mux_out.sel
    connect mux_out.out -> result
  }
}`,
    dsl: `
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit
  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or
    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}

circuit ALU1 {
  input a: Bit
  input b: Bit
  input cin: Bit
  input op0: Bit
  input op1: Bit
  output result: Bit
  output cout: Bit
  impl {
    node add: FullAdder
    node op_and: And
    node op_or: Or
    node op_xor: Xor
    connect a -> add.a
    connect b -> add.b
    connect cin -> add.cin
    connect add.cout -> cout
    connect a -> op_and.a
    connect b -> op_and.b
    connect a -> op_or.a
    connect b -> op_or.b
    connect a -> op_xor.a
    connect b -> op_xor.b
    node mux_lo: Mux
    node mux_hi: Mux
    node mux_out: Mux
    connect add.sum -> mux_lo.a
    connect op_and.out -> mux_lo.b
    connect op0 -> mux_lo.sel
    connect op_or.out -> mux_hi.a
    connect op_xor.out -> mux_hi.b
    connect op0 -> mux_hi.sel
    connect mux_lo.out -> mux_out.a
    connect mux_hi.out -> mux_out.b
    connect op1 -> mux_out.sel
    connect mux_out.out -> result
  }
}

circuit DemoALU1 {
  impl {
    node sw_a: Switch
    node sw_b: Switch
    node sw_cin: Switch
    node sw_op0: Switch
    node sw_op1: Switch
    node alu: ALU1
    node led_result: Led
    node led_cout: Led
    connect sw_a.out -> alu.a
    connect sw_b.out -> alu.b
    connect sw_cin.out -> alu.cin
    connect sw_op0.out -> alu.op0
    connect sw_op1.out -> alu.op1
    connect alu.result -> led_result.in
    connect alu.cout -> led_cout.in
  }
}`,
  },

  ram: {
    name: "RAM",
    description:
      "256x8 memory. Reads are instant (combinational). Writes happen on the clock edge when write-enable is on.",
    displayDsl: `circuit DemoRAM {
  clock clk
  impl {
    // Address and data inputs (8-bit)
    node addr: Input
    node data_in: Input
    // Write-enable (single bit)
    node we: Switch
    // The memory
    node mem: RAM
    // Output display
    node data_out: HexDisplay
    // Wiring
    connect clk -> mem.clk
    connect addr.out -> mem.addr
    connect data_in.out -> mem.data_in
    connect we.out -> mem.we
    connect mem.data_out -> data_out.in
  }
}`,
    dsl: `
circuit DemoRAM {
  clock clk
  impl {
    node addr: Input
    node data_in: Input
    node we: Switch
    node mem: RAM
    node data_out: HexDisplay
    connect clk -> mem.clk
    connect addr.out -> mem.addr
    connect data_in.out -> mem.data_in
    connect we.out -> mem.we
    connect mem.data_out -> data_out.in
  }
}`,
  },
};
