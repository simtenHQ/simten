circuit SimpleArbiter2Port {
  // ============================================================================
  // Simple Arbiter - 2-Port Toggle
  // ============================================================================
  // Alternates between port 0 and port 1 when both have packets ready
  // Simple and fair for 2-port case
  // ============================================================================

  // Formal port declarations
  input port0_ready: Bit
  input port1_ready: Bit
  input forwarder_done: Bit
  clock clk

  output grant_port: Bus[8]
  output grant_valid: Bit

  impl {
    // State registers
    node last_port: Register        // Last served port (0 or 1)
    node grant_port_reg: Register   // Registered output - breaks combinational loop
    node grant_valid_reg: Register  // Registered output - breaks combinational loop

    // Numeric constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)

    // ============================================================================
    // Port Selection Logic
    // ============================================================================

    // Check which port was served last
    node last_was_port0: Comparator
    connect last_port.q -> last_was_port0.a
    connect ZERO.out -> last_was_port0.b

    node last_was_port1: Comparator
    connect last_port.q -> last_was_port1.a
    connect ONE.out -> last_was_port1.b

    // If last was port 0, try port 1 first (fairness)
    // If last was port 1, try port 0 first

    // Case 1: Last was port 0, prefer port 1
    node prefer_port1: And
    connect last_was_port0.eq -> prefer_port1.a
    connect port1_ready -> prefer_port1.b

    // If port 1 not ready, fall back to port 0
    node not_port1_ready: Not
    connect port1_ready -> not_port1_ready.in

    node fallback_port0: And
    connect last_was_port0.eq -> fallback_port0.a
    connect not_port1_ready.out -> fallback_port0.b

    node fallback_port0_ready: And
    connect fallback_port0.out -> fallback_port0_ready.a
    connect port0_ready -> fallback_port0_ready.b

    // Case 2: Last was port 1, prefer port 0
    node prefer_port0: And
    connect last_was_port1.eq -> prefer_port0.a
    connect port0_ready -> prefer_port0.b

    // If port 0 not ready, fall back to port 1
    node not_port0_ready: Not
    connect port0_ready -> not_port0_ready.in

    node fallback_port1: And
    connect last_was_port1.eq -> fallback_port1.a
    connect not_port0_ready.out -> fallback_port1.b

    node fallback_port1_ready: And
    connect fallback_port1.out -> fallback_port1_ready.a
    connect port1_ready -> fallback_port1_ready.b

    // ============================================================================
    // Grant Signals (wired to formal output ports)
    // ============================================================================

    // Grant port 0 if: (last==1 && port0_ready) || (last==0 && !port1_ready && port0_ready)
    node grant_port0_signal: Or
    connect prefer_port0.out -> grant_port0_signal.a
    connect fallback_port0_ready.out -> grant_port0_signal.b

    // Grant port 1 if: (last==0 && port1_ready) || (last==1 && !port0_ready && port1_ready)
    node grant_port1_signal: Or
    connect prefer_port1.out -> grant_port1_signal.a
    connect fallback_port1_ready.out -> grant_port1_signal.b

    // grant_valid = grant_port0 || grant_port1 (combinational)
    node grant_valid_signal: Or
    connect grant_port0_signal.out -> grant_valid_signal.a
    connect grant_port1_signal.out -> grant_valid_signal.b

    // grant_port = grant_port1 ? 1 : 0 (combinational)
    node grant_port_mux: Mux
    connect ZERO.out -> grant_port_mux.in0  // Port 0
    connect ONE.out -> grant_port_mux.in1   // Port 1
    connect grant_port1_signal.out -> grant_port_mux.sel

    // Register grant outputs (breaks combinational feedback loop)
    connect grant_valid_signal.out -> grant_valid_reg.data
    node grant_valid_we: Input(value=1)
    connect grant_valid_we.out -> grant_valid_reg.we

    connect grant_port_mux.out -> grant_port_reg.data
    node grant_port_we: Input(value=1)
    connect grant_port_we.out -> grant_port_reg.we

    // Wire registered values to output ports
    connect grant_valid_reg.q -> grant_valid
    connect grant_port_reg.q -> grant_port

    // ============================================================================
    // Last Port Update
    // ============================================================================

    // Update last_port when forwarder completes
    // next_last_port = forwarder_done ? grant_port : last_port
    node next_last_port: Mux
    connect last_port.q -> next_last_port.in0           // Stay
    connect grant_port_reg.q -> next_last_port.in1      // Update (use registered value)
    connect forwarder_done -> next_last_port.sel

    connect next_last_port.out -> last_port.data
    node last_port_we: Input(value=1)
    connect last_port_we.out -> last_port.we

    // Debug display
    node last_port_display: HexDisplay
    connect last_port.q -> last_port_display.in
  }
}
