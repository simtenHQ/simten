// TRUE Weight-Stationary Systolic Array
// Weights stay in PEs, data flows horizontally, partial sums flow vertically
// NO per-PE accumulators - accumulation happens through vertical flow!

circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input partialSumIn: Bus[16]
  input loadWeight: Bit
  clock clk
  output dataOut: Bus[8]
  output partialSumOut: Bus[16]

  impl {
    node weightReg: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b
    connect mult.product -> adder.a
    connect partialSumIn -> adder.b
    connect zero.out -> adder.carry_in
    connect adder.sum -> partialSumOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

// For 2×2, we compute C = A × B
// The outputs come from DIFFERENT positions in the array at DIFFERENT times!
// c00 and c10 emerge from column 0 (bottom of PE00 column)
// c01 and c11 emerge from column 1 (bottom of PE01 column)

circuit Systolic2x2True {
  input a00: Bus[8]
  input a01: Bus[8]
  input a10: Bus[8]
  input a11: Bus[8]
  input b00: Bus[8]
  input b01: Bus[8]
  input b10: Bus[8]
  input b11: Bus[8]
  input loadWeights: Bit
  input start: Bit
  clock clk
  output c00: Bus[16]
  output c01: Bus[16]
  output c10: Bus[16]
  output c11: Bus[16]
  output done: Bit

  impl {
    // PE Grid
    node pe00: ProcessingElement
    node pe01: ProcessingElement
    node pe10: ProcessingElement
    node pe11: ProcessingElement

    // Input staging registers
    node reg_a00: Register
    node reg_a01: Register
    node reg_a10: Register
    node reg_a11: Register

    // Counter
    node counter: Register
    node counter_inc: Incrementer
    node counter_bits: BitSlice(low=0, high=2)
    node counter_reset_mux: Mux
    node computing: DFlipFlop
    node start_or_computing: Or
    node is_cycle6: Comparator
    node not_cycle6: Not
    node count_enable: And

    // Row 0 sequencing
    node is_cycle0: Comparator
    node is_cycle1: Comparator
    node row0_active: Or
    node row0_mux: Mux
    node row0_gate: Mux

    // Row 1 sequencing
    node is_cycle1_row1: Comparator
    node is_cycle2: Comparator
    node row1_active: Or
    node row1_mux: Mux
    node row1_gate: Mux

    // OUTPUT registers - capture from PE outputs at right time
    node result_c00: Register
    node result_c01: Register
    node result_c10: Register
    node result_c11: Register

    // Capture timing
    node is_cycle3: Comparator
    node is_cycle4: Comparator

    // Done
    node is_cycle6_done: Comparator
    node done_reg: DFlipFlop
    node done_or: Or

    // Constants
    node zero8: Constant(value=0)
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node const_0: Constant(value=0)
    node const_1: Constant(value=1)
    node const_2: Constant(value=2)
    node const_3: Constant(value=3)
    node const_4: Constant(value=4)
    node const_6: Constant(value=6)

    // Input storage
    connect a00 -> reg_a00.data
    connect a01 -> reg_a01.data
    connect a10 -> reg_a10.data
    connect a11 -> reg_a11.data
    connect start -> reg_a00.we
    connect start -> reg_a01.we
    connect start -> reg_a10.we
    connect start -> reg_a11.we
    connect clk -> reg_a00.clk
    connect clk -> reg_a01.clk
    connect clk -> reg_a10.clk
    connect clk -> reg_a11.clk

    // Counter
    connect start -> start_or_computing.a
    connect computing.q -> start_or_computing.b
    connect start_or_computing.out -> computing.d
    connect clk -> computing.clk

    connect start -> counter_reset_mux.sel
    connect counter_bits.out -> counter_reset_mux.in0
    connect const_0.out -> counter_reset_mux.in1

    connect counter.q -> counter_inc.in
    connect counter_inc.out -> counter_bits.in

    connect counter.q -> is_cycle6.a
    connect const_6.out -> is_cycle6.b
    connect is_cycle6.eq -> not_cycle6.in

    connect start_or_computing.out -> count_enable.a
    connect not_cycle6.out -> count_enable.b

    connect counter_reset_mux.out -> counter.data
    connect count_enable.out -> counter.we
    connect clk -> counter.clk

    // Row 0 sequencing (same as before)
    connect counter.q -> is_cycle0.a
    connect const_0.out -> is_cycle0.b
    connect counter.q -> is_cycle1.a
    connect const_1.out -> is_cycle1.b
    connect is_cycle0.eq -> row0_active.a
    connect is_cycle1.eq -> row0_active.b
    connect is_cycle1.eq -> row0_mux.sel
    connect reg_a00.q -> row0_mux.in0
    connect reg_a01.q -> row0_mux.in1
    connect row0_active.out -> row0_gate.sel
    connect zero8.out -> row0_gate.in0
    connect row0_mux.out -> row0_gate.in1

    // Row 1 sequencing
    connect counter.q -> is_cycle1_row1.a
    connect const_1.out -> is_cycle1_row1.b
    connect counter.q -> is_cycle2.a
    connect const_2.out -> is_cycle2.b
    connect is_cycle1_row1.eq -> row1_active.a
    connect is_cycle2.eq -> row1_active.b
    connect is_cycle2.eq -> row1_mux.sel
    connect reg_a10.q -> row1_mux.in0
    connect reg_a11.q -> row1_mux.in1
    connect row1_active.out -> row1_gate.sel
    connect zero8.out -> row1_gate.in0
    connect row1_mux.out -> row1_gate.in1

    // PE Grid weights
    connect b00 -> pe00.weightIn
    connect b01 -> pe01.weightIn
    connect b10 -> pe10.weightIn
    connect b11 -> pe11.weightIn
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe01.loadWeight
    connect loadWeights -> pe10.loadWeight
    connect loadWeights -> pe11.loadWeight

    // PE Grid clocks
    connect clk -> pe00.clk
    connect clk -> pe01.clk
    connect clk -> pe10.clk
    connect clk -> pe11.clk

    // PE Grid data flow (horizontal)
    connect row0_gate.out -> pe00.dataIn
    connect pe00.dataOut -> pe01.dataIn
    connect row1_gate.out -> pe10.dataIn
    connect pe10.dataOut -> pe11.dataIn

    // PE Grid partial sums (vertical)
    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn
    connect zero16.out -> pe01.partialSumIn
    connect pe01.partialSumOut -> pe11.partialSumIn

    // KEY FIX: Capture outputs from CORRECT PEs!
    // c00, c10 come from column 0 (PE10 output at different times)
    // c01, c11 come from column 1 (PE11 output at different times)

    connect counter.q -> is_cycle3.a
    connect const_3.out -> is_cycle3.b
    connect counter.q -> is_cycle4.a
    connect const_4.out -> is_cycle4.b

    // Cycle 3: first row results (after a00, a01 processed)
    connect pe10.partialSumOut -> result_c00.data
    connect pe11.partialSumOut -> result_c01.data
    connect is_cycle3.eq -> result_c00.we
    connect is_cycle3.eq -> result_c01.we
    connect clk -> result_c00.clk
    connect clk -> result_c01.clk

    // Cycle 4: second row results (after a10, a11 processed)
    connect pe10.partialSumOut -> result_c10.data
    connect pe11.partialSumOut -> result_c11.data
    connect is_cycle4.eq -> result_c10.we
    connect is_cycle4.eq -> result_c11.we
    connect clk -> result_c10.clk
    connect clk -> result_c11.clk

    // Done signal
    connect counter.q -> is_cycle6_done.a
    connect const_6.out -> is_cycle6_done.b
    connect is_cycle6_done.eq -> done_or.a
    connect done_reg.q -> done_or.b
    connect done_or.out -> done_reg.d
    connect clk -> done_reg.clk

    // Outputs
    connect result_c00.q -> c00
    connect result_c01.q -> c01
    connect result_c10.q -> c10
    connect result_c11.q -> c11
    connect done_reg.q -> done
  }
}

circuit TestSystolic2x2 {
  clock clk

  impl {
    node sys: Systolic2x2True

    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    node loadWeights: Switch
    node start: Switch

    connect a00.out -> sys.a00
    connect a01.out -> sys.a01
    connect a10.out -> sys.a10
    connect a11.out -> sys.a11
    connect b00.out -> sys.b00
    connect b01.out -> sys.b01
    connect b10.out -> sys.b10
    connect b11.out -> sys.b11
    connect loadWeights.out -> sys.loadWeights
    connect start.out -> sys.start
    connect clk -> sys.clk

    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay
    node done_display: Led

    connect sys.c00 -> display_c00.in
    connect sys.c01 -> display_c01.in
    connect sys.c10 -> display_c10.in
    connect sys.c11 -> display_c11.in
    connect sys.done -> done_display.in
  }
}
