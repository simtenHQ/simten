// Test the accumulator-based PE
circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input loadWeight: Bit
  input enable: Bit
  input reset: Bit
  clock clk
  output dataOut: Bus[8]
  output accOut: Bus[16]

  impl {
    node weightReg: Register
    node accumulator: Register
    node mult: Multiplier
    node adder: Adder(width=16)
    node acc_mux: Mux
    node acc_input_mux: Mux
    node dataPipe: Register
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    connect mult.product -> adder.a
    connect accumulator.q -> adder.b
    connect zero.out -> adder.carry_in

    connect reset -> acc_mux.sel
    connect adder.sum -> acc_mux.in0
    connect zero16.out -> acc_mux.in1

    connect enable -> acc_input_mux.sel
    connect accumulator.q -> acc_input_mux.in0
    connect acc_mux.out -> acc_input_mux.in1

    connect acc_input_mux.out -> accumulator.data
    connect one.out -> accumulator.we
    connect clk -> accumulator.clk

    connect accumulator.q -> accOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit TestAccumulatorPE {
  clock clk

  impl {
    node pe: ProcessingElement

    node data: Input(value=3)
    node weight: Input(value=5)
    node loadWeight: Switch
    node enable: Switch
    node reset: Switch

    connect data.out -> pe.dataIn
    connect weight.out -> pe.weightIn
    connect loadWeight.out -> pe.loadWeight
    connect enable.out -> pe.enable
    connect reset.out -> pe.reset
    connect clk -> pe.clk

    node result_display: HexDisplay
    connect pe.accOut -> result_display.in
  }
}
