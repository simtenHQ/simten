// Simple 8-bit Counter
// Counts up when enabled, resets to 0 when reset is high

circuit Counter {
  input reset: Bit
  input enable: Bit
  output count: Bus[8]

  clock clk

  impl {
    // Counter register
    node counter_reg: Register

    // Next value logic
    node next_val: Adder
    node one: Constant(value=1)
    node reset_mux: Mux
    node enable_mux: Mux
    node zero: Constant(value=0)
    node write_enable: Constant(value=1)  // Always write

    // When enabled, add 1 to current count
    connect counter_reg.q -> next_val.a
    connect one.out -> next_val.b

    // If enabled, use next_val, else keep current
    connect enable -> enable_mux.sel
    connect counter_reg.q -> enable_mux.in0    // Not enabled: keep current
    connect next_val.sum -> enable_mux.in1     // Enabled: increment

    // If reset, use 0, else use enable_mux result
    connect reset -> reset_mux.sel
    connect enable_mux.out -> reset_mux.in0    // Not reset: use enable logic
    connect zero.out -> reset_mux.in1          // Reset: use 0

    // Update register and connect to output
    connect reset_mux.out -> counter_reg.data
    connect write_enable.out -> counter_reg.we
    connect clk -> counter_reg.clk
    connect counter_reg.q -> count
  }
}
