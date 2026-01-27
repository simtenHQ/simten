// Processing Element with Accumulator - Hardware Accurate
circuit ProcessingElement {
  input dataIn: Bus[8]
  input weightIn: Bus[8]
  input loadWeight: Bit
  input enable: Bit        // Enable accumulation
  input reset: Bit         // Reset accumulator to 0
  clock clk

  output dataOut: Bus[8]
  output accOut: Bus[16]   // Accumulated result

  impl {
    // Weight register (stationary)
    node weightReg: Register

    // Accumulator register (holds partial sum)
    node accumulator: Register

    // MAC computation
    node mult: Multiplier
    node adder: Adder(width=16)

    // Accumulator control
    node acc_mux: Mux  // Select between reset (0) or new sum
    node acc_input_mux: Mux  // Select between keeping old value or updating

    // Data pipeline
    node dataPipe: Register

    // Constants
    node one: Constant(value=1)
    node zero: Constant(value=0)
    node zero16: Constant(value=0)

    // Weight loading
    connect weightIn -> weightReg.data
    connect loadWeight -> weightReg.we
    connect clk -> weightReg.clk

    // MAC: multiply dataIn by weight
    connect dataIn -> mult.a
    connect weightReg.q -> mult.b

    // Add: product + current accumulator
    connect mult.product -> adder.a
    connect accumulator.q -> adder.b
    connect zero.out -> adder.carry_in

    // Accumulator control:
    // If reset=1: load 0
    // Else if enable=1: load new sum
    // Else: keep old value
    connect reset -> acc_mux.sel
    connect adder.sum -> acc_mux.in0
    connect zero16.out -> acc_mux.in1

    connect enable -> acc_input_mux.sel
    connect accumulator.q -> acc_input_mux.in0  // Keep old
    connect acc_mux.out -> acc_input_mux.in1    // Update

    connect acc_input_mux.out -> accumulator.data
    connect one.out -> accumulator.we  // Always write-enabled
    connect clk -> accumulator.clk

    // Output accumulator
    connect accumulator.q -> accOut

    // Data passthrough
    connect dataIn -> dataPipe.data
    connect one.out -> dataPipe.we
    connect clk -> dataPipe.clk
    connect dataPipe.q -> dataOut
  }
}
