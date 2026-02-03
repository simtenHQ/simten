circuit IngressController {
  // ============================================================================
  // Ingress Controller - Packet Reception and Buffering
  // ============================================================================
  // Receives packets from MacRxParser and buffers them in RAM
  // Buffers up to 4 packets (32 bytes total: 4 × 8-byte packets)
  // Signals when packets are ready to forward
  // ============================================================================

  // Formal port declarations
  input data_in: Bus[8]
  input sof: Bit
  input eof: Bit
  input data_valid: Bit
  input grant: Bit
  clock clk

  output buf_addr: Bus[8]
  output buf_data: Bus[8]
  output buf_we: Bit
  output pkt_ready: Bit
  output buf_full: Bit
  output write_ptr: Bus[8]

  impl {
    // FSM state: IDLE(0), RECEIVING(1), BUFFERED(2)
    node fsm_state: Register
    node byte_count: Register     // Current byte position (0-7)
    node write_ptr_reg: Register  // Next write position (0-31)
    node pkt_count: Register      // Number of buffered packets (0-4)
    node pkt_ready_reg: Register  // Registered pkt_ready output (breaks feedback loop)

    // State constants
    node STATE_IDLE: Input(value=0)
    node STATE_RECEIVING: Input(value=1)
    node STATE_BUFFERED: Input(value=2)

    // Numeric constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node FOUR: Input(value=4)                 // Max packets
    node SEVEN: Input(value=7)                // Bytes per packet - 1
    node EIGHT: Input(value=8)                // Bytes per packet

    // ============================================================================
    // State Detection
    // ============================================================================
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b

    node isRECEIVING: Comparator
    connect fsm_state.q -> isRECEIVING.a
    connect STATE_RECEIVING.out -> isRECEIVING.b

    node isBUFFERED: Comparator
    connect fsm_state.q -> isBUFFERED.a
    connect STATE_BUFFERED.out -> isBUFFERED.b

    // ============================================================================
    // Buffer Full Detection
    // ============================================================================
    node buf_full_cmp: Comparator
    connect pkt_count.q -> buf_full_cmp.a
    connect FOUR.out -> buf_full_cmp.b

    // ============================================================================
    // State Transitions
    // ============================================================================

    // IDLE → RECEIVING: sof && data_valid && !buf_full
    node not_buf_full: Not
    connect buf_full_cmp.eq -> not_buf_full.in

    node can_receive: And
    connect sof -> can_receive.a
    connect not_buf_full.out -> can_receive.b

    node can_receive_valid: And
    connect can_receive.out -> can_receive_valid.a
    connect data_valid -> can_receive_valid.b

    node idle_to_receiving: And
    connect isIDLE.eq -> idle_to_receiving.a
    connect can_receive_valid.out -> idle_to_receiving.b

    // RECEIVING → BUFFERED: eof && byte_count == 7
    node byte_is_seven: Comparator
    connect byte_count.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b

    node frame_complete: And
    connect eof -> frame_complete.a
    connect byte_is_seven.eq -> frame_complete.b

    node receiving_complete: And
    connect isRECEIVING.eq -> receiving_complete.a
    connect frame_complete.out -> receiving_complete.b

    node receiving_complete_valid: And
    connect receiving_complete.out -> receiving_complete_valid.a
    connect data_valid -> receiving_complete_valid.b

    // BUFFERED → IDLE: grant (packet forwarded)
    node buffered_to_idle: And
    connect isBUFFERED.eq -> buffered_to_idle.a
    connect grant -> buffered_to_idle.b

    // ============================================================================
    // Next State Logic
    // ============================================================================

    // Priority: buffered_to_idle → receiving_complete → idle_to_receiving → stay
    node next_state_m2: Mux
    connect fsm_state.q -> next_state_m2.in0  // Stay in current state
    connect STATE_BUFFERED.out -> next_state_m2.in1
    connect receiving_complete_valid.out -> next_state_m2.sel

    node next_state_m1: Mux
    connect next_state_m2.out -> next_state_m1.in0
    connect STATE_RECEIVING.out -> next_state_m1.in1
    connect idle_to_receiving.out -> next_state_m1.sel

    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_IDLE.out -> next_state.in1
    connect buffered_to_idle.out -> next_state.sel

    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we

    // ============================================================================
    // Byte Counter Logic
    // ============================================================================

    // Increment byte_count when receiving and data_valid
    node byte_inc: Adder
    connect byte_count.q -> byte_inc.a
    connect ONE.out -> byte_inc.b

    node should_count: And
    connect isRECEIVING.eq -> should_count.a
    connect data_valid -> should_count.b

    // Reset to 0 when not receiving, otherwise increment
    node next_byte_count: Mux
    connect ZERO.out -> next_byte_count.in0
    connect byte_inc.sum -> next_byte_count.in1
    connect should_count.out -> next_byte_count.sel

    connect next_byte_count.out -> byte_count.data
    node byte_count_we: Input(value=1)
    connect byte_count_we.out -> byte_count.we

    // ============================================================================
    // Write Pointer Logic
    // ============================================================================

    // Increment write_ptr by 8 when packet complete and forwarded
    node ptr_add_eight: Adder
    connect write_ptr_reg.q -> ptr_add_eight.a
    connect EIGHT.out -> ptr_add_eight.b

    node should_advance_ptr: And
    connect buffered_to_idle.out -> should_advance_ptr.a
    connect buffered_to_idle.out -> should_advance_ptr.b  // Just use grant signal

    node next_write_ptr_val: Mux
    connect write_ptr_reg.q -> next_write_ptr_val.in0  // Stay
    connect ptr_add_eight.sum -> next_write_ptr_val.in1  // Advance by 8
    connect should_advance_ptr.out -> next_write_ptr_val.sel

    connect next_write_ptr_val.out -> write_ptr_reg.data
    node write_ptr_reg_we: Input(value=1)
    connect write_ptr_reg_we.out -> write_ptr_reg.we

    // ============================================================================
    // Packet Counter Logic
    // ============================================================================

    // Increment when packet received, decrement when packet forwarded
    node pkt_inc: Adder
    connect pkt_count.q -> pkt_inc.a
    connect ONE.out -> pkt_inc.b

    node pkt_dec: Adder
    connect pkt_count.q -> pkt_dec.a
    node MINUS_ONE: Input(value=255)  // 255 (for subtraction)
    connect MINUS_ONE.out -> pkt_dec.b

    // Increment on receiving_complete
    node next_pkt_count_inc: Mux
    connect pkt_count.q -> next_pkt_count_inc.in0
    connect pkt_inc.sum -> next_pkt_count_inc.in1
    connect receiving_complete_valid.out -> next_pkt_count_inc.sel

    // Decrement on buffered_to_idle
    node next_pkt_count: Mux
    connect next_pkt_count_inc.out -> next_pkt_count.in0
    connect pkt_dec.sum -> next_pkt_count.in1
    connect buffered_to_idle.out -> next_pkt_count.sel

    connect next_pkt_count.out -> pkt_count.data
    node pkt_count_we: Input(value=1)
    connect pkt_count_we.out -> pkt_count.we

    // ============================================================================
    // RAM Interface
    // ============================================================================

    // RAM address = write_ptr + byte_count
    node buf_addr_calc: Adder
    connect write_ptr_reg.q -> buf_addr_calc.a
    connect byte_count.q -> buf_addr_calc.b

    // RAM data = data_in
    // RAM write enable = isRECEIVING && data_valid
    node buf_we_signal: And
    connect isRECEIVING.eq -> buf_we_signal.a
    connect data_valid -> buf_we_signal.b

    // ============================================================================
    // Outputs (wired to formal output ports)
    // ============================================================================

    // RAM interface outputs
    connect buf_addr_calc.sum -> buf_addr
    connect data_in -> buf_data
    connect buf_we_signal.out -> buf_we

    // Buffer status outputs
    connect buf_full_cmp.eq -> buf_full

    // pkt_ready = isBUFFERED || (pkt_count > 0) - registered to break feedback loop
    node pkt_count_nonzero: Comparator
    connect pkt_count.q -> pkt_count_nonzero.a
    connect ZERO.out -> pkt_count_nonzero.b

    node pkt_ready_signal: Or
    connect isBUFFERED.eq -> pkt_ready_signal.a
    connect pkt_count_nonzero.gt -> pkt_ready_signal.b

    connect pkt_ready_signal.out -> pkt_ready_reg.data
    node pkt_ready_we: Input(value=1)
    connect pkt_ready_we.out -> pkt_ready_reg.we
    connect pkt_ready_reg.q -> pkt_ready

    // Expose write pointer for forwarder
    connect write_ptr_reg.q -> write_ptr

    // Debug displays
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in

    node pkt_count_display: HexDisplay
    connect pkt_count.q -> pkt_count_display.in

    node write_ptr_debug: HexDisplay
    connect write_ptr_reg.q -> write_ptr_debug.in
  }
}
