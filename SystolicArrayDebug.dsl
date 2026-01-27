// Simplified Debug Version - Outputs Counter and PE signals

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

circuit SystolicArrayDebug {
  input a00: Bus[8]
  input b00: Bus[8]
  input loadWeights: Bit
  input start: Bit
  clock clk
  output counter_out: Bus[8]
  output pe_out: Bus[16]
  output result_out: Bus[16]
  output done: Bit

  impl {
    // Single PE for testing
    node pe: ProcessingElement

    // Input registers
    node reg_a: Register

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

    // Result
    node result: Register
    node is_cycle2: Comparator

    // Done
    node is_cycle6_done: Comparator
    node done_reg: DFlipFlop
    node done_or: Or

    // Constants
    node zero16: Constant(value=0)
    node one: Constant(value=1)
    node const_0: Constant(value=0)
    node const_2: Constant(value=2)
    node const_6: Constant(value=6)

    // Input register
    connect a00 -> reg_a.data
    connect start -> reg_a.we
    connect clk -> reg_a.clk

    // Counter control
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

    // PE connections
    connect reg_a.q -> pe.dataIn
    connect b00 -> pe.weightIn
    connect loadWeights -> pe.loadWeight
    connect zero16.out -> pe.partialSumIn
    connect clk -> pe.clk

    // Result capture at cycle 2
    connect counter.q -> is_cycle2.a
    connect const_2.out -> is_cycle2.b
    connect pe.partialSumOut -> result.data
    connect is_cycle2.eq -> result.we
    connect clk -> result.clk

    // Done signal
    connect counter.q -> is_cycle6_done.a
    connect const_6.out -> is_cycle6_done.b
    connect is_cycle6_done.eq -> done_or.a
    connect done_reg.q -> done_or.b
    connect done_or.out -> done_reg.d
    connect clk -> done_reg.clk

    // Outputs for debugging
    connect counter.q -> counter_out
    connect pe.partialSumOut -> pe_out
    connect result.q -> result_out
    connect done_reg.q -> done
  }
}

circuit DebugDemo {
  clock clk

  impl {
    node test: SystolicArrayDebug

    node a00: Input(value=5)  // 5 × 3 = 15
    node b00: Input(value=3)

    node loadWeights: Switch
    node start: Switch

    connect a00.out -> test.a00
    connect b00.out -> test.b00
    connect loadWeights.out -> test.loadWeights
    connect start.out -> test.start
    connect clk -> test.clk

    node counter_display: HexDisplay
    node pe_display: HexDisplay
    node result_display: HexDisplay
    node done_display: Led

    connect test.counter_out -> counter_display.in
    connect test.pe_out -> pe_display.in
    connect test.result_out -> result_display.in
    connect test.done -> done_display.in
  }
}
