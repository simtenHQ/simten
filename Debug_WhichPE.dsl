// Debug: Show which PE output is which
// Just capture PE outputs directly at different cycles

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
    node psum_reg: Register
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

    connect adder.sum -> psum_reg.data
    connect one.out -> psum_reg.we
    connect clk -> psum_reg.clk
    connect psum_reg.q -> partialSumOut

    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}

circuit DebugPEOutputs {
  input a00: Bus[8]
  input a10: Bus[8]
  input b00: Bus[8]
  input b10: Bus[8]
  input loadWeights: Bit
  input start: Bit
  clock clk
  output pe00_out: Bus[16]
  output pe10_out: Bus[16]

  impl {
    node pe00: ProcessingElement
    node pe10: ProcessingElement
    node reg_a00: Register
    node reg_a10: Register
    node zero16: Constant(value=0)

    // Simple: feed a00 to PE00, a10 to PE10 simultaneously (no staggering yet)
    connect a00 -> reg_a00.data
    connect a10 -> reg_a10.data
    connect start -> reg_a00.we
    connect start -> reg_a10.we
    connect clk -> reg_a00.clk
    connect clk -> reg_a10.clk

    connect reg_a00.q -> pe00.dataIn
    connect reg_a10.q -> pe10.dataIn

    connect b00 -> pe00.weightIn
    connect b10 -> pe10.weightIn
    connect loadWeights -> pe00.loadWeight
    connect loadWeights -> pe10.loadWeight

    connect zero16.out -> pe00.partialSumIn
    connect pe00.partialSumOut -> pe10.partialSumIn

    connect clk -> pe00.clk
    connect clk -> pe10.clk

    connect pe00.partialSumOut -> pe00_out
    connect pe10.partialSumOut -> pe10_out
  }
}

circuit TestDebugPE {
  clock clk

  impl {
    node test: DebugPEOutputs

    node a00: Input(value=1)
    node a10: Input(value=3)
    node b00: Input(value=5)
    node b10: Input(value=7)

    node loadWeights: Switch
    node start: Switch

    connect a00.out -> test.a00
    connect a10.out -> test.a10
    connect b00.out -> test.b00
    connect b10.out -> test.b10
    connect loadWeights.out -> test.loadWeights
    connect start.out -> test.start
    connect clk -> test.clk

    node display_pe00: HexDisplay
    node display_pe10: HexDisplay

    connect test.pe00_out -> display_pe00.in
    connect test.pe10_out -> display_pe10.in
  }
}
