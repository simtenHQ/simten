// 8-bit Decounter
// Decrements by 1 when enabled, can be loaded with a new value

circuit Decounter {
  input load_val: Bus[8]  // Value to load into counter
  input load: Bit          // Load the load_val into counter
  input enable: Bit        // Enable decrementing
  output count: Bus[8]     // Current count value

  clock clk

  impl {
    // Counter register
    node counter_reg: Register

    // Decrement logic (subtract 1)
    node prev_val: Subtractor
    node one: Constant(value=1)
    node zero: Constant(value=0)  // For subtractor's carry-in

    // Control muxes
    node enable_mux: Mux    // Choose: decrement or hold
    node load_mux: Mux      // Choose: load value or enable logic
    node write_enable: Constant(value=1)  // Always write to register

    // Subtract 1 from current count
    connect counter_reg.q -> prev_val.a
    connect one.out -> prev_val.b
    connect zero.out -> prev_val.borrow_in  // No borrow-in

    // If enabled, use decremented value, else keep current
    connect enable -> enable_mux.sel
    connect counter_reg.q -> enable_mux.in0     // Not enabled: hold current
    connect prev_val.difference -> enable_mux.in1     // Enabled: decrement

    // If load, use load_val, else use enable logic
    connect load -> load_mux.sel
    connect enable_mux.out -> load_mux.in0      // Not loading: use enable logic
    connect load_val -> load_mux.in1            // Loading: use load_val

    // Update register and connect to output
    connect load_mux.out -> counter_reg.data
    connect write_enable.out -> counter_reg.we
    connect clk -> counter_reg.clk
    connect counter_reg.q -> count
  }
}
