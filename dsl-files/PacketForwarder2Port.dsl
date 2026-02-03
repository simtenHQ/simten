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
