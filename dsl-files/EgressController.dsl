circuit EgressController {
  // ============================================================================
  // Egress Controller - Packet Transmission
  // ============================================================================
  // Serializes packets from egress buffer to output
  // Emits one byte per cycle with data_valid signal
  // Generates sof/eof markers for frame boundaries
  // ============================================================================

  // Formal port declarations
  input pkt_ready: Bit
  input trigger: Bit
  clock clk

  output egress_addr: Bus[8]
  output egress_re: Bit
  output data_valid: Bit
  output sof: Bit
  output eof: Bit
  output ready: Bit

  impl {
    // FSM state
    node fsm_state: Register
    node byte_counter: Register  // Current byte (0-7)
    node read_ptr: Register      // Read position in buffer (0-31)

    // State constants
    node STATE_IDLE: Input(value=0)
    node STATE_TRANSMIT: Input(value=1)

    // Numeric constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)

    // ============================================================================
    // State Detection
    // ============================================================================
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b

    node isTRANSMIT: Comparator
    connect fsm_state.q -> isTRANSMIT.a
    connect STATE_TRANSMIT.out -> isTRANSMIT.b

    // ============================================================================
    // State Transitions
    // ============================================================================

    // IDLE → TRANSMIT: trigger && pkt_ready
    node can_start: And
    connect trigger -> can_start.a
    connect pkt_ready -> can_start.b

    node idle_to_transmit: And
    connect isIDLE.eq -> idle_to_transmit.a
    connect can_start.out -> idle_to_transmit.b

    // TRANSMIT → IDLE: byte_counter == 7
    node byte_is_seven: Comparator
    connect byte_counter.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b

    node transmit_complete: And
    connect isTRANSMIT.eq -> transmit_complete.a
    connect byte_is_seven.eq -> transmit_complete.b

    // ============================================================================
    // Next State Logic
    // ============================================================================

    node next_state_m1: Mux
    connect fsm_state.q -> next_state_m1.in0  // Stay
    connect STATE_TRANSMIT.out -> next_state_m1.in1
    connect idle_to_transmit.out -> next_state_m1.sel

    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_IDLE.out -> next_state.in1
    connect transmit_complete.out -> next_state.sel

    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we

    // ============================================================================
    // Byte Counter Logic
    // ============================================================================

    node byte_inc: Adder
    connect byte_counter.q -> byte_inc.a
    connect ONE.out -> byte_inc.b

    // Increment when transmitting
    node should_increment: And
    connect isTRANSMIT.eq -> should_increment.a
    connect isTRANSMIT.eq -> should_increment.b

    // Reset when starting transmission
    node should_reset: And
    connect idle_to_transmit.out -> should_reset.a
    connect idle_to_transmit.out -> should_reset.b

    node next_byte_counter_inc: Mux
    connect byte_counter.q -> next_byte_counter_inc.in0
    connect byte_inc.sum -> next_byte_counter_inc.in1
    connect should_increment.out -> next_byte_counter_inc.sel

    node next_byte_counter: Mux
    connect next_byte_counter_inc.out -> next_byte_counter.in0
    connect ZERO.out -> next_byte_counter.in1
    connect should_reset.out -> next_byte_counter.sel

    connect next_byte_counter.out -> byte_counter.data
    node byte_counter_we: Input(value=1)
    connect byte_counter_we.out -> byte_counter.we

    // ============================================================================
    // Read Pointer Logic
    // ============================================================================

    // Advance by 8 after completing transmission
    node ptr_add_eight: Adder
    connect read_ptr.q -> ptr_add_eight.a
    connect EIGHT.out -> ptr_add_eight.b

    node should_advance_ptr: And
    connect transmit_complete.out -> should_advance_ptr.a
    connect transmit_complete.out -> should_advance_ptr.b

    node next_read_ptr: Mux
    connect read_ptr.q -> next_read_ptr.in0
    connect ptr_add_eight.sum -> next_read_ptr.in1
    connect should_advance_ptr.out -> next_read_ptr.sel

    connect next_read_ptr.out -> read_ptr.data
    node read_ptr_we: Input(value=1)
    connect read_ptr_we.out -> read_ptr.we

    // ============================================================================
    // Egress RAM Interface and Outputs (wired to formal output ports)
    // ============================================================================

    // egress_addr = read_ptr + byte_counter
    node egress_addr_calc: Adder
    connect read_ptr.q -> egress_addr_calc.a
    connect byte_counter.q -> egress_addr_calc.b
    connect egress_addr_calc.sum -> egress_addr

    // egress_re = isTRANSMIT (read while transmitting)
    connect isTRANSMIT.eq -> egress_re

    // data_valid = isTRANSMIT
    connect isTRANSMIT.eq -> data_valid

    // sof = isTRANSMIT && byte_counter == 0
    node byte_is_zero: Comparator
    connect byte_counter.q -> byte_is_zero.a
    connect ZERO.out -> byte_is_zero.b

    node sof_signal: And
    connect isTRANSMIT.eq -> sof_signal.a
    connect byte_is_zero.eq -> sof_signal.b
    connect sof_signal.out -> sof

    // eof = isTRANSMIT && byte_counter == 7
    node eof_signal: And
    connect isTRANSMIT.eq -> eof_signal.a
    connect byte_is_seven.eq -> eof_signal.b
    connect eof_signal.out -> eof

    // ready = isIDLE (ready for next packet)
    connect isIDLE.eq -> ready

    // Debug displays
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in

    node byte_counter_display: HexDisplay
    connect byte_counter.q -> byte_counter_display.in

    node read_ptr_display: HexDisplay
    connect read_ptr.q -> read_ptr_display.in
  }
}
