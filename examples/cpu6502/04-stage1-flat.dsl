// 6502 Stage 1: Flattened (no composite components in feedback loop)
// Registers and ALU logic directly in the circuit

circuit Stage1Flat {
  output cycle: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]

  clock clk

  impl {
    // === Cycle Counter ===
    node counter: Register
    connect clk -> counter.clk
    node always_on: Constant(value=1)
    connect always_on.out -> counter.we

    node inc: Incrementer
    connect counter.q -> inc.in
    connect inc.out -> counter.data
    connect counter.q -> cycle

    // === Cycle Detection ===
    node c0: Constant(value=0)
    node c1: Constant(value=1)
    node c2: Constant(value=2)
    node c3: Constant(value=3)

    node is_c0: Comparator
    connect counter.q -> is_c0.a
    connect c0.out -> is_c0.b

    node is_c2: Comparator
    connect counter.q -> is_c2.a
    connect c2.out -> is_c2.b

    node is_c3: Comparator
    connect counter.q -> is_c3.a
    connect c3.out -> is_c3.b

    // === Registers (inlined, not composite) ===
    node regA: Register
    connect clk -> regA.clk

    node regX: Register
    connect clk -> regX.clk

    connect regA.q -> reg_a
    connect regX.q -> reg_x

    // === ALU (inlined arithmetic only) ===
    node adder: Adder
    connect c0.out -> adder.carry_in

    // === Data Path ===
    // Constants
    node v66: Constant(value=66)
    node v8: Constant(value=8)
    node v10: Constant(value=10)

    // ALU input A: read from register
    // Cycles 0-2: read A, Cycle 3: read X
    node alu_a_mux: Mux
    connect is_c3.eq -> alu_a_mux.sel
    connect regA.q -> alu_a_mux.in0  // cycles 0-2: read A
    connect regX.q -> alu_a_mux.in1  // cycle 3: read X

    connect alu_a_mux.out -> adder.a

    // ALU input B: immediate values
    // c0: 66, c1: 8, c2: 0, c3: 10
    node alu_b_mux1: Mux
    connect is_c0.eq -> alu_b_mux1.sel
    connect v8.out -> alu_b_mux1.in0
    connect v66.out -> alu_b_mux1.in1

    node alu_b_mux2: Mux
    connect is_c2.eq -> alu_b_mux2.sel
    connect alu_b_mux1.out -> alu_b_mux2.in0
    connect c0.out -> alu_b_mux2.in1

    node alu_b_mux3: Mux
    connect is_c3.eq -> alu_b_mux3.sel
    connect alu_b_mux2.out -> alu_b_mux3.in0
    connect v10.out -> alu_b_mux3.in1

    connect alu_b_mux3.out -> adder.b

    // === Register Write Control ===
    // Cycles 0-1: write A, Cycles 2-3: write X
    node write_a_mux1: Mux
    connect is_c2.eq -> write_a_mux1.sel
    connect always_on.out -> write_a_mux1.in0    // c0-1: write A
    connect c0.out -> write_a_mux1.in1           // c2+: don't write A

    node write_a_mux2: Mux
    connect is_c3.eq -> write_a_mux2.sel
    connect write_a_mux1.out -> write_a_mux2.in0
    connect c0.out -> write_a_mux2.in1

    connect write_a_mux2.out -> regA.we
    connect adder.sum -> regA.data

    node write_x_mux1: Mux
    connect is_c2.eq -> write_x_mux1.sel
    connect c0.out -> write_x_mux1.in0           // c0-1: don't write X
    connect always_on.out -> write_x_mux1.in1    // c2+: write X

    node write_x_mux2: Mux
    connect is_c3.eq -> write_x_mux2.sel
    connect write_x_mux1.out -> write_x_mux2.in0
    connect always_on.out -> write_x_mux2.in1

    connect write_x_mux2.out -> regX.we
    connect adder.sum -> regX.data
  }
}

// Demo with displays
circuit Stage1FlatDemo {
  clock clk

  impl {
    node cpu: Stage1Flat
    connect clk -> cpu.clk

    node d_cycle: HexDisplay
    connect cpu.cycle -> d_cycle.in

    node d_a: HexDisplay
    connect cpu.reg_a -> d_a.in

    node d_x: HexDisplay
    connect cpu.reg_x -> d_x.in
  }
}
