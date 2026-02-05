// Minimal FSM test
circuit MinimalFSM {
  input reset: Bit
  output current_state: Bus[3]
  clock clk

  impl {
    node state_reg: Register
    connect clk -> state_reg.clk

    node zero: Constant(value=0)
    connect zero.out -> state_reg.data

    node always_on: Constant(value=1)
    connect always_on.out -> state_reg.we

    connect state_reg.q -> current_state
  }
}
