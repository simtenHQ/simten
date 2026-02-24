// Charlie - 8-bit Decrementer
// Loads a start value on the first cycle, then decrements by 1 each tick

circuit Charlie {
  input start: Bus[8]
  output value: Bus[8]

  clock clk

  impl {
    // State
    node reg: Register
    node loaded: DFlipFlop

    // Arithmetic
    node sub: Subtractor
    node one: Constant(value=1)

    // Control
    node load_mux: Mux
    node we: Constant(value=1)
    node loaded_flag: Constant(value=1)

    // Subtract 1 from current value
    connect reg.q -> sub.a
    connect one.out -> sub.b

    // First cycle (loaded=0): load start value
    // After (loaded=1): use decremented value
    connect loaded.q -> load_mux.sel
    connect start -> load_mux.in0
    connect sub.difference -> load_mux.in1

    // Feed into register
    connect load_mux.out -> reg.data
    connect we.out -> reg.we
    connect clk -> reg.clk

    // Set loaded flag after first cycle
    connect loaded_flag.out -> loaded.d
    connect clk -> loaded.clk

    // Output
    connect reg.q -> value
  }
}
