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
