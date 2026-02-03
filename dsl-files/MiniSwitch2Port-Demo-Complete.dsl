circuit MacRxParser {
  // ============================================================================
  // MAC RX Parser - Ethernet Frame Boundary Detection
  // ============================================================================
  // Detects preamble (7 × 0x55) + SFD (0xD5) and generates frame boundaries
  // Inputs: raw byte stream (byte_in, valid)
  // Outputs: frame data with sof/eof markers
  //
  // States: IDLE(0) → PREAMBLE_SYNC(1) → WAIT_SFD(2) → IN_FRAME(3)
  // ============================================================================

  // Formal port declarations
  input byte_in: Bus[8]
  input valid: Bit
  clock clk

  output data_out: Bus[8]
  output sof: Bit
  output eof: Bit
  output data_valid: Bit
  output error: Bit

  impl {

    // State registers (FSM state, counters)
    node fsm_state: Register      // FSM state: 0=IDLE, 1=PREAMBLE, 2=WAIT_SFD, 3=IN_FRAME
    node preamble_count: Register  // Count preamble bytes (0-7)
    node byte_count: Register      // Count frame bytes (0-7)

    // State constants
    node STATE_IDLE: Input(value=0)
    node STATE_PREAMBLE_SYNC: Input(value=1)
    node STATE_WAIT_SFD: Input(value=2)
    node STATE_IN_FRAME: Input(value=3)

    // Preamble/SFD constants
    node PREAMBLE_BYTE: Input(value=85)   // 0x55
    node SFD_BYTE: Input(value=213)       // 0xD5
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)

    // Numeric constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SIX: Input(value=6)

    // ============================================================================
    // State Detection (Comparators)
    // ============================================================================
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b

    node isPREAMBLE_SYNC: Comparator
    connect fsm_state.q -> isPREAMBLE_SYNC.a
    connect STATE_PREAMBLE_SYNC.out -> isPREAMBLE_SYNC.b

    node isWAIT_SFD: Comparator
    connect fsm_state.q -> isWAIT_SFD.a
    connect STATE_WAIT_SFD.out -> isWAIT_SFD.b

    node isIN_FRAME: Comparator
    connect fsm_state.q -> isIN_FRAME.a
    connect STATE_IN_FRAME.out -> isIN_FRAME.b

    // ============================================================================
    // Byte Matching (Detect preamble and SFD bytes)
    // ============================================================================
    node isPreambleByte: Comparator
    connect byte_in -> isPreambleByte.a
    connect PREAMBLE_BYTE.out -> isPreambleByte.b

    node isSFDByte: Comparator
    connect byte_in -> isSFDByte.a
    connect SFD_BYTE.out -> isSFDByte.b

    // ============================================================================
    // Counter Logic
    // ============================================================================

    // Preamble count increment
    node preamble_inc: Adder
    connect preamble_count.q -> preamble_inc.a
    connect ONE.out -> preamble_inc.b

    node preamble_is_seven: Comparator
    connect preamble_count.q -> preamble_is_seven.a
    connect SIX.out -> preamble_is_seven.b

    // Byte count increment
    node byte_inc: Adder
    connect byte_count.q -> byte_inc.a
    connect ONE.out -> byte_inc.b

    node byte_is_seven: Comparator
    connect byte_count.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b

    node byte_is_zero: Comparator
    connect byte_count.q -> byte_is_zero.a
    connect ZERO.out -> byte_is_zero.b

    // ============================================================================
    // State Transitions (Next State Logic)
    // ============================================================================

    // IDLE → PREAMBLE_SYNC (when valid && byte == 0x55)
    node idle_to_preamble: And
    connect valid -> idle_to_preamble.a
    connect isPreambleByte.eq -> idle_to_preamble.b

    node idle_transition: And
    connect isIDLE.eq -> idle_transition.a
    connect idle_to_preamble.out -> idle_transition.b

    // PREAMBLE_SYNC → WAIT_SFD (when count == 6 AND byte is preamble, after 7 preambles received)
    node preamble_count_full: And
    connect isPREAMBLE_SYNC.eq -> preamble_count_full.a
    connect preamble_is_seven.eq -> preamble_count_full.b

    node preamble_to_wait: And
    connect preamble_count_full.out -> preamble_to_wait.a
    connect isPreambleByte.eq -> preamble_to_wait.b

    node preamble_to_wait_match: And
    connect preamble_to_wait.out -> preamble_to_wait_match.a
    connect valid -> preamble_to_wait_match.b

    // PREAMBLE_SYNC → IDLE (preamble broken - only if we haven't received 7 preambles yet)
    node not_preamble_byte: Not
    connect isPreambleByte.eq -> not_preamble_byte.in

    node preamble_incomplete: Comparator
    connect preamble_count.q -> preamble_incomplete.a
    connect SIX.out -> preamble_incomplete.b

    node preamble_bad_byte: And
    connect not_preamble_byte.out -> preamble_bad_byte.a
    connect preamble_incomplete.lt -> preamble_bad_byte.b

    node preamble_broken: And
    connect isPREAMBLE_SYNC.eq -> preamble_broken.a
    connect preamble_bad_byte.out -> preamble_broken.b

    node preamble_reset: And
    connect preamble_broken.out -> preamble_reset.a
    connect valid -> preamble_reset.b

    // PREAMBLE_SYNC → IN_FRAME (direct, when count>=6 and byte==SFD)
    node preamble_got_sfd: And
    connect preamble_is_seven.eq -> preamble_got_sfd.a
    connect isSFDByte.eq -> preamble_got_sfd.b

    node preamble_complete: And
    connect isPREAMBLE_SYNC.eq -> preamble_complete.a
    connect preamble_got_sfd.out -> preamble_complete.b

    node preamble_to_frame: And
    connect preamble_complete.out -> preamble_to_frame.a
    connect valid -> preamble_to_frame.b

    // WAIT_SFD → IN_FRAME (when byte == 0xD5)
    node sfd_to_frame: And
    connect isWAIT_SFD.eq -> sfd_to_frame.a
    connect isSFDByte.eq -> sfd_to_frame.b

    node sfd_transition: And
    connect sfd_to_frame.out -> sfd_transition.a
    connect valid -> sfd_transition.b

    // WAIT_SFD → IDLE (SFD missing)
    node sfd_missing: And
    connect isWAIT_SFD.eq -> sfd_missing.a
    node not_sfd_byte: Not
    connect isSFDByte.eq -> not_sfd_byte.in
    connect not_sfd_byte.out -> sfd_missing.b

    node sfd_error: And
    connect sfd_missing.out -> sfd_error.a
    connect valid -> sfd_error.b

    // IN_FRAME → IDLE (when byte_count == 7, frame complete)
    node frame_complete: And
    connect isIN_FRAME.eq -> frame_complete.a
    connect byte_is_seven.eq -> frame_complete.b

    node frame_done: And
    connect frame_complete.out -> frame_done.a
    connect valid -> frame_done.b

    // ============================================================================
    // Next State Mux Chain
    // ============================================================================

    // Priority: frame_done → sfd_transition → preamble_to_frame → preamble_to_wait → idle_transition → stay

    // Mux level 5: frame_done? IDLE : (stay in current state)
    node next_state_m5: Mux
    connect fsm_state.q -> next_state_m5.in0  // Stay in current state by default
    connect STATE_IDLE.out -> next_state_m5.in1
    connect frame_done.out -> next_state_m5.sel

    // Mux level 4: sfd_transition? IN_FRAME : next_state_m5
    node next_state_m4: Mux
    connect next_state_m5.out -> next_state_m4.in0
    connect STATE_IN_FRAME.out -> next_state_m4.in1
    connect sfd_transition.out -> next_state_m4.sel

    // Mux level 3: preamble_to_frame? IN_FRAME : next_state_m4  (direct PREAMBLE→FRAME when SFD received)
    node next_state_m3: Mux
    connect next_state_m4.out -> next_state_m3.in0
    connect STATE_IN_FRAME.out -> next_state_m3.in1
    connect preamble_to_frame.out -> next_state_m3.sel

    // Mux level 2: preamble_to_wait? WAIT_SFD : next_state_m3
    node next_state_m2: Mux
    connect next_state_m3.out -> next_state_m2.in0
    connect STATE_WAIT_SFD.out -> next_state_m2.in1
    connect preamble_to_wait_match.out -> next_state_m2.sel

    // Mux level 1: idle_transition? PREAMBLE_SYNC : next_state_m2
    node next_state_m1: Mux
    connect next_state_m2.out -> next_state_m1.in0
    connect STATE_PREAMBLE_SYNC.out -> next_state_m1.in1
    connect idle_transition.out -> next_state_m1.sel

    // Mux level 0: (preamble_reset || sfd_error)? IDLE : next_state_m1
    node error_reset: Or
    connect preamble_reset.out -> error_reset.a
    connect sfd_error.out -> error_reset.b

    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_IDLE.out -> next_state.in1
    connect error_reset.out -> next_state.sel

    // Connect next state to state register
    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)  // Always write
    connect fsm_state_we.out -> fsm_state.we

    // ============================================================================
    // Counter Updates
    // ============================================================================

    // Preamble counter: increment in PREAMBLE_SYNC, reset otherwise
    node preamble_counting: And
    connect isPREAMBLE_SYNC.eq -> preamble_counting.a
    connect valid -> preamble_counting.b

    node next_preamble_count: Mux
    connect ZERO.out -> next_preamble_count.in0
    connect preamble_inc.sum -> next_preamble_count.in1
    connect preamble_counting.out -> next_preamble_count.sel

    connect next_preamble_count.out -> preamble_count.data
    node preamble_count_we: Input(value=1)
    connect preamble_count_we.out -> preamble_count.we

    // Byte counter: increment in IN_FRAME, reset otherwise
    node byte_counting: And
    connect isIN_FRAME.eq -> byte_counting.a
    connect valid -> byte_counting.b

    node next_byte_count: Mux
    connect ZERO.out -> next_byte_count.in0
    connect byte_inc.sum -> next_byte_count.in1
    connect byte_counting.out -> next_byte_count.sel

    connect next_byte_count.out -> byte_count.data
    node byte_count_we: Input(value=1)
    connect byte_count_we.out -> byte_count.we

    // ============================================================================
    // Outputs (wired to formal output ports)
    // ============================================================================

    // data_out: pass through byte_in
    connect byte_in -> data_out

    // sof: assert when byte_count == 0 in IN_FRAME state
    node sof_condition: And
    connect isIN_FRAME.eq -> sof_condition.a
    connect byte_is_zero.eq -> sof_condition.b
    connect sof_condition.out -> sof

    // eof: assert when byte_count == 7 in IN_FRAME state (frame complete)
    connect frame_complete.out -> eof

    // data_valid: valid data only in IN_FRAME state
    node data_valid_signal: And
    connect isIN_FRAME.eq -> data_valid_signal.a
    connect valid -> data_valid_signal.b
    connect data_valid_signal.out -> data_valid

    // error: preamble broken or SFD missing
    connect error_reset.out -> error

    // Debug outputs (state visualization) - keep as displays for debugging
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in

    node preamble_count_display: HexDisplay
    connect preamble_count.q -> preamble_count_display.in

    node byte_count_display: HexDisplay
    connect byte_count.q -> byte_count_display.in
  }
}
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
circuit PacketForwarder2Port {
  // ============================================================================
  // Packet Forwarder - 2-Port Static Routing
  // ============================================================================
  // Reads packets from ingress buffers and forwards to egress buffers
  // Static routing: DA==0 → port 0, DA==1 → port 1, else drop
  // Handles 1-cycle RAM read latency explicitly
  // ============================================================================

  // Formal port declarations
  input grant_port: Bus[8]
  input grant_valid: Bit
  input port0_read_ptr: Bus[8]
  input port1_read_ptr: Bus[8]
  clock clk

  output ingress_addr: Bus[8]
  output ingress_re: Bit
  output egress_addr: Bus[8]
  output egress_we: Bit
  output done: Bit
  output output_port: Bus[8]
  output ingress_port: Bus[8]

  impl {
    // FSM state
    node fsm_state: Register
    node byte_counter: Register    // Which byte we're copying (0-7)
    node output_port_reg: Register // Destination port (0 or 1)
    node ingress_port_reg: Register // Source port (0 or 1)
    node done_reg: Register         // Registered done output (breaks feedback loop)

    // State constants
    node STATE_IDLE: Input(value=0)
    node STATE_READ_HEADER: Input(value=1)
    node STATE_WAIT_HEADER: Input(value=2)
    node STATE_ROUTE: Input(value=3)
    node STATE_COPY_PAYLOAD: Input(value=4)
    node STATE_DONE: Input(value=5)

    // Numeric constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)

    // Header extraction constants
    node DA_MASK: Input(value=240)          // 0xF0 (upper 4 bits)
    node DA_SHIFT: Input(value=4)         // 4 (shift right by 4)

    // ============================================================================
    // State Detection
    // ============================================================================
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b

    node isREAD_HEADER: Comparator
    connect fsm_state.q -> isREAD_HEADER.a
    connect STATE_READ_HEADER.out -> isREAD_HEADER.b

    node isWAIT_HEADER: Comparator
    connect fsm_state.q -> isWAIT_HEADER.a
    connect STATE_WAIT_HEADER.out -> isWAIT_HEADER.b

    node isROUTE: Comparator
    connect fsm_state.q -> isROUTE.a
    connect STATE_ROUTE.out -> isROUTE.b

    node isCOPY_PAYLOAD: Comparator
    connect fsm_state.q -> isCOPY_PAYLOAD.a
    connect STATE_COPY_PAYLOAD.out -> isCOPY_PAYLOAD.b

    node isDONE: Comparator
    connect fsm_state.q -> isDONE.a
    connect STATE_DONE.out -> isDONE.b

    // ============================================================================
    // State Transitions
    // ============================================================================

    // IDLE → READ_HEADER: grant_valid
    node idle_to_read: And
    connect isIDLE.eq -> idle_to_read.a
    connect grant_valid -> idle_to_read.b

    // READ_HEADER → WAIT_HEADER: automatic (1 cycle)
    node read_to_wait: And
    connect isREAD_HEADER.eq -> read_to_wait.a
    connect isREAD_HEADER.eq -> read_to_wait.b  // Always true when in READ_HEADER

    // WAIT_HEADER → ROUTE: automatic (1 cycle wait for RAM)
    node wait_to_route: And
    connect isWAIT_HEADER.eq -> wait_to_route.a
    connect isWAIT_HEADER.eq -> wait_to_route.b

    // ROUTE → COPY_PAYLOAD: if output_port valid
    // ROUTE → DONE: if output_port invalid (drop packet)
    // We'll handle this in the mux below

    // COPY_PAYLOAD → DONE: byte_counter == 7
    node byte_is_seven: Comparator
    connect byte_counter.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b

    node copy_complete: And
    connect isCOPY_PAYLOAD.eq -> copy_complete.a
    connect byte_is_seven.eq -> copy_complete.b

    // DONE → IDLE: automatic
    node done_to_idle: And
    connect isDONE.eq -> done_to_idle.a
    connect isDONE.eq -> done_to_idle.b

    // ============================================================================
    // Next State Logic
    // ============================================================================

    // Build state machine with priority encoding
    node next_state_m5: Mux
    connect fsm_state.q -> next_state_m5.in0  // Default: stay
    connect STATE_IDLE.out -> next_state_m5.in1
    connect done_to_idle.out -> next_state_m5.sel

    node next_state_m4: Mux
    connect next_state_m5.out -> next_state_m4.in0
    connect STATE_DONE.out -> next_state_m4.in1
    connect copy_complete.out -> next_state_m4.sel

    node next_state_m3: Mux
    connect next_state_m4.out -> next_state_m3.in0
    connect STATE_ROUTE.out -> next_state_m3.in1
    connect wait_to_route.out -> next_state_m3.sel

    node next_state_m2: Mux
    connect next_state_m3.out -> next_state_m2.in0
    connect STATE_WAIT_HEADER.out -> next_state_m2.in1
    connect read_to_wait.out -> next_state_m2.sel

    node next_state_m1: Mux
    connect next_state_m2.out -> next_state_m1.in0
    connect STATE_READ_HEADER.out -> next_state_m1.in1
    connect idle_to_read.out -> next_state_m1.sel

    // Special case: ROUTE state branches based on output_port validity
    // If in ROUTE state and output_port is valid, go to COPY_PAYLOAD
    // If in ROUTE state and output_port is invalid, go to DONE (drop)
    // For now, assume all routes are valid (DA 0 or 1)
    node route_to_copy: And
    connect isROUTE.eq -> route_to_copy.a
    connect isROUTE.eq -> route_to_copy.b  // Always proceed to copy

    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_COPY_PAYLOAD.out -> next_state.in1
    connect route_to_copy.out -> next_state.sel

    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we

    // ============================================================================
    // Ingress Port Latch (capture which port was granted)
    // ============================================================================

    node latch_ingress_port: And
    connect idle_to_read.out -> latch_ingress_port.a
    connect idle_to_read.out -> latch_ingress_port.b

    node next_ingress_port_val: Mux
    connect ingress_port_reg.q -> next_ingress_port_val.in0  // Hold
    connect grant_port -> next_ingress_port_val.in1   // Latch new value
    connect latch_ingress_port.out -> next_ingress_port_val.sel

    connect next_ingress_port_val.out -> ingress_port_reg.data
    node ingress_port_reg_we: Input(value=1)
    connect ingress_port_reg_we.out -> ingress_port_reg.we

    // ============================================================================
    // Byte Counter Logic
    // ============================================================================

    node byte_inc: Adder
    connect byte_counter.q -> byte_inc.a
    connect ONE.out -> byte_inc.b

    // Increment when copying
    node should_increment: And
    connect isCOPY_PAYLOAD.eq -> should_increment.a
    connect isCOPY_PAYLOAD.eq -> should_increment.b

    // Reset when entering READ_HEADER
    node should_reset: And
    connect idle_to_read.out -> should_reset.a
    connect idle_to_read.out -> should_reset.b

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
    // Ingress RAM Address Calculation
    // ============================================================================

    // Select read pointer based on ingress_port
    node ingress_is_port0: Comparator
    connect ingress_port_reg.q -> ingress_is_port0.a
    connect ZERO.out -> ingress_is_port0.b

    node selected_read_ptr: Mux
    connect port1_read_ptr -> selected_read_ptr.in0
    connect port0_read_ptr -> selected_read_ptr.in1
    connect ingress_is_port0.eq -> selected_read_ptr.sel

    // ingress_addr = selected_read_ptr + byte_counter
    node ingress_addr_calc: Adder
    connect selected_read_ptr.out -> ingress_addr_calc.a
    connect byte_counter.q -> ingress_addr_calc.b

    // ============================================================================
    // Header Extraction and Routing (placeholder for now)
    // ============================================================================
    // In ROUTE state, we would:
    // 1. Extract DA from header byte (upper 4 bits)
    // 2. Compare DA to 0 and 1
    // 3. Set output_port accordingly
    //
    // For now, we'll use a simplified approach:
    // - Assume ingress_data contains the header byte
    // - Extract DA using bit operations (would need BitSlice or shifter)
    // - For this initial version, route based on ingress_port (loopback test)

    // Simplified routing: output_port = 1 - ingress_port (cross-over)
    node cross_route: Adder
    connect ONE.out -> cross_route.a
    node neg_ingress: Adder
    node MINUS_ONE: Input(value=255)  // 255
    connect ingress_port_reg.q -> neg_ingress.a
    connect MINUS_ONE.out -> neg_ingress.b
    connect neg_ingress.sum -> cross_route.b

    // Latch output_port in ROUTE state
    node latch_output_port: And
    connect wait_to_route.out -> latch_output_port.a
    connect wait_to_route.out -> latch_output_port.b

    node next_output_port_val: Mux
    connect output_port_reg.q -> next_output_port_val.in0
    connect cross_route.sum -> next_output_port_val.in1
    connect latch_output_port.out -> next_output_port_val.sel

    connect next_output_port_val.out -> output_port_reg.data
    node output_port_reg_we: Input(value=1)
    connect output_port_reg_we.out -> output_port_reg.we

    // ============================================================================
    // Egress RAM Address Calculation
    // ============================================================================
    // egress_addr = (output_port * 8) + byte_counter
    // For 2 ports: port 0 writes to 0-7, port 1 writes to 8-15

    node port_offset: LeftShifter
    connect output_port_reg.q -> port_offset.value
    node THREE: Input(value=3)  // Shift by 3 = multiply by 8
    connect THREE.out -> port_offset.shift

    node egress_addr_calc: Adder
    connect port_offset.result -> egress_addr_calc.a
    connect byte_counter.q -> egress_addr_calc.b

    // ============================================================================
    // Outputs (wired to formal output ports)
    // ============================================================================

    // RAM interface outputs
    connect ingress_addr_calc.sum -> ingress_addr
    connect egress_addr_calc.sum -> egress_addr

    // Ingress RAM read enable (active in READ_HEADER, COPY_PAYLOAD)
    node ingress_re_signal: Or
    connect isREAD_HEADER.eq -> ingress_re_signal.a
    connect isCOPY_PAYLOAD.eq -> ingress_re_signal.b
    connect ingress_re_signal.out -> ingress_re

    // Egress RAM write enable (active in COPY_PAYLOAD)
    connect isCOPY_PAYLOAD.eq -> egress_we

    // Done signal (pulse in DONE state) - registered to break feedback loop
    connect isDONE.eq -> done_reg.data
    node done_we: Input(value=1)
    connect done_we.out -> done_reg.we
    connect done_reg.q -> done

    // Port status outputs
    connect output_port_reg.q -> output_port
    connect ingress_port_reg.q -> ingress_port

    // Debug displays
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in

    node byte_counter_display: HexDisplay
    connect byte_counter.q -> byte_counter_display.in

    node output_port_debug: HexDisplay
    connect output_port_reg.q -> output_port_debug.in

    node ingress_port_debug: HexDisplay
    connect ingress_port_reg.q -> ingress_port_debug.in
  }
}
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
circuit PacketGenerator {
  // ============================================================================
  // Packet Generator - Automatic Packet Transmission
  // ============================================================================
  // Automatically generates Ethernet-like packets in a loop:
  // - 7 × preamble (0x55)
  // - 1 × SFD (0xD5)
  // - 8 × packet data
  // - 4 × idle gap
  // Total: 20 cycles per packet, then repeats
  // ============================================================================

  clock clk
  output byte_out: Bus[8]
  output valid: Bit

  impl {
    // Cycle counter (0-19, then wraps)
    node cycle_counter: Register
    node counter_inc: Adder
    connect cycle_counter.q -> counter_inc.a
    node ONE: Input(value=1)
    connect ONE.out -> counter_inc.b

    // Check if counter reached 19 (reset to 0)
    node is_nineteen: Comparator
    connect cycle_counter.q -> is_nineteen.a
    node NINETEEN: Input(value=19)
    connect NINETEEN.out -> is_nineteen.b

    // Next counter value: 0 if at 19, else increment
    node ZERO: Input(value=0)
    node next_counter: Mux
    connect counter_inc.sum -> next_counter.in0
    connect ZERO.out -> next_counter.in1
    connect is_nineteen.eq -> next_counter.sel

    connect next_counter.out -> cycle_counter.data
    node counter_we: Input(value=1)
    connect counter_we.out -> cycle_counter.we

    // ============================================================================
    // Cycle Position Detection
    // ============================================================================

    // Cycles 0-6: Preamble (0x55)
    node is_cycle_0: Comparator
    connect cycle_counter.q -> is_cycle_0.a
    connect ZERO.out -> is_cycle_0.b

    node is_cycle_1: Comparator
    connect cycle_counter.q -> is_cycle_1.a
    connect ONE.out -> is_cycle_1.b

    node is_cycle_2: Comparator
    connect cycle_counter.q -> is_cycle_2.a
    node TWO: Input(value=2)
    connect TWO.out -> is_cycle_2.b

    node is_cycle_3: Comparator
    connect cycle_counter.q -> is_cycle_3.a
    node THREE: Input(value=3)
    connect THREE.out -> is_cycle_3.b

    node is_cycle_4: Comparator
    connect cycle_counter.q -> is_cycle_4.a
    node FOUR: Input(value=4)
    connect FOUR.out -> is_cycle_4.b

    node is_cycle_5: Comparator
    connect cycle_counter.q -> is_cycle_5.a
    node FIVE: Input(value=5)
    connect FIVE.out -> is_cycle_5.b

    node is_cycle_6: Comparator
    connect cycle_counter.q -> is_cycle_6.a
    node SIX: Input(value=6)
    connect SIX.out -> is_cycle_6.b

    // Is preamble cycle?
    node is_preamble_0_1: Or
    connect is_cycle_0.eq -> is_preamble_0_1.a
    connect is_cycle_1.eq -> is_preamble_0_1.b

    node is_preamble_2_3: Or
    connect is_cycle_2.eq -> is_preamble_2_3.a
    connect is_cycle_3.eq -> is_preamble_2_3.b

    node is_preamble_4_5: Or
    connect is_cycle_4.eq -> is_preamble_4_5.a
    connect is_cycle_5.eq -> is_preamble_4_5.b

    node is_preamble_01_23: Or
    connect is_preamble_0_1.out -> is_preamble_01_23.a
    connect is_preamble_2_3.out -> is_preamble_01_23.b

    node is_preamble_45_6: Or
    connect is_preamble_4_5.out -> is_preamble_45_6.a
    connect is_cycle_6.eq -> is_preamble_45_6.b

    node is_preamble: Or
    connect is_preamble_01_23.out -> is_preamble.a
    connect is_preamble_45_6.out -> is_preamble.b

    // Cycle 7: SFD (0xD5)
    node is_cycle_7: Comparator
    connect cycle_counter.q -> is_cycle_7.a
    node SEVEN: Input(value=7)
    connect SEVEN.out -> is_cycle_7.b

    // Cycles 8-15: Packet data
    node is_cycle_8: Comparator
    connect cycle_counter.q -> is_cycle_8.a
    node EIGHT: Input(value=8)
    connect EIGHT.out -> is_cycle_8.b

    node is_cycle_9: Comparator
    connect cycle_counter.q -> is_cycle_9.a
    node NINE: Input(value=9)
    connect NINE.out -> is_cycle_9.b

    node is_cycle_10: Comparator
    connect cycle_counter.q -> is_cycle_10.a
    node TEN: Input(value=10)
    connect TEN.out -> is_cycle_10.b

    node is_cycle_11: Comparator
    connect cycle_counter.q -> is_cycle_11.a
    node ELEVEN: Input(value=11)
    connect ELEVEN.out -> is_cycle_11.b

    node is_cycle_12: Comparator
    connect cycle_counter.q -> is_cycle_12.a
    node TWELVE: Input(value=12)
    connect TWELVE.out -> is_cycle_12.b

    node is_cycle_13: Comparator
    connect cycle_counter.q -> is_cycle_13.a
    node THIRTEEN: Input(value=13)
    connect THIRTEEN.out -> is_cycle_13.b

    node is_cycle_14: Comparator
    connect cycle_counter.q -> is_cycle_14.a
    node FOURTEEN: Input(value=14)
    connect FOURTEEN.out -> is_cycle_14.b

    node is_cycle_15: Comparator
    connect cycle_counter.q -> is_cycle_15.a
    node FIFTEEN: Input(value=15)
    connect FIFTEEN.out -> is_cycle_15.b

    // Cycles 16-19: Idle gap
    // (valid will be 0, so no need to detect specifically)

    // ============================================================================
    // Valid Signal: 1 during cycles 0-15, 0 during 16-19
    // ============================================================================
    node is_lt_sixteen: Comparator
    connect cycle_counter.q -> is_lt_sixteen.a
    node SIXTEEN: Input(value=16)
    connect SIXTEEN.out -> is_lt_sixteen.b

    connect is_lt_sixteen.lt -> valid

    // ============================================================================
    // Byte Output Mux Chain
    // ============================================================================

    // Packet data values
    node DATA_0: Input(value=0xAA)  // Byte 0
    node DATA_1: Input(value=0xBB)  // Byte 1
    node DATA_2: Input(value=0xCC)  // Byte 2
    node DATA_3: Input(value=0xDD)  // Byte 3
    node DATA_4: Input(value=0xEE)  // Byte 4
    node DATA_5: Input(value=0xFF)  // Byte 5
    node DATA_6: Input(value=0x11)  // Byte 6
    node DATA_7: Input(value=0x22)  // Byte 7

    // Preamble and SFD constants
    node PREAMBLE_BYTE: Input(value=85)   // 0x55
    node SFD_BYTE: Input(value=213)       // 0xD5

    // Mux chain for packet data (cycles 8-15)
    node data_mux_7: Mux
    connect DATA_7.out -> data_mux_7.in0
    connect DATA_7.out -> data_mux_7.in1  // Default
    connect is_cycle_15.eq -> data_mux_7.sel

    node data_mux_6: Mux
    connect data_mux_7.out -> data_mux_6.in0
    connect DATA_6.out -> data_mux_6.in1
    connect is_cycle_14.eq -> data_mux_6.sel

    node data_mux_5: Mux
    connect data_mux_6.out -> data_mux_5.in0
    connect DATA_5.out -> data_mux_5.in1
    connect is_cycle_13.eq -> data_mux_5.sel

    node data_mux_4: Mux
    connect data_mux_5.out -> data_mux_4.in0
    connect DATA_4.out -> data_mux_4.in1
    connect is_cycle_12.eq -> data_mux_4.sel

    node data_mux_3: Mux
    connect data_mux_4.out -> data_mux_3.in0
    connect DATA_3.out -> data_mux_3.in1
    connect is_cycle_11.eq -> data_mux_3.sel

    node data_mux_2: Mux
    connect data_mux_3.out -> data_mux_2.in0
    connect DATA_2.out -> data_mux_2.in1
    connect is_cycle_10.eq -> data_mux_2.sel

    node data_mux_1: Mux
    connect data_mux_2.out -> data_mux_1.in0
    connect DATA_1.out -> data_mux_1.in1
    connect is_cycle_9.eq -> data_mux_1.sel

    node data_mux_0: Mux
    connect data_mux_1.out -> data_mux_0.in0
    connect DATA_0.out -> data_mux_0.in1
    connect is_cycle_8.eq -> data_mux_0.sel

    // Top-level mux: preamble, SFD, or data?
    node sfd_or_data: Mux
    connect data_mux_0.out -> sfd_or_data.in0
    connect SFD_BYTE.out -> sfd_or_data.in1
    connect is_cycle_7.eq -> sfd_or_data.sel

    node byte_out_mux: Mux
    connect sfd_or_data.out -> byte_out_mux.in0
    connect PREAMBLE_BYTE.out -> byte_out_mux.in1
    connect is_preamble.out -> byte_out_mux.sel

    connect byte_out_mux.out -> byte_out
  }
}
circuit MiniSwitch2Port_Demo {
  // ============================================================================
  // MiniSwitch2Port - AUTOMATIC DEMONSTRATION VERSION
  // ============================================================================
  // This version uses PacketGenerator to automatically send packets on port 0.
  // Just click "Run" and watch packets flow through the system!
  //
  // What to observe:
  // - debug_grant_valid LED: lights up when arbiter grants access
  // - debug_ingress0_ready LED: lights up when packet is buffered
  // - p1_valid_out LED: lights up when packet is transmitted to port 1
  // - p1_out HexDisplay: shows packet bytes being transmitted
  // ============================================================================

  impl {
    // ========================================================================
    // Automatic Packet Generator on Port 0
    // ========================================================================
    node packet_gen: PacketGenerator

    // Port 1 idle (no input)
    node p1_byte: Input(value=0)
    node p1_valid: Input(value=0)

    // Constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node EIGHT: Input(value=8)

    // ========================================================================
    // Component Instantiation
    // ========================================================================

    // MAC RX Parsers
    node parser0: MacRxParser
    node parser1: MacRxParser

    // Ingress Controllers
    node ingress0: IngressController
    node ingress1: IngressController

    // Ingress Buffers (dual-port RAMs)
    node ram_ingress0: DualPortRAM
    node ram_ingress1: DualPortRAM

    // Arbiter
    node arbiter: SimpleArbiter2Port

    // Forwarder
    node forwarder: PacketForwarder2Port

    // Egress Buffers (dual-port RAMs)
    node ram_egress0: DualPortRAM
    node ram_egress1: DualPortRAM

    // Egress Controllers
    node egress0: EgressController
    node egress1: EgressController

    // ========================================================================
    // Port 0 Ingress Path: PacketGenerator → Parser → IngressController → RAM
    // ========================================================================

    connect packet_gen.byte_out -> parser0.byte_in
    connect packet_gen.valid -> parser0.valid

    connect parser0.data_out -> ingress0.data_in
    connect parser0.sof -> ingress0.sof
    connect parser0.eof -> ingress0.eof
    connect parser0.data_valid -> ingress0.data_valid

    // Ingress RAM0 Port A (write by IngressController0)
    connect ingress0.buf_addr -> ram_ingress0.addrA
    connect parser0.data_out -> ram_ingress0.dataA
    connect ingress0.buf_we -> ram_ingress0.weA

    // ========================================================================
    // Port 1 Ingress Path: External → Parser → IngressController → RAM
    // ========================================================================

    connect p1_byte.out -> parser1.byte_in
    connect p1_valid.out -> parser1.valid

    connect parser1.data_out -> ingress1.data_in
    connect parser1.sof -> ingress1.sof
    connect parser1.eof -> ingress1.eof
    connect parser1.data_valid -> ingress1.data_valid

    // Ingress RAM1 Port A (write by IngressController1)
    connect ingress1.buf_addr -> ram_ingress1.addrA
    connect parser1.data_out -> ram_ingress1.dataA
    connect ingress1.buf_we -> ram_ingress1.weA

    // ========================================================================
    // Arbiter Connections: IngressControllers → Arbiter → Forwarder
    // ========================================================================

    connect ingress0.pkt_ready -> arbiter.port0_ready
    connect ingress1.pkt_ready -> arbiter.port1_ready
    connect forwarder.done -> arbiter.forwarder_done

    connect arbiter.grant_port -> forwarder.grant_port
    connect arbiter.grant_valid -> forwarder.grant_valid

    // Grant signal demux: arbiter.grant_valid goes to the granted port only
    node grant_is_port0: Comparator
    connect arbiter.grant_port -> grant_is_port0.a
    connect ZERO.out -> grant_is_port0.b

    node grant_to_port0: And
    connect arbiter.grant_valid -> grant_to_port0.a
    connect grant_is_port0.eq -> grant_to_port0.b

    connect grant_to_port0.out -> ingress0.grant

    node grant_is_port1: Comparator
    connect arbiter.grant_port -> grant_is_port1.a
    connect ONE.out -> grant_is_port1.b

    node grant_to_port1: And
    connect arbiter.grant_valid -> grant_to_port1.a
    connect grant_is_port1.eq -> grant_to_port1.b

    connect grant_to_port1.out -> ingress1.grant

    // ========================================================================
    // Forwarder ↔ Ingress RAMs: Read from Port B
    // ========================================================================

    // Forwarder provides read pointers
    connect ZERO.out -> forwarder.port0_read_ptr
    connect ZERO.out -> forwarder.port1_read_ptr

    // Both ingress RAMs connected to same address
    connect forwarder.ingress_addr -> ram_ingress0.addrB
    connect forwarder.ingress_addr -> ram_ingress1.addrB

    // Mux RAM data outputs based on which port was granted
    node ingress_data_mux: Mux
    connect ram_ingress1.dataB -> ingress_data_mux.in0
    connect ram_ingress0.dataB -> ingress_data_mux.in1
    connect grant_is_port0.eq -> ingress_data_mux.sel

    // ========================================================================
    // Forwarder ↔ Egress RAMs: Write to Port A
    // ========================================================================

    // Both egress RAMs receive same address from forwarder
    connect forwarder.egress_addr -> ram_egress0.addrA
    connect forwarder.egress_addr -> ram_egress1.addrA

    // Both receive same data (from ingress_data_mux)
    connect ingress_data_mux.out -> ram_egress0.dataA
    connect ingress_data_mux.out -> ram_egress1.dataA

    // Write enable demux: write to the egress RAM matching output_port
    node output_is_port0: Comparator
    connect forwarder.output_port -> output_is_port0.a
    connect ZERO.out -> output_is_port0.b

    node egress0_we: And
    connect forwarder.egress_we -> egress0_we.a
    connect output_is_port0.eq -> egress0_we.b

    connect egress0_we.out -> ram_egress0.weA

    node output_is_port1: Comparator
    connect forwarder.output_port -> output_is_port1.a
    connect ONE.out -> output_is_port1.b

    node egress1_we: And
    connect forwarder.egress_we -> egress1_we.a
    connect output_is_port1.eq -> egress1_we.b

    connect egress1_we.out -> ram_egress1.weA

    // ========================================================================
    // Forwarder → Egress Controllers: Trigger demux
    // ========================================================================

    node egress0_trigger: And
    connect forwarder.done -> egress0_trigger.a
    connect output_is_port0.eq -> egress0_trigger.b

    connect egress0_trigger.out -> egress0.trigger

    node egress1_trigger: And
    connect forwarder.done -> egress1_trigger.a
    connect output_is_port1.eq -> egress1_trigger.b

    connect egress1_trigger.out -> egress1.trigger

    // pkt_ready for egress controllers (always ready)
    node always_ready: Input(value=1)
    connect always_ready.out -> egress0.pkt_ready
    connect always_ready.out -> egress1.pkt_ready

    // ========================================================================
    // Egress Controllers ↔ Egress RAMs: Read from Port B
    // ========================================================================

    connect egress0.egress_addr -> ram_egress0.addrB
    connect egress1.egress_addr -> ram_egress1.addrB

    // ========================================================================
    // Output Displays: Egress Controllers → HexDisplays and LEDs
    // ========================================================================

    node p0_out: HexDisplay
    connect ram_egress0.dataB -> p0_out.in

    node p0_valid_out: Led
    connect egress0.data_valid -> p0_valid_out.in

    node p0_sof: Led
    connect egress0.sof -> p0_sof.in

    node p0_eof: Led
    connect egress0.eof -> p0_eof.in

    node p1_out: HexDisplay
    connect ram_egress1.dataB -> p1_out.in

    node p1_valid_out: Led
    connect egress1.data_valid -> p1_valid_out.in

    node p1_sof: Led
    connect egress1.sof -> p1_sof.in

    node p1_eof: Led
    connect egress1.eof -> p1_eof.in

    // ========================================================================
    // Debug Displays - WATCH THESE!
    // ========================================================================

    node debug_grant_port: HexDisplay
    connect arbiter.grant_port -> debug_grant_port.in

    node debug_grant_valid: Led
    connect arbiter.grant_valid -> debug_grant_valid.in

    node debug_forwarder_ingress_port: HexDisplay
    connect forwarder.ingress_port -> debug_forwarder_ingress_port.in

    node debug_forwarder_output_port: HexDisplay
    connect forwarder.output_port -> debug_forwarder_output_port.in

    node debug_ingress0_ready: Led
    connect ingress0.pkt_ready -> debug_ingress0_ready.in

    node debug_ingress1_ready: Led
    connect ingress1.pkt_ready -> debug_ingress1_ready.in

    // Additional debug: Show packet generator activity
    node debug_gen_byte: HexDisplay
    connect packet_gen.byte_out -> debug_gen_byte.in

    node debug_gen_valid: Led
    connect packet_gen.valid -> debug_gen_valid.in
  }
}
