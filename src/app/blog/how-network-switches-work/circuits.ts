/**
 * Circuit definitions for the "How Network Switches Work" blog post.
 *
 * Each circuit builds toward the full 2-port packet switch, from frame
 * detection and buffering to arbitration, routing, and serialization.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

export const SWITCH_CIRCUITS: Record<string, BlogCircuit> = {
  frameDetector: {
    name: "Frame Detector",
    description:
      "Detects the start of an Ethernet frame by matching a preamble byte (0x55) followed by Start-of-Frame Delimiter (0xD5).",
    displayDsl: `circuit FrameDetector {
  clock clk
  impl {
    node byteIn: Input(value=85)
    node valid: Switch

    node state: Register(initial=0)
    connect clk -> state.clk

    node PREAMBLE: Constant(value=85)
    node SFD: Constant(value=213)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)

    node isPreamble: Comparator
    connect byteIn.out -> isPreamble.a
    connect PREAMBLE.out -> isPreamble.b

    node isSFD: Comparator
    connect byteIn.out -> isSFD.a
    connect SFD.out -> isSFD.b

    node isIdle: Comparator
    connect state.q -> isIdle.a
    connect zero.out -> isIdle.b

    node isWaiting: Comparator
    connect state.q -> isWaiting.a
    connect one.out -> isWaiting.b

    node isActive: Comparator
    connect state.q -> isActive.a
    connect two.out -> isActive.b

    node gotPreamble: And
    connect isIdle.eq -> gotPreamble.a
    connect isPreamble.eq -> gotPreamble.b

    node gotPreambleValid: And
    connect gotPreamble.out -> gotPreambleValid.a
    connect valid.out -> gotPreambleValid.b

    node gotSFD: And
    connect isWaiting.eq -> gotSFD.a
    connect isSFD.eq -> gotSFD.b

    node gotSFDValid: And
    connect gotSFD.out -> gotSFDValid.a
    connect valid.out -> gotSFDValid.b

    node next1: Mux
    connect state.q -> next1.in0
    connect one.out -> next1.in1
    connect gotPreambleValid.out -> next1.sel

    node next2: Mux
    connect next1.out -> next2.in0
    connect two.out -> next2.in1
    connect gotSFDValid.out -> next2.sel

    connect next2.out -> state.data
    node we: Input(value=1)
    connect we.out -> state.we

    node stateDisplay: HexDisplay
    connect state.q -> stateDisplay.in

    node frameLed: Led
    connect isActive.eq -> frameLed.in
  }
}`,
    dsl: `
circuit FrameDetector {
  clock clk
  impl {
    node byteIn: Input(value=85)
    node valid: Switch

    node state: Register(initial=0)
    connect clk -> state.clk

    node PREAMBLE: Constant(value=85)
    node SFD: Constant(value=213)
    node zero: Constant(value=0)
    node one: Constant(value=1)
    node two: Constant(value=2)

    node isPreamble: Comparator
    connect byteIn.out -> isPreamble.a
    connect PREAMBLE.out -> isPreamble.b

    node isSFD: Comparator
    connect byteIn.out -> isSFD.a
    connect SFD.out -> isSFD.b

    node isIdle: Comparator
    connect state.q -> isIdle.a
    connect zero.out -> isIdle.b

    node isWaiting: Comparator
    connect state.q -> isWaiting.a
    connect one.out -> isWaiting.b

    node isActive: Comparator
    connect state.q -> isActive.a
    connect two.out -> isActive.b

    node gotPreamble: And
    connect isIdle.eq -> gotPreamble.a
    connect isPreamble.eq -> gotPreamble.b

    node gotPreambleValid: And
    connect gotPreamble.out -> gotPreambleValid.a
    connect valid.out -> gotPreambleValid.b

    node gotSFD: And
    connect isWaiting.eq -> gotSFD.a
    connect isSFD.eq -> gotSFD.b

    node gotSFDValid: And
    connect gotSFD.out -> gotSFDValid.a
    connect valid.out -> gotSFDValid.b

    node next1: Mux
    connect state.q -> next1.in0
    connect one.out -> next1.in1
    connect gotPreambleValid.out -> next1.sel

    node next2: Mux
    connect next1.out -> next2.in0
    connect two.out -> next2.in1
    connect gotSFDValid.out -> next2.sel

    connect next2.out -> state.data
    node we: Input(value=1)
    connect we.out -> state.we

    node stateDisplay: HexDisplay
    connect state.q -> stateDisplay.in

    node frameLed: Led
    connect isActive.eq -> frameLed.in
  }
}`,
  },

  packetBuffer: {
    name: "Packet Buffer",
    description:
      "Stores incoming bytes in DualPortRAM as they arrive. A write pointer register tracks the next free address.",
    displayDsl: `circuit PacketBuffer {
  clock clk
  impl {
    node dataIn: Input(value=42)
    node writeCmd: Switch

    node writePtr: Register(initial=0)
    connect clk -> writePtr.clk

    node one: Constant(value=1)
    node ram: DualPortRAM
    connect clk -> ram.clk

    connect writePtr.q -> ram.addrA
    connect dataIn.out -> ram.dataA
    connect writeCmd.out -> ram.weA

    node nextPtr: Adder
    connect writePtr.q -> nextPtr.a
    connect one.out -> nextPtr.b

    connect nextPtr.sum -> writePtr.data
    connect writeCmd.out -> writePtr.we

    node readAddr: Input(value=0)
    connect readAddr.out -> ram.addrB

    node readback: HexDisplay
    connect ram.dataB -> readback.in

    node ptrDisplay: HexDisplay
    connect writePtr.q -> ptrDisplay.in
  }
}`,
    dsl: `
circuit PacketBuffer {
  clock clk
  impl {
    node dataIn: Input(value=42)
    node writeCmd: Switch

    node writePtr: Register(initial=0)
    connect clk -> writePtr.clk

    node one: Constant(value=1)
    node ram: DualPortRAM
    connect clk -> ram.clk

    connect writePtr.q -> ram.addrA
    connect dataIn.out -> ram.dataA
    connect writeCmd.out -> ram.weA

    node nextPtr: Adder
    connect writePtr.q -> nextPtr.a
    connect one.out -> nextPtr.b

    connect nextPtr.sum -> writePtr.data
    connect writeCmd.out -> writePtr.we

    node readAddr: Input(value=0)
    connect readAddr.out -> ram.addrB

    node readback: HexDisplay
    connect ram.dataB -> readback.in

    node ptrDisplay: HexDisplay
    connect writePtr.q -> ptrDisplay.in
  }
}`,
  },

  portArbiter: {
    name: "Port Arbiter",
    description:
      "Decides which port gets to send next. When both ports have packets ready, it alternates fairly between them.",
    displayDsl: `circuit PortArbiter {
  impl {
    node port0_ready: Switch
    node port1_ready: Switch
    node lastPort: Input(value=0)

    node zero: Constant(value=0)
    node one: Constant(value=1)

    node lastWas0: Comparator
    connect lastPort.out -> lastWas0.a
    connect zero.out -> lastWas0.b

    node prefer1: And
    connect lastWas0.eq -> prefer1.a
    connect port1_ready.out -> prefer1.b

    node notPort1: Not
    connect port1_ready.out -> notPort1.in

    node fallback0: And
    connect lastWas0.eq -> fallback0.a
    connect notPort1.out -> fallback0.b

    node fallback0Ready: And
    connect fallback0.out -> fallback0Ready.a
    connect port0_ready.out -> fallback0Ready.b

    node lastWas1: Comparator
    connect lastPort.out -> lastWas1.a
    connect one.out -> lastWas1.b

    node prefer0: And
    connect lastWas1.eq -> prefer0.a
    connect port0_ready.out -> prefer0.b

    node grant0: Or
    connect prefer0.out -> grant0.a
    connect fallback0Ready.out -> grant0.b

    node grant1: Or
    connect prefer1.out -> grant1.a

    node grantValid: Or
    connect grant0.out -> grantValid.a
    connect grant1.out -> grantValid.b

    node grantPort: Mux
    connect zero.out -> grantPort.in0
    connect one.out -> grantPort.in1
    connect grant1.out -> grantPort.sel

    node portDisplay: HexDisplay
    connect grantPort.out -> portDisplay.in

    node validLed: Led
    connect grantValid.out -> validLed.in
  }
}`,
    dsl: `
circuit PortArbiter {
  impl {
    node port0_ready: Switch
    node port1_ready: Switch
    node lastPort: Input(value=0)

    node zero: Constant(value=0)
    node one: Constant(value=1)

    node lastWas0: Comparator
    connect lastPort.out -> lastWas0.a
    connect zero.out -> lastWas0.b

    node prefer1: And
    connect lastWas0.eq -> prefer1.a
    connect port1_ready.out -> prefer1.b

    node notPort1: Not
    connect port1_ready.out -> notPort1.in

    node fallback0: And
    connect lastWas0.eq -> fallback0.a
    connect notPort1.out -> fallback0.b

    node fallback0Ready: And
    connect fallback0.out -> fallback0Ready.a
    connect port0_ready.out -> fallback0Ready.b

    node lastWas1: Comparator
    connect lastPort.out -> lastWas1.a
    connect one.out -> lastWas1.b

    node prefer0: And
    connect lastWas1.eq -> prefer0.a
    connect port0_ready.out -> prefer0.b

    node grant0: Or
    connect prefer0.out -> grant0.a
    connect fallback0Ready.out -> grant0.b

    node grant1: Or
    connect prefer1.out -> grant1.a

    node grantValid: Or
    connect grant0.out -> grantValid.a
    connect grant1.out -> grantValid.b

    node grantPort: Mux
    connect zero.out -> grantPort.in0
    connect one.out -> grantPort.in1
    connect grant1.out -> grantPort.sel

    node portDisplay: HexDisplay
    connect grantPort.out -> portDisplay.in

    node validLed: Led
    connect grantValid.out -> validLed.in
  }
}`,
  },

  crossbarRouter: {
    name: "Crossbar Router",
    description:
      "Routes packets to the opposite port: port 0 sends to port 1 and vice versa. A comparator and mux implement the cross-over logic.",
    displayDsl: `circuit CrossbarRouter {
  impl {
    node sourcePort: Input(value=0)

    node zero: Constant(value=0)
    node one: Constant(value=1)

    node isPort0: Comparator
    connect sourcePort.out -> isPort0.a
    connect zero.out -> isPort0.b

    node destPort: Mux
    connect zero.out -> destPort.in0
    connect one.out -> destPort.in1
    connect isPort0.eq -> destPort.sel

    node destDisplay: HexDisplay
    connect destPort.out -> destDisplay.in

    node srcDisplay: HexDisplay
    connect sourcePort.out -> srcDisplay.in

    node routedLed: Led
    connect isPort0.eq -> routedLed.in
  }
}`,
    dsl: `
circuit CrossbarRouter {
  impl {
    node sourcePort: Input(value=0)

    node zero: Constant(value=0)
    node one: Constant(value=1)

    node isPort0: Comparator
    connect sourcePort.out -> isPort0.a
    connect zero.out -> isPort0.b

    node destPort: Mux
    connect zero.out -> destPort.in0
    connect one.out -> destPort.in1
    connect isPort0.eq -> destPort.sel

    node destDisplay: HexDisplay
    connect destPort.out -> destDisplay.in

    node srcDisplay: HexDisplay
    connect sourcePort.out -> srcDisplay.in

    node routedLed: Led
    connect isPort0.eq -> routedLed.in
  }
}`,
  },

  packetSerializer: {
    name: "Packet Serializer",
    description:
      "Reads bytes from RAM one at a time and outputs them with a valid signal. A counter tracks progress and signals when the packet is complete.",
    displayDsl: `circuit PacketSerializer {
  clock clk
  impl {
    node ram: DualPortRAM(init={
      0: 170, 1: 187, 2: 204, 3: 221,
      4: 238, 5: 255, 6: 17, 7: 34
    })
    connect clk -> ram.clk

    node readPtr: Register(initial=0)
    connect clk -> readPtr.clk

    node one: Constant(value=1)
    node seven: Constant(value=7)

    node nextPtr: Adder
    connect readPtr.q -> nextPtr.a
    connect one.out -> nextPtr.b

    node enable: Switch
    connect enable.out -> readPtr.we
    connect nextPtr.sum -> readPtr.data
    connect readPtr.q -> ram.addrB

    node dataOut: HexDisplay
    connect ram.dataB -> dataOut.in

    node ptrDisplay: HexDisplay
    connect readPtr.q -> ptrDisplay.in

    node isDone: Comparator
    connect readPtr.q -> isDone.a
    connect seven.out -> isDone.b

    node doneLed: Led
    connect isDone.eq -> doneLed.in
  }
}`,
    dsl: `
circuit PacketSerializer {
  clock clk
  impl {
    node ram: DualPortRAM(init={
      0: 170, 1: 187, 2: 204, 3: 221,
      4: 238, 5: 255, 6: 17, 7: 34
    })
    connect clk -> ram.clk

    node readPtr: Register(initial=0)
    connect clk -> readPtr.clk

    node one: Constant(value=1)
    node seven: Constant(value=7)

    node nextPtr: Adder
    connect readPtr.q -> nextPtr.a
    connect one.out -> nextPtr.b

    node enable: Switch
    connect enable.out -> readPtr.we
    connect nextPtr.sum -> readPtr.data
    connect readPtr.q -> ram.addrB

    node dataOut: HexDisplay
    connect ram.dataB -> dataOut.in

    node ptrDisplay: HexDisplay
    connect readPtr.q -> ptrDisplay.in

    node isDone: Comparator
    connect readPtr.q -> isDone.a
    connect seven.out -> isDone.b

    node doneLed: Led
    connect isDone.eq -> doneLed.in
  }
}`,
  },
};

/**
 * Full MiniSwitch2Port DSL — all sub-circuit definitions concatenated.
 * Includes: MacRxParser, IngressController, SimpleArbiter2Port,
 * PacketForwarder2Port, EgressController, and MiniSwitch2Port.
 */
export const SWITCH_DSL = `
circuit MacRxParser {
  input byte_in: Bus[8]
  input valid: Bit
  clock clk
  output data_out: Bus[8]
  output sof: Bit
  output eof: Bit
  output data_valid: Bit
  output error: Bit
  impl {
    node fsm_state: Register
    node preamble_count: Register
    node byte_count: Register
    node STATE_IDLE: Input(value=0)
    node STATE_PREAMBLE_SYNC: Input(value=1)
    node STATE_WAIT_SFD: Input(value=2)
    node STATE_IN_FRAME: Input(value=3)
    node PREAMBLE_BYTE: Input(value=85)
    node SFD_BYTE: Input(value=213)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SIX: Input(value=6)
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
    node isPreambleByte: Comparator
    connect byte_in -> isPreambleByte.a
    connect PREAMBLE_BYTE.out -> isPreambleByte.b
    node isSFDByte: Comparator
    connect byte_in -> isSFDByte.a
    connect SFD_BYTE.out -> isSFDByte.b
    node preamble_inc: Adder
    connect preamble_count.q -> preamble_inc.a
    connect ONE.out -> preamble_inc.b
    node preamble_is_seven: Comparator
    connect preamble_count.q -> preamble_is_seven.a
    connect SIX.out -> preamble_is_seven.b
    node byte_inc: Adder
    connect byte_count.q -> byte_inc.a
    connect ONE.out -> byte_inc.b
    node byte_is_seven: Comparator
    connect byte_count.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b
    node byte_is_zero: Comparator
    connect byte_count.q -> byte_is_zero.a
    connect ZERO.out -> byte_is_zero.b
    node idle_to_preamble: And
    connect valid -> idle_to_preamble.a
    connect isPreambleByte.eq -> idle_to_preamble.b
    node idle_transition: And
    connect isIDLE.eq -> idle_transition.a
    connect idle_to_preamble.out -> idle_transition.b
    node preamble_count_full: And
    connect isPREAMBLE_SYNC.eq -> preamble_count_full.a
    connect preamble_is_seven.eq -> preamble_count_full.b
    node preamble_to_wait: And
    connect preamble_count_full.out -> preamble_to_wait.a
    connect isPreambleByte.eq -> preamble_to_wait.b
    node preamble_to_wait_match: And
    connect preamble_to_wait.out -> preamble_to_wait_match.a
    connect valid -> preamble_to_wait_match.b
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
    node preamble_got_sfd: And
    connect preamble_is_seven.eq -> preamble_got_sfd.a
    connect isSFDByte.eq -> preamble_got_sfd.b
    node preamble_complete: And
    connect isPREAMBLE_SYNC.eq -> preamble_complete.a
    connect preamble_got_sfd.out -> preamble_complete.b
    node preamble_to_frame: And
    connect preamble_complete.out -> preamble_to_frame.a
    connect valid -> preamble_to_frame.b
    node sfd_to_frame: And
    connect isWAIT_SFD.eq -> sfd_to_frame.a
    connect isSFDByte.eq -> sfd_to_frame.b
    node sfd_transition: And
    connect sfd_to_frame.out -> sfd_transition.a
    connect valid -> sfd_transition.b
    node sfd_missing: And
    connect isWAIT_SFD.eq -> sfd_missing.a
    node not_sfd_byte: Not
    connect isSFDByte.eq -> not_sfd_byte.in
    connect not_sfd_byte.out -> sfd_missing.b
    node sfd_error: And
    connect sfd_missing.out -> sfd_error.a
    connect valid -> sfd_error.b
    node frame_complete: And
    connect isIN_FRAME.eq -> frame_complete.a
    connect byte_is_seven.eq -> frame_complete.b
    node frame_done: And
    connect frame_complete.out -> frame_done.a
    connect valid -> frame_done.b
    node next_state_m5: Mux
    connect fsm_state.q -> next_state_m5.in0
    connect STATE_IDLE.out -> next_state_m5.in1
    connect frame_done.out -> next_state_m5.sel
    node next_state_m4: Mux
    connect next_state_m5.out -> next_state_m4.in0
    connect STATE_IN_FRAME.out -> next_state_m4.in1
    connect sfd_transition.out -> next_state_m4.sel
    node next_state_m3: Mux
    connect next_state_m4.out -> next_state_m3.in0
    connect STATE_IN_FRAME.out -> next_state_m3.in1
    connect preamble_to_frame.out -> next_state_m3.sel
    node next_state_m2: Mux
    connect next_state_m3.out -> next_state_m2.in0
    connect STATE_WAIT_SFD.out -> next_state_m2.in1
    connect preamble_to_wait_match.out -> next_state_m2.sel
    node next_state_m1: Mux
    connect next_state_m2.out -> next_state_m1.in0
    connect STATE_PREAMBLE_SYNC.out -> next_state_m1.in1
    connect idle_transition.out -> next_state_m1.sel
    node error_reset: Or
    connect preamble_reset.out -> error_reset.a
    connect sfd_error.out -> error_reset.b
    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_IDLE.out -> next_state.in1
    connect error_reset.out -> next_state.sel
    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we
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
    connect byte_in -> data_out
    node sof_condition: And
    connect isIN_FRAME.eq -> sof_condition.a
    connect byte_is_zero.eq -> sof_condition.b
    connect sof_condition.out -> sof
    connect frame_complete.out -> eof
    node data_valid_signal: And
    connect isIN_FRAME.eq -> data_valid_signal.a
    connect valid -> data_valid_signal.b
    connect data_valid_signal.out -> data_valid
    connect error_reset.out -> error
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in
    node preamble_count_display: HexDisplay
    connect preamble_count.q -> preamble_count_display.in
    node byte_count_display: HexDisplay
    connect byte_count.q -> byte_count_display.in
  }
}

circuit IngressController {
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
    node fsm_state: Register
    node byte_count: Register
    node write_ptr_reg: Register
    node pkt_count: Register
    node pkt_ready_reg: Register
    node STATE_IDLE: Input(value=0)
    node STATE_RECEIVING: Input(value=1)
    node STATE_BUFFERED: Input(value=2)
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node FOUR: Input(value=4)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b
    node isRECEIVING: Comparator
    connect fsm_state.q -> isRECEIVING.a
    connect STATE_RECEIVING.out -> isRECEIVING.b
    node isBUFFERED: Comparator
    connect fsm_state.q -> isBUFFERED.a
    connect STATE_BUFFERED.out -> isBUFFERED.b
    node buf_full_cmp: Comparator
    connect pkt_count.q -> buf_full_cmp.a
    connect FOUR.out -> buf_full_cmp.b
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
    node buffered_to_idle: And
    connect isBUFFERED.eq -> buffered_to_idle.a
    connect grant -> buffered_to_idle.b
    node next_state_m2: Mux
    connect fsm_state.q -> next_state_m2.in0
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
    node byte_inc: Adder
    connect byte_count.q -> byte_inc.a
    connect ONE.out -> byte_inc.b
    node should_count: And
    connect isRECEIVING.eq -> should_count.a
    connect data_valid -> should_count.b
    node next_byte_count: Mux
    connect ZERO.out -> next_byte_count.in0
    connect byte_inc.sum -> next_byte_count.in1
    connect should_count.out -> next_byte_count.sel
    connect next_byte_count.out -> byte_count.data
    node byte_count_we: Input(value=1)
    connect byte_count_we.out -> byte_count.we
    node ptr_add_eight: Adder
    connect write_ptr_reg.q -> ptr_add_eight.a
    connect EIGHT.out -> ptr_add_eight.b
    node should_advance_ptr: And
    connect buffered_to_idle.out -> should_advance_ptr.a
    connect buffered_to_idle.out -> should_advance_ptr.b
    node next_write_ptr_val: Mux
    connect write_ptr_reg.q -> next_write_ptr_val.in0
    connect ptr_add_eight.sum -> next_write_ptr_val.in1
    connect should_advance_ptr.out -> next_write_ptr_val.sel
    connect next_write_ptr_val.out -> write_ptr_reg.data
    node write_ptr_reg_we: Input(value=1)
    connect write_ptr_reg_we.out -> write_ptr_reg.we
    node pkt_inc: Adder
    connect pkt_count.q -> pkt_inc.a
    connect ONE.out -> pkt_inc.b
    node pkt_dec: Adder
    connect pkt_count.q -> pkt_dec.a
    node MINUS_ONE: Input(value=255)
    connect MINUS_ONE.out -> pkt_dec.b
    node next_pkt_count_inc: Mux
    connect pkt_count.q -> next_pkt_count_inc.in0
    connect pkt_inc.sum -> next_pkt_count_inc.in1
    connect receiving_complete_valid.out -> next_pkt_count_inc.sel
    node next_pkt_count: Mux
    connect next_pkt_count_inc.out -> next_pkt_count.in0
    connect pkt_dec.sum -> next_pkt_count.in1
    connect buffered_to_idle.out -> next_pkt_count.sel
    connect next_pkt_count.out -> pkt_count.data
    node pkt_count_we: Input(value=1)
    connect pkt_count_we.out -> pkt_count.we
    node buf_addr_calc: Adder
    connect write_ptr_reg.q -> buf_addr_calc.a
    connect byte_count.q -> buf_addr_calc.b
    node buf_we_signal: And
    connect isRECEIVING.eq -> buf_we_signal.a
    connect data_valid -> buf_we_signal.b
    connect buf_addr_calc.sum -> buf_addr
    connect data_in -> buf_data
    connect buf_we_signal.out -> buf_we
    connect buf_full_cmp.eq -> buf_full
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
    connect write_ptr_reg.q -> write_ptr
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in
    node pkt_count_display: HexDisplay
    connect pkt_count.q -> pkt_count_display.in
    node write_ptr_debug: HexDisplay
    connect write_ptr_reg.q -> write_ptr_debug.in
  }
}

circuit SimpleArbiter2Port {
  input port0_ready: Bit
  input port1_ready: Bit
  input forwarder_done: Bit
  clock clk
  output grant_port: Bus[8]
  output grant_valid: Bit
  impl {
    node last_port: Register
    node grant_port_reg: Register
    node grant_valid_reg: Register
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node last_was_port0: Comparator
    connect last_port.q -> last_was_port0.a
    connect ZERO.out -> last_was_port0.b
    node last_was_port1: Comparator
    connect last_port.q -> last_was_port1.a
    connect ONE.out -> last_was_port1.b
    node prefer_port1: And
    connect last_was_port0.eq -> prefer_port1.a
    connect port1_ready -> prefer_port1.b
    node not_port1_ready: Not
    connect port1_ready -> not_port1_ready.in
    node fallback_port0: And
    connect last_was_port0.eq -> fallback_port0.a
    connect not_port1_ready.out -> fallback_port0.b
    node fallback_port0_ready: And
    connect fallback_port0.out -> fallback_port0_ready.a
    connect port0_ready -> fallback_port0_ready.b
    node prefer_port0: And
    connect last_was_port1.eq -> prefer_port0.a
    connect port0_ready -> prefer_port0.b
    node not_port0_ready: Not
    connect port0_ready -> not_port0_ready.in
    node fallback_port1: And
    connect last_was_port1.eq -> fallback_port1.a
    connect not_port0_ready.out -> fallback_port1.b
    node fallback_port1_ready: And
    connect fallback_port1.out -> fallback_port1_ready.a
    connect port1_ready -> fallback_port1_ready.b
    node grant_port0_signal: Or
    connect prefer_port0.out -> grant_port0_signal.a
    connect fallback_port0_ready.out -> grant_port0_signal.b
    node grant_port1_signal: Or
    connect prefer_port1.out -> grant_port1_signal.a
    connect fallback_port1_ready.out -> grant_port1_signal.b
    node grant_valid_signal: Or
    connect grant_port0_signal.out -> grant_valid_signal.a
    connect grant_port1_signal.out -> grant_valid_signal.b
    node grant_port_mux: Mux
    connect ZERO.out -> grant_port_mux.in0
    connect ONE.out -> grant_port_mux.in1
    connect grant_port1_signal.out -> grant_port_mux.sel
    connect grant_valid_signal.out -> grant_valid_reg.data
    node grant_valid_we: Input(value=1)
    connect grant_valid_we.out -> grant_valid_reg.we
    connect grant_port_mux.out -> grant_port_reg.data
    node grant_port_we: Input(value=1)
    connect grant_port_we.out -> grant_port_reg.we
    connect grant_valid_reg.q -> grant_valid
    connect grant_port_reg.q -> grant_port
    node next_last_port: Mux
    connect last_port.q -> next_last_port.in0
    connect grant_port_reg.q -> next_last_port.in1
    connect forwarder_done -> next_last_port.sel
    connect next_last_port.out -> last_port.data
    node last_port_we: Input(value=1)
    connect last_port_we.out -> last_port.we
    node last_port_display: HexDisplay
    connect last_port.q -> last_port_display.in
  }
}

circuit PacketForwarder2Port {
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
    node fsm_state: Register
    node byte_counter: Register
    node output_port_reg: Register
    node ingress_port_reg: Register
    node done_reg: Register
    node STATE_IDLE: Input(value=0)
    node STATE_READ_HEADER: Input(value=1)
    node STATE_WAIT_HEADER: Input(value=2)
    node STATE_ROUTE: Input(value=3)
    node STATE_COPY_PAYLOAD: Input(value=4)
    node STATE_DONE: Input(value=5)
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)
    node DA_MASK: Input(value=240)
    node DA_SHIFT: Input(value=4)
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
    node idle_to_read: And
    connect isIDLE.eq -> idle_to_read.a
    connect grant_valid -> idle_to_read.b
    node read_to_wait: And
    connect isREAD_HEADER.eq -> read_to_wait.a
    connect isREAD_HEADER.eq -> read_to_wait.b
    node wait_to_route: And
    connect isWAIT_HEADER.eq -> wait_to_route.a
    connect isWAIT_HEADER.eq -> wait_to_route.b
    node byte_is_seven: Comparator
    connect byte_counter.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b
    node copy_complete: And
    connect isCOPY_PAYLOAD.eq -> copy_complete.a
    connect byte_is_seven.eq -> copy_complete.b
    node done_to_idle: And
    connect isDONE.eq -> done_to_idle.a
    connect isDONE.eq -> done_to_idle.b
    node next_state_m5: Mux
    connect fsm_state.q -> next_state_m5.in0
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
    node route_to_copy: And
    connect isROUTE.eq -> route_to_copy.a
    connect isROUTE.eq -> route_to_copy.b
    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_COPY_PAYLOAD.out -> next_state.in1
    connect route_to_copy.out -> next_state.sel
    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we
    node latch_ingress_port: And
    connect idle_to_read.out -> latch_ingress_port.a
    connect idle_to_read.out -> latch_ingress_port.b
    node next_ingress_port_val: Mux
    connect ingress_port_reg.q -> next_ingress_port_val.in0
    connect grant_port -> next_ingress_port_val.in1
    connect latch_ingress_port.out -> next_ingress_port_val.sel
    connect next_ingress_port_val.out -> ingress_port_reg.data
    node ingress_port_reg_we: Input(value=1)
    connect ingress_port_reg_we.out -> ingress_port_reg.we
    node byte_inc: Adder
    connect byte_counter.q -> byte_inc.a
    connect ONE.out -> byte_inc.b
    node should_increment: And
    connect isCOPY_PAYLOAD.eq -> should_increment.a
    connect isCOPY_PAYLOAD.eq -> should_increment.b
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
    node ingress_is_port0: Comparator
    connect ingress_port_reg.q -> ingress_is_port0.a
    connect ZERO.out -> ingress_is_port0.b
    node selected_read_ptr: Mux
    connect port1_read_ptr -> selected_read_ptr.in0
    connect port0_read_ptr -> selected_read_ptr.in1
    connect ingress_is_port0.eq -> selected_read_ptr.sel
    node ingress_addr_calc: Adder
    connect selected_read_ptr.out -> ingress_addr_calc.a
    connect byte_counter.q -> ingress_addr_calc.b
    node cross_route: Adder
    connect ONE.out -> cross_route.a
    node neg_ingress: Adder
    node MINUS_ONE: Input(value=255)
    connect ingress_port_reg.q -> neg_ingress.a
    connect MINUS_ONE.out -> neg_ingress.b
    connect neg_ingress.sum -> cross_route.b
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
    node port_offset: LeftShifter
    connect output_port_reg.q -> port_offset.value
    node THREE: Input(value=3)
    connect THREE.out -> port_offset.shift
    node egress_addr_calc: Adder
    connect port_offset.result -> egress_addr_calc.a
    connect byte_counter.q -> egress_addr_calc.b
    connect ingress_addr_calc.sum -> ingress_addr
    connect egress_addr_calc.sum -> egress_addr
    node ingress_re_signal: Or
    connect isREAD_HEADER.eq -> ingress_re_signal.a
    connect isCOPY_PAYLOAD.eq -> ingress_re_signal.b
    connect ingress_re_signal.out -> ingress_re
    connect isCOPY_PAYLOAD.eq -> egress_we
    connect isDONE.eq -> done_reg.data
    node done_we: Input(value=1)
    connect done_we.out -> done_reg.we
    connect done_reg.q -> done
    connect output_port_reg.q -> output_port
    connect ingress_port_reg.q -> ingress_port
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
    node fsm_state: Register
    node byte_counter: Register
    node read_ptr: Register
    node STATE_IDLE: Input(value=0)
    node STATE_TRANSMIT: Input(value=1)
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node SEVEN: Input(value=7)
    node EIGHT: Input(value=8)
    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b
    node isTRANSMIT: Comparator
    connect fsm_state.q -> isTRANSMIT.a
    connect STATE_TRANSMIT.out -> isTRANSMIT.b
    node can_start: And
    connect trigger -> can_start.a
    connect pkt_ready -> can_start.b
    node idle_to_transmit: And
    connect isIDLE.eq -> idle_to_transmit.a
    connect can_start.out -> idle_to_transmit.b
    node byte_is_seven: Comparator
    connect byte_counter.q -> byte_is_seven.a
    connect SEVEN.out -> byte_is_seven.b
    node transmit_complete: And
    connect isTRANSMIT.eq -> transmit_complete.a
    connect byte_is_seven.eq -> transmit_complete.b
    node next_state_m1: Mux
    connect fsm_state.q -> next_state_m1.in0
    connect STATE_TRANSMIT.out -> next_state_m1.in1
    connect idle_to_transmit.out -> next_state_m1.sel
    node next_state: Mux
    connect next_state_m1.out -> next_state.in0
    connect STATE_IDLE.out -> next_state.in1
    connect transmit_complete.out -> next_state.sel
    connect next_state.out -> fsm_state.data
    node fsm_state_we: Input(value=1)
    connect fsm_state_we.out -> fsm_state.we
    node byte_inc: Adder
    connect byte_counter.q -> byte_inc.a
    connect ONE.out -> byte_inc.b
    node should_increment: And
    connect isTRANSMIT.eq -> should_increment.a
    connect isTRANSMIT.eq -> should_increment.b
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
    node egress_addr_calc: Adder
    connect read_ptr.q -> egress_addr_calc.a
    connect byte_counter.q -> egress_addr_calc.b
    connect egress_addr_calc.sum -> egress_addr
    connect isTRANSMIT.eq -> egress_re
    connect isTRANSMIT.eq -> data_valid
    node byte_is_zero: Comparator
    connect byte_counter.q -> byte_is_zero.a
    connect ZERO.out -> byte_is_zero.b
    node sof_signal: And
    connect isTRANSMIT.eq -> sof_signal.a
    connect byte_is_zero.eq -> sof_signal.b
    connect sof_signal.out -> sof
    node eof_signal: And
    connect isTRANSMIT.eq -> eof_signal.a
    connect byte_is_seven.eq -> eof_signal.b
    connect eof_signal.out -> eof
    connect isIDLE.eq -> ready
    node fsm_state_display: HexDisplay
    connect fsm_state.q -> fsm_state_display.in
    node byte_counter_display: HexDisplay
    connect byte_counter.q -> byte_counter_display.in
    node read_ptr_display: HexDisplay
    connect read_ptr.q -> read_ptr_display.in
  }
}

circuit MiniSwitch2Port {
  impl {
    node p0_byte: Input
    node p0_valid: Input
    node p1_byte: Input
    node p1_valid: Input
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node EIGHT: Input(value=8)
    node parser0: MacRxParser
    node parser1: MacRxParser
    node ingress0: IngressController
    node ingress1: IngressController
    node ram_ingress0: DualPortRAM
    node ram_ingress1: DualPortRAM
    node arbiter: SimpleArbiter2Port
    node forwarder: PacketForwarder2Port
    node ram_egress0: DualPortRAM
    node ram_egress1: DualPortRAM
    node egress0: EgressController
    node egress1: EgressController
    connect p0_byte.out -> parser0.byte_in
    connect p0_valid.out -> parser0.valid
    connect parser0.data_out -> ingress0.data_in
    connect parser0.sof -> ingress0.sof
    connect parser0.eof -> ingress0.eof
    connect parser0.data_valid -> ingress0.data_valid
    connect ingress0.buf_addr -> ram_ingress0.addrA
    connect parser0.data_out -> ram_ingress0.dataA
    connect ingress0.buf_we -> ram_ingress0.weA
    connect p1_byte.out -> parser1.byte_in
    connect p1_valid.out -> parser1.valid
    connect parser1.data_out -> ingress1.data_in
    connect parser1.sof -> ingress1.sof
    connect parser1.eof -> ingress1.eof
    connect parser1.data_valid -> ingress1.data_valid
    connect ingress1.buf_addr -> ram_ingress1.addrA
    connect parser1.data_out -> ram_ingress1.dataA
    connect ingress1.buf_we -> ram_ingress1.weA
    connect ingress0.pkt_ready -> arbiter.port0_ready
    connect ingress1.pkt_ready -> arbiter.port1_ready
    connect forwarder.done -> arbiter.forwarder_done
    connect arbiter.grant_port -> forwarder.grant_port
    connect arbiter.grant_valid -> forwarder.grant_valid
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
    connect ZERO.out -> forwarder.port0_read_ptr
    connect ZERO.out -> forwarder.port1_read_ptr
    connect forwarder.ingress_addr -> ram_ingress0.addrB
    connect forwarder.ingress_addr -> ram_ingress1.addrB
    node ingress_data_mux: Mux
    connect ram_ingress1.dataB -> ingress_data_mux.in0
    connect ram_ingress0.dataB -> ingress_data_mux.in1
    connect grant_is_port0.eq -> ingress_data_mux.sel
    connect forwarder.egress_addr -> ram_egress0.addrA
    connect forwarder.egress_addr -> ram_egress1.addrA
    connect ingress_data_mux.out -> ram_egress0.dataA
    connect ingress_data_mux.out -> ram_egress1.dataA
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
    node egress0_trigger: And
    connect forwarder.done -> egress0_trigger.a
    connect output_is_port0.eq -> egress0_trigger.b
    connect egress0_trigger.out -> egress0.trigger
    node egress1_trigger: And
    connect forwarder.done -> egress1_trigger.a
    connect output_is_port1.eq -> egress1_trigger.b
    connect egress1_trigger.out -> egress1.trigger
    node always_ready: Switch
    connect always_ready.out -> egress0.pkt_ready
    connect always_ready.out -> egress1.pkt_ready
    connect egress0.egress_addr -> ram_egress0.addrB
    connect egress1.egress_addr -> ram_egress1.addrB
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
  }
}
`;
