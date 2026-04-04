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
    displayDsl: `const FrameDetector = component('FrameDetector')
  .node('byteIn', Input, { value: 85 })
  .node('valid', Switch)
  .node('state', Register, { initial: 0 })
  .node('PREAMBLE', Constant, { value: 85 })
  .node('SFD', Constant, { value: 213 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('isPreamble', Comparator)
  .node('isSFD', Comparator)
  .node('isIdle', Comparator)
  .node('isWaiting', Comparator)
  .node('isActive', Comparator)
  .node('gotPreamble', And)
  .node('gotPreambleValid', And)
  .node('gotSFD', And)
  .node('gotSFDValid', And)
  .node('next1', Mux)
  .node('next2', Mux)
  .node('we', Input, { value: 1 })
  .node('stateDisplay', HexDisplay)
  .node('frameLed', Led)
  .connect(({ byteIn, valid, state, PREAMBLE, SFD, zero, one, two, isPreamble, isSFD, isIdle, isWaiting, isActive, gotPreamble, gotPreambleValid, gotSFD, gotSFDValid, next1, next2, we, stateDisplay, frameLed }) => [
    byteIn.out.to(isPreamble.a, isSFD.a),
    PREAMBLE.out.to(isPreamble.b),
    SFD.out.to(isSFD.b),
    state.q.to(isIdle.a, isWaiting.a, isActive.a, next1.in0, stateDisplay.in),
    zero.out.to(isIdle.b),
    one.out.to(isWaiting.b, next1.in1),
    two.out.to(isActive.b, next2.in1),
    isIdle.eq.to(gotPreamble.a),
    isPreamble.eq.to(gotPreamble.b),
    gotPreamble.out.to(gotPreambleValid.a),
    valid.out.to(gotPreambleValid.b, gotSFDValid.b),
    isWaiting.eq.to(gotSFD.a),
    isSFD.eq.to(gotSFD.b),
    gotSFD.out.to(gotSFDValid.a),
    gotPreambleValid.out.to(next1.sel),
    next1.out.to(next2.in0),
    gotSFDValid.out.to(next2.sel),
    next2.out.to(state.data),
    we.out.to(state.we),
    isActive.eq.to(frameLed.in),
  ])
  .build()`,
    dsl: `
const FrameDetector = component('FrameDetector')
  .node('byteIn', Input, { value: 85 })
  .node('valid', Switch)
  .node('state', Register, { initial: 0 })
  .node('PREAMBLE', Constant, { value: 85 })
  .node('SFD', Constant, { value: 213 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('two', Constant, { value: 2 })
  .node('isPreamble', Comparator)
  .node('isSFD', Comparator)
  .node('isIdle', Comparator)
  .node('isWaiting', Comparator)
  .node('isActive', Comparator)
  .node('gotPreamble', And)
  .node('gotPreambleValid', And)
  .node('gotSFD', And)
  .node('gotSFDValid', And)
  .node('next1', Mux)
  .node('next2', Mux)
  .node('we', Input, { value: 1 })
  .node('stateDisplay', HexDisplay)
  .node('frameLed', Led)
  .connect(({ byteIn, valid, state, PREAMBLE, SFD, zero, one, two, isPreamble, isSFD, isIdle, isWaiting, isActive, gotPreamble, gotPreambleValid, gotSFD, gotSFDValid, next1, next2, we, stateDisplay, frameLed }) => [
    byteIn.out.to(isPreamble.a, isSFD.a),
    PREAMBLE.out.to(isPreamble.b),
    SFD.out.to(isSFD.b),
    state.q.to(isIdle.a, isWaiting.a, isActive.a, next1.in0, stateDisplay.in),
    zero.out.to(isIdle.b),
    one.out.to(isWaiting.b, next1.in1),
    two.out.to(isActive.b, next2.in1),
    isIdle.eq.to(gotPreamble.a),
    isPreamble.eq.to(gotPreamble.b),
    gotPreamble.out.to(gotPreambleValid.a),
    valid.out.to(gotPreambleValid.b, gotSFDValid.b),
    isWaiting.eq.to(gotSFD.a),
    isSFD.eq.to(gotSFD.b),
    gotSFD.out.to(gotSFDValid.a),
    gotPreambleValid.out.to(next1.sel),
    next1.out.to(next2.in0),
    gotSFDValid.out.to(next2.sel),
    next2.out.to(state.data),
    we.out.to(state.we),
    isActive.eq.to(frameLed.in),
  ])
  .build()`,
  },

  packetBuffer: {
    name: "Packet Buffer",
    description:
      "Stores incoming bytes in DualPortRAM as they arrive. A write pointer register tracks the next free address.",
    displayDsl: `
const PacketBuffer = component('PacketBuffer')
  .node('dataIn', Input, { value: 42 })
  .node('writeCmd', Switch)
  .node('writePtr', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('ram', DualPortRAM)
  .node('nextPtr', Adder)
  .node('readAddr', Input, { value: 0 })
  .node('readback', HexDisplay)
  .node('ptrDisplay', HexDisplay)
  .connect(({ in: inp, out, dataIn, writeCmd, writePtr, one, ram, nextPtr, readAddr, readback, ptrDisplay }) => [
    writePtr.q.to(ram.addrA, nextPtr.a, ptrDisplay.in),
    dataIn.out.to(ram.dataA),
    writeCmd.out.to(ram.weA, writePtr.we),
    one.out.to(nextPtr.b),
    nextPtr.sum.to(writePtr.data),
    readAddr.out.to(ram.addrB),
    ram.outB.to(readback.in),
  ])
  .build()
`,
    dsl: `
const PacketBuffer = component('PacketBuffer')
  .node('dataIn', Input, { value: 42 })
  .node('writeCmd', Switch)
  .node('writePtr', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('ram', DualPortRAM)
  .node('nextPtr', Adder)
  .node('readAddr', Input, { value: 0 })
  .node('readback', HexDisplay)
  .node('ptrDisplay', HexDisplay)
  .connect(({ in: inp, out, dataIn, writeCmd, writePtr, one, ram, nextPtr, readAddr, readback, ptrDisplay }) => [
    writePtr.q.to(ram.addrA, nextPtr.a, ptrDisplay.in),
    dataIn.out.to(ram.dataA),
    writeCmd.out.to(ram.weA, writePtr.we),
    one.out.to(nextPtr.b),
    nextPtr.sum.to(writePtr.data),
    readAddr.out.to(ram.addrB),
    ram.outB.to(readback.in),
  ])
  .build()
`,
  },

  portArbiter: {
    name: "Port Arbiter",
    description:
      "Decides which port gets to send next. When both ports have packets ready, it alternates fairly between them.",
    displayDsl: `
const PortArbiter = component('PortArbiter')
  .node('port0_ready', Switch)
  .node('port1_ready', Switch)
  .node('lastPort', Input, { value: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('lastWas0', Comparator)
  .node('prefer1', And)
  .node('notPort1', Not)
  .node('fallback0', And)
  .node('fallback0Ready', And)
  .node('lastWas1', Comparator)
  .node('prefer0', And)
  .node('grant0', Or)
  .node('grant1', Or)
  .node('grantValid', Or)
  .node('grantPort', Mux)
  .node('portDisplay', HexDisplay)
  .node('validLed', Led)
  .connect(({ in: inp, out, port0_ready, port1_ready, lastPort, zero, one, lastWas0, prefer1, notPort1, fallback0, fallback0Ready, lastWas1, prefer0, grant0, grant1, grantValid, grantPort, portDisplay, validLed }) => [
    lastPort.out.to(lastWas0.a, lastWas1.a),
    zero.out.to(lastWas0.b, grantPort.in0),
    lastWas0.eq.to(prefer1.a, fallback0.a),
    port1_ready.out.to(prefer1.b, notPort1.in),
    notPort1.out.to(fallback0.b),
    fallback0.out.to(fallback0Ready.a),
    port0_ready.out.to(fallback0Ready.b, prefer0.b),
    one.out.to(lastWas1.b, grantPort.in1),
    lastWas1.eq.to(prefer0.a),
    prefer0.out.to(grant0.a),
    fallback0Ready.out.to(grant0.b),
    prefer1.out.to(grant1.a),
    grant0.out.to(grantValid.a),
    grant1.out.to(grantValid.b, grantPort.sel),
    grantPort.out.to(portDisplay.in),
    grantValid.out.to(validLed.in),
  ])
  .build()
`,
    dsl: `
const PortArbiter = component('PortArbiter')
  .node('port0_ready', Switch)
  .node('port1_ready', Switch)
  .node('lastPort', Input, { value: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('lastWas0', Comparator)
  .node('prefer1', And)
  .node('notPort1', Not)
  .node('fallback0', And)
  .node('fallback0Ready', And)
  .node('lastWas1', Comparator)
  .node('prefer0', And)
  .node('grant0', Or)
  .node('grant1', Or)
  .node('grantValid', Or)
  .node('grantPort', Mux)
  .node('portDisplay', HexDisplay)
  .node('validLed', Led)
  .connect(({ in: inp, out, port0_ready, port1_ready, lastPort, zero, one, lastWas0, prefer1, notPort1, fallback0, fallback0Ready, lastWas1, prefer0, grant0, grant1, grantValid, grantPort, portDisplay, validLed }) => [
    lastPort.out.to(lastWas0.a, lastWas1.a),
    zero.out.to(lastWas0.b, grantPort.in0),
    lastWas0.eq.to(prefer1.a, fallback0.a),
    port1_ready.out.to(prefer1.b, notPort1.in),
    notPort1.out.to(fallback0.b),
    fallback0.out.to(fallback0Ready.a),
    port0_ready.out.to(fallback0Ready.b, prefer0.b),
    one.out.to(lastWas1.b, grantPort.in1),
    lastWas1.eq.to(prefer0.a),
    prefer0.out.to(grant0.a),
    fallback0Ready.out.to(grant0.b),
    prefer1.out.to(grant1.a),
    grant0.out.to(grantValid.a),
    grant1.out.to(grantValid.b, grantPort.sel),
    grantPort.out.to(portDisplay.in),
    grantValid.out.to(validLed.in),
  ])
  .build()
`,
  },

  crossbarRouter: {
    name: "Crossbar Router",
    description:
      "Routes packets to the opposite port: port 0 sends to port 1 and vice versa. A comparator and mux implement the cross-over logic.",
    displayDsl: `
const CrossbarRouter = component('CrossbarRouter')
  .node('sourcePort', Input, { value: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('isPort0', Comparator)
  .node('destPort', Mux)
  .node('destDisplay', HexDisplay)
  .node('srcDisplay', HexDisplay)
  .node('routedLed', Led)
  .connect(({ in: inp, out, sourcePort, zero, one, isPort0, destPort, destDisplay, srcDisplay, routedLed }) => [
    sourcePort.out.to(isPort0.a, srcDisplay.in),
    zero.out.to(isPort0.b, destPort.in0),
    one.out.to(destPort.in1),
    isPort0.eq.to(destPort.sel, routedLed.in),
    destPort.out.to(destDisplay.in),
  ])
  .build()
`,
    dsl: `
const CrossbarRouter = component('CrossbarRouter')
  .node('sourcePort', Input, { value: 0 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('isPort0', Comparator)
  .node('destPort', Mux)
  .node('destDisplay', HexDisplay)
  .node('srcDisplay', HexDisplay)
  .node('routedLed', Led)
  .connect(({ in: inp, out, sourcePort, zero, one, isPort0, destPort, destDisplay, srcDisplay, routedLed }) => [
    sourcePort.out.to(isPort0.a, srcDisplay.in),
    zero.out.to(isPort0.b, destPort.in0),
    one.out.to(destPort.in1),
    isPort0.eq.to(destPort.sel, routedLed.in),
    destPort.out.to(destDisplay.in),
  ])
  .build()
`,
  },

  packetSerializer: {
    name: "Packet Serializer",
    description:
      "Reads bytes from RAM one at a time and outputs them with a valid signal. A counter tracks progress and signals when the packet is complete.",
    displayDsl: `
const PacketSerializer = component('PacketSerializer')
  .node('ram', DualPortRAM, { init: {"0":170,"1":187,"2":204,"3":221,"4":238,"5":255,"6":17,"7":34} })
  .node('readPtr', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('seven', Constant, { value: 7 })
  .node('nextPtr', Adder)
  .node('enable', Switch)
  .node('dataOut', HexDisplay)
  .node('ptrDisplay', HexDisplay)
  .node('isDone', Comparator)
  .node('doneLed', Led)
  .connect(({ in: inp, out, ram, readPtr, one, seven, nextPtr, enable, dataOut, ptrDisplay, isDone, doneLed }) => [
    readPtr.q.to(nextPtr.a, ram.addrB, ptrDisplay.in, isDone.a),
    one.out.to(nextPtr.b),
    enable.out.to(readPtr.we),
    nextPtr.sum.to(readPtr.data),
    ram.outB.to(dataOut.in),
    seven.out.to(isDone.b),
    isDone.eq.to(doneLed.in),
  ])
  .build()
`,
    dsl: `
const PacketSerializer = component('PacketSerializer')
  .node('ram', DualPortRAM, { init: {"0":170,"1":187,"2":204,"3":221,"4":238,"5":255,"6":17,"7":34} })
  .node('readPtr', Register, { initial: 0 })
  .node('one', Constant, { value: 1 })
  .node('seven', Constant, { value: 7 })
  .node('nextPtr', Adder)
  .node('enable', Switch)
  .node('dataOut', HexDisplay)
  .node('ptrDisplay', HexDisplay)
  .node('isDone', Comparator)
  .node('doneLed', Led)
  .connect(({ in: inp, out, ram, readPtr, one, seven, nextPtr, enable, dataOut, ptrDisplay, isDone, doneLed }) => [
    readPtr.q.to(nextPtr.a, ram.addrB, ptrDisplay.in, isDone.a),
    one.out.to(nextPtr.b),
    enable.out.to(readPtr.we),
    nextPtr.sum.to(readPtr.data),
    ram.outB.to(dataOut.in),
    seven.out.to(isDone.b),
    isDone.eq.to(doneLed.in),
  ])
  .build()
`,
  },
};

/**
 * Full MiniSwitch2Port DSL — all sub-circuit definitions concatenated.
 * Includes: MacRxParser, IngressController, SimpleArbiter2Port,
 * PacketForwarder2Port, EgressController, and MiniSwitch2Port.
 */
export const SWITCH_DSL = `
const MacRxParser = component('MacRxParser')
  .in('byte_in', bus(8))
  .in('valid', bit)
  .out('data_out', bus(8))
  .out('sof', bit)
  .out('eof', bit)
  .out('data_valid', bit)
  .out('error', bit)
  .node('fsm_state', Register)
  .node('preamble_count', Register)
  .node('byte_count', Register)
  .node('STATE_IDLE', Input, { value: 0 })
  .node('STATE_PREAMBLE_SYNC', Input, { value: 1 })
  .node('STATE_WAIT_SFD', Input, { value: 2 })
  .node('STATE_IN_FRAME', Input, { value: 3 })
  .node('PREAMBLE_BYTE', Input, { value: 85 })
  .node('SFD_BYTE', Input, { value: 213 })
  .node('SEVEN', Input, { value: 7 })
  .node('EIGHT', Input, { value: 8 })
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('SIX', Input, { value: 6 })
  .node('isIDLE', Comparator)
  .node('isPREAMBLE_SYNC', Comparator)
  .node('isWAIT_SFD', Comparator)
  .node('isIN_FRAME', Comparator)
  .node('isPreambleByte', Comparator)
  .node('isSFDByte', Comparator)
  .node('preamble_inc', Adder)
  .node('preamble_is_seven', Comparator)
  .node('byte_inc', Adder)
  .node('byte_is_seven', Comparator)
  .node('byte_is_zero', Comparator)
  .node('idle_to_preamble', And)
  .node('idle_transition', And)
  .node('preamble_count_full', And)
  .node('preamble_to_wait', And)
  .node('preamble_to_wait_match', And)
  .node('not_preamble_byte', Not)
  .node('preamble_incomplete', Comparator)
  .node('preamble_bad_byte', And)
  .node('preamble_broken', And)
  .node('preamble_reset', And)
  .node('preamble_got_sfd', And)
  .node('preamble_complete', And)
  .node('preamble_to_frame', And)
  .node('sfd_to_frame', And)
  .node('sfd_transition', And)
  .node('sfd_missing', And)
  .node('not_sfd_byte', Not)
  .node('sfd_error', And)
  .node('frame_complete', And)
  .node('frame_done', And)
  .node('next_state_m5', Mux)
  .node('next_state_m4', Mux)
  .node('next_state_m3', Mux)
  .node('next_state_m2', Mux)
  .node('next_state_m1', Mux)
  .node('error_reset', Or)
  .node('next_state', Mux)
  .node('fsm_state_we', Input, { value: 1 })
  .node('preamble_counting', And)
  .node('next_preamble_count', Mux)
  .node('preamble_count_we', Input, { value: 1 })
  .node('byte_counting', And)
  .node('next_byte_count', Mux)
  .node('byte_count_we', Input, { value: 1 })
  .node('sof_condition', And)
  .node('data_valid_signal', And)
  .node('fsm_state_display', HexDisplay)
  .node('preamble_count_display', HexDisplay)
  .node('byte_count_display', HexDisplay)
  .connect(({ in: inp, out, fsm_state, preamble_count, byte_count, STATE_IDLE, STATE_PREAMBLE_SYNC, STATE_WAIT_SFD, STATE_IN_FRAME, PREAMBLE_BYTE, SFD_BYTE, SEVEN, EIGHT, ZERO, ONE, SIX, isIDLE, isPREAMBLE_SYNC, isWAIT_SFD, isIN_FRAME, isPreambleByte, isSFDByte, preamble_inc, preamble_is_seven, byte_inc, byte_is_seven, byte_is_zero, idle_to_preamble, idle_transition, preamble_count_full, preamble_to_wait, preamble_to_wait_match, not_preamble_byte, preamble_incomplete, preamble_bad_byte, preamble_broken, preamble_reset, preamble_got_sfd, preamble_complete, preamble_to_frame, sfd_to_frame, sfd_transition, sfd_missing, not_sfd_byte, sfd_error, frame_complete, frame_done, next_state_m5, next_state_m4, next_state_m3, next_state_m2, next_state_m1, error_reset, next_state, fsm_state_we, preamble_counting, next_preamble_count, preamble_count_we, byte_counting, next_byte_count, byte_count_we, sof_condition, data_valid_signal, fsm_state_display, preamble_count_display, byte_count_display }) => [
    fsm_state.q.to(isIDLE.a, isPREAMBLE_SYNC.a, isWAIT_SFD.a, isIN_FRAME.a, next_state_m5.in0, fsm_state_display.in),
    STATE_IDLE.out.to(isIDLE.b, next_state_m5.in1, next_state.in1),
    STATE_PREAMBLE_SYNC.out.to(isPREAMBLE_SYNC.b, next_state_m1.in1),
    STATE_WAIT_SFD.out.to(isWAIT_SFD.b, next_state_m2.in1),
    STATE_IN_FRAME.out.to(isIN_FRAME.b, next_state_m4.in1, next_state_m3.in1),
    inp.byte_in.to(isPreambleByte.a, isSFDByte.a, out.data_out),
    PREAMBLE_BYTE.out.to(isPreambleByte.b),
    SFD_BYTE.out.to(isSFDByte.b),
    preamble_count.q.to(preamble_inc.a, preamble_is_seven.a, preamble_incomplete.a, preamble_count_display.in),
    ONE.out.to(preamble_inc.b, byte_inc.b),
    SIX.out.to(preamble_is_seven.b, preamble_incomplete.b),
    byte_count.q.to(byte_inc.a, byte_is_seven.a, byte_is_zero.a, byte_count_display.in),
    SEVEN.out.to(byte_is_seven.b),
    ZERO.out.to(byte_is_zero.b, next_preamble_count.in0, next_byte_count.in0),
    inp.valid.to(idle_to_preamble.a, preamble_to_wait_match.b, preamble_reset.b, preamble_to_frame.b, sfd_transition.b, sfd_error.b, frame_done.b, preamble_counting.b, byte_counting.b, data_valid_signal.b),
    isPreambleByte.eq.to(idle_to_preamble.b, preamble_to_wait.b, not_preamble_byte.in),
    isIDLE.eq.to(idle_transition.a),
    idle_to_preamble.out.to(idle_transition.b),
    isPREAMBLE_SYNC.eq.to(preamble_count_full.a, preamble_broken.a, preamble_complete.a, preamble_counting.a),
    preamble_is_seven.eq.to(preamble_count_full.b, preamble_got_sfd.a),
    preamble_count_full.out.to(preamble_to_wait.a),
    preamble_to_wait.out.to(preamble_to_wait_match.a),
    not_preamble_byte.out.to(preamble_bad_byte.a),
    preamble_incomplete.lt.to(preamble_bad_byte.b),
    preamble_bad_byte.out.to(preamble_broken.b),
    preamble_broken.out.to(preamble_reset.a),
    isSFDByte.eq.to(preamble_got_sfd.b, sfd_to_frame.b, not_sfd_byte.in),
    preamble_got_sfd.out.to(preamble_complete.b),
    preamble_complete.out.to(preamble_to_frame.a),
    isWAIT_SFD.eq.to(sfd_to_frame.a, sfd_missing.a),
    sfd_to_frame.out.to(sfd_transition.a),
    not_sfd_byte.out.to(sfd_missing.b),
    sfd_missing.out.to(sfd_error.a),
    isIN_FRAME.eq.to(frame_complete.a, byte_counting.a, sof_condition.a, data_valid_signal.a),
    byte_is_seven.eq.to(frame_complete.b),
    frame_complete.out.to(frame_done.a, out.eof),
    frame_done.out.to(next_state_m5.sel),
    next_state_m5.out.to(next_state_m4.in0),
    sfd_transition.out.to(next_state_m4.sel),
    next_state_m4.out.to(next_state_m3.in0),
    preamble_to_frame.out.to(next_state_m3.sel),
    next_state_m3.out.to(next_state_m2.in0),
    preamble_to_wait_match.out.to(next_state_m2.sel),
    next_state_m2.out.to(next_state_m1.in0),
    idle_transition.out.to(next_state_m1.sel),
    preamble_reset.out.to(error_reset.a),
    sfd_error.out.to(error_reset.b),
    next_state_m1.out.to(next_state.in0),
    error_reset.out.to(next_state.sel, out.error),
    next_state.out.to(fsm_state.data),
    fsm_state_we.out.to(fsm_state.we),
    preamble_inc.sum.to(next_preamble_count.in1),
    preamble_counting.out.to(next_preamble_count.sel),
    next_preamble_count.out.to(preamble_count.data),
    preamble_count_we.out.to(preamble_count.we),
    byte_inc.sum.to(next_byte_count.in1),
    byte_counting.out.to(next_byte_count.sel),
    next_byte_count.out.to(byte_count.data),
    byte_count_we.out.to(byte_count.we),
    byte_is_zero.eq.to(sof_condition.b),
    sof_condition.out.to(out.sof),
    data_valid_signal.out.to(out.data_valid),
  ])
  .build()

const IngressController = component('IngressController')
  .in('data_in', bus(8))
  .in('sof', bit)
  .in('eof', bit)
  .in('data_valid', bit)
  .in('grant', bit)
  .out('buf_addr', bus(8))
  .out('buf_data', bus(8))
  .out('buf_we', bit)
  .out('pkt_ready', bit)
  .out('buf_full', bit)
  .out('write_ptr', bus(8))
  .node('fsm_state', Register)
  .node('byte_count', Register)
  .node('write_ptr_reg', Register)
  .node('pkt_count', Register)
  .node('pkt_ready_reg', Register)
  .node('STATE_IDLE', Input, { value: 0 })
  .node('STATE_RECEIVING', Input, { value: 1 })
  .node('STATE_BUFFERED', Input, { value: 2 })
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('FOUR', Input, { value: 4 })
  .node('SEVEN', Input, { value: 7 })
  .node('EIGHT', Input, { value: 8 })
  .node('isIDLE', Comparator)
  .node('isRECEIVING', Comparator)
  .node('isBUFFERED', Comparator)
  .node('buf_full_cmp', Comparator)
  .node('not_buf_full', Not)
  .node('can_receive', And)
  .node('can_receive_valid', And)
  .node('idle_to_receiving', And)
  .node('byte_is_seven', Comparator)
  .node('frame_complete', And)
  .node('receiving_complete', And)
  .node('receiving_complete_valid', And)
  .node('buffered_to_idle', And)
  .node('next_state_m2', Mux)
  .node('next_state_m1', Mux)
  .node('next_state', Mux)
  .node('fsm_state_we', Input, { value: 1 })
  .node('byte_inc', Adder)
  .node('should_count', And)
  .node('next_byte_count', Mux)
  .node('byte_count_we', Input, { value: 1 })
  .node('ptr_add_eight', Adder)
  .node('should_advance_ptr', And)
  .node('next_write_ptr_val', Mux)
  .node('write_ptr_reg_we', Input, { value: 1 })
  .node('pkt_inc', Adder)
  .node('pkt_dec', Adder)
  .node('MINUS_ONE', Input, { value: 255 })
  .node('next_pkt_count_inc', Mux)
  .node('next_pkt_count', Mux)
  .node('pkt_count_we', Input, { value: 1 })
  .node('buf_addr_calc', Adder)
  .node('buf_we_signal', And)
  .node('pkt_count_nonzero', Comparator)
  .node('pkt_ready_signal', Or)
  .node('pkt_ready_we', Input, { value: 1 })
  .node('fsm_state_display', HexDisplay)
  .node('pkt_count_display', HexDisplay)
  .node('write_ptr_debug', HexDisplay)
  .connect(({ in: inp, out, fsm_state, byte_count, write_ptr_reg, pkt_count, pkt_ready_reg, STATE_IDLE, STATE_RECEIVING, STATE_BUFFERED, ZERO, ONE, FOUR, SEVEN, EIGHT, isIDLE, isRECEIVING, isBUFFERED, buf_full_cmp, not_buf_full, can_receive, can_receive_valid, idle_to_receiving, byte_is_seven, frame_complete, receiving_complete, receiving_complete_valid, buffered_to_idle, next_state_m2, next_state_m1, next_state, fsm_state_we, byte_inc, should_count, next_byte_count, byte_count_we, ptr_add_eight, should_advance_ptr, next_write_ptr_val, write_ptr_reg_we, pkt_inc, pkt_dec, MINUS_ONE, next_pkt_count_inc, next_pkt_count, pkt_count_we, buf_addr_calc, buf_we_signal, pkt_count_nonzero, pkt_ready_signal, pkt_ready_we, fsm_state_display, pkt_count_display, write_ptr_debug }) => [
    fsm_state.q.to(isIDLE.a, isRECEIVING.a, isBUFFERED.a, next_state_m2.in0, fsm_state_display.in),
    STATE_IDLE.out.to(isIDLE.b, next_state.in1),
    STATE_RECEIVING.out.to(isRECEIVING.b, next_state_m1.in1),
    STATE_BUFFERED.out.to(isBUFFERED.b, next_state_m2.in1),
    pkt_count.q.to(buf_full_cmp.a, pkt_inc.a, pkt_dec.a, next_pkt_count_inc.in0, pkt_count_nonzero.a, pkt_count_display.in),
    FOUR.out.to(buf_full_cmp.b),
    buf_full_cmp.eq.to(not_buf_full.in, out.buf_full),
    inp.sof.to(can_receive.a),
    not_buf_full.out.to(can_receive.b),
    can_receive.out.to(can_receive_valid.a),
    inp.data_valid.to(can_receive_valid.b, receiving_complete_valid.b, should_count.b, buf_we_signal.b),
    isIDLE.eq.to(idle_to_receiving.a),
    can_receive_valid.out.to(idle_to_receiving.b),
    byte_count.q.to(byte_is_seven.a, byte_inc.a, buf_addr_calc.b),
    SEVEN.out.to(byte_is_seven.b),
    inp.eof.to(frame_complete.a),
    byte_is_seven.eq.to(frame_complete.b),
    isRECEIVING.eq.to(receiving_complete.a, should_count.a, buf_we_signal.a),
    frame_complete.out.to(receiving_complete.b),
    receiving_complete.out.to(receiving_complete_valid.a),
    isBUFFERED.eq.to(buffered_to_idle.a, pkt_ready_signal.a),
    inp.grant.to(buffered_to_idle.b),
    receiving_complete_valid.out.to(next_state_m2.sel, next_pkt_count_inc.sel),
    next_state_m2.out.to(next_state_m1.in0),
    idle_to_receiving.out.to(next_state_m1.sel),
    next_state_m1.out.to(next_state.in0),
    buffered_to_idle.out.to(next_state.sel, should_advance_ptr.a, should_advance_ptr.b, next_pkt_count.sel),
    next_state.out.to(fsm_state.data),
    fsm_state_we.out.to(fsm_state.we),
    ONE.out.to(byte_inc.b, pkt_inc.b),
    ZERO.out.to(next_byte_count.in0, pkt_count_nonzero.b),
    byte_inc.sum.to(next_byte_count.in1),
    should_count.out.to(next_byte_count.sel),
    next_byte_count.out.to(byte_count.data),
    byte_count_we.out.to(byte_count.we),
    write_ptr_reg.q.to(ptr_add_eight.a, next_write_ptr_val.in0, buf_addr_calc.a, out.write_ptr, write_ptr_debug.in),
    EIGHT.out.to(ptr_add_eight.b),
    ptr_add_eight.sum.to(next_write_ptr_val.in1),
    should_advance_ptr.out.to(next_write_ptr_val.sel),
    next_write_ptr_val.out.to(write_ptr_reg.data),
    write_ptr_reg_we.out.to(write_ptr_reg.we),
    MINUS_ONE.out.to(pkt_dec.b),
    pkt_inc.sum.to(next_pkt_count_inc.in1),
    next_pkt_count_inc.out.to(next_pkt_count.in0),
    pkt_dec.sum.to(next_pkt_count.in1),
    next_pkt_count.out.to(pkt_count.data),
    pkt_count_we.out.to(pkt_count.we),
    buf_addr_calc.sum.to(out.buf_addr),
    inp.data_in.to(out.buf_data),
    buf_we_signal.out.to(out.buf_we),
    pkt_count_nonzero.gt.to(pkt_ready_signal.b),
    pkt_ready_signal.out.to(pkt_ready_reg.data),
    pkt_ready_we.out.to(pkt_ready_reg.we),
    pkt_ready_reg.q.to(out.pkt_ready),
  ])
  .build()

const SimpleArbiter2Port = component('SimpleArbiter2Port')
  .in('port0_ready', bit)
  .in('port1_ready', bit)
  .in('forwarder_done', bit)
  .out('grant_port', bus(8))
  .out('grant_valid', bit)
  .node('last_port', Register)
  .node('grant_port_reg', Register)
  .node('grant_valid_reg', Register)
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('last_was_port0', Comparator)
  .node('last_was_port1', Comparator)
  .node('prefer_port1', And)
  .node('not_port1_ready', Not)
  .node('fallback_port0', And)
  .node('fallback_port0_ready', And)
  .node('prefer_port0', And)
  .node('not_port0_ready', Not)
  .node('fallback_port1', And)
  .node('fallback_port1_ready', And)
  .node('grant_port0_signal', Or)
  .node('grant_port1_signal', Or)
  .node('grant_valid_signal', Or)
  .node('grant_port_mux', Mux)
  .node('grant_valid_we', Input, { value: 1 })
  .node('grant_port_we', Input, { value: 1 })
  .node('next_last_port', Mux)
  .node('last_port_we', Input, { value: 1 })
  .node('last_port_display', HexDisplay)
  .connect(({ in: inp, out, last_port, grant_port_reg, grant_valid_reg, ZERO, ONE, last_was_port0, last_was_port1, prefer_port1, not_port1_ready, fallback_port0, fallback_port0_ready, prefer_port0, not_port0_ready, fallback_port1, fallback_port1_ready, grant_port0_signal, grant_port1_signal, grant_valid_signal, grant_port_mux, grant_valid_we, grant_port_we, next_last_port, last_port_we, last_port_display }) => [
    last_port.q.to(last_was_port0.a, last_was_port1.a, next_last_port.in0, last_port_display.in),
    ZERO.out.to(last_was_port0.b, grant_port_mux.in0),
    ONE.out.to(last_was_port1.b, grant_port_mux.in1),
    last_was_port0.eq.to(prefer_port1.a, fallback_port0.a),
    inp.port1_ready.to(prefer_port1.b, not_port1_ready.in, fallback_port1_ready.b),
    not_port1_ready.out.to(fallback_port0.b),
    fallback_port0.out.to(fallback_port0_ready.a),
    inp.port0_ready.to(fallback_port0_ready.b, prefer_port0.b, not_port0_ready.in),
    last_was_port1.eq.to(prefer_port0.a, fallback_port1.a),
    not_port0_ready.out.to(fallback_port1.b),
    fallback_port1.out.to(fallback_port1_ready.a),
    prefer_port0.out.to(grant_port0_signal.a),
    fallback_port0_ready.out.to(grant_port0_signal.b),
    prefer_port1.out.to(grant_port1_signal.a),
    fallback_port1_ready.out.to(grant_port1_signal.b),
    grant_port0_signal.out.to(grant_valid_signal.a),
    grant_port1_signal.out.to(grant_valid_signal.b, grant_port_mux.sel),
    grant_valid_signal.out.to(grant_valid_reg.data),
    grant_valid_we.out.to(grant_valid_reg.we),
    grant_port_mux.out.to(grant_port_reg.data),
    grant_port_we.out.to(grant_port_reg.we),
    grant_valid_reg.q.to(out.grant_valid),
    grant_port_reg.q.to(out.grant_port, next_last_port.in1),
    inp.forwarder_done.to(next_last_port.sel),
    next_last_port.out.to(last_port.data),
    last_port_we.out.to(last_port.we),
  ])
  .build()

const PacketForwarder2Port = component('PacketForwarder2Port')
  .in('grant_port', bus(8))
  .in('grant_valid', bit)
  .in('port0_read_ptr', bus(8))
  .in('port1_read_ptr', bus(8))
  .out('ingress_addr', bus(8))
  .out('ingress_re', bit)
  .out('egress_addr', bus(8))
  .out('egress_we', bit)
  .out('done', bit)
  .out('output_port', bus(8))
  .out('ingress_port', bus(8))
  .node('fsm_state', Register)
  .node('byte_counter', Register)
  .node('output_port_reg', Register)
  .node('ingress_port_reg', Register)
  .node('done_reg', Register)
  .node('STATE_IDLE', Input, { value: 0 })
  .node('STATE_READ_HEADER', Input, { value: 1 })
  .node('STATE_WAIT_HEADER', Input, { value: 2 })
  .node('STATE_ROUTE', Input, { value: 3 })
  .node('STATE_COPY_PAYLOAD', Input, { value: 4 })
  .node('STATE_DONE', Input, { value: 5 })
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('SEVEN', Input, { value: 7 })
  .node('EIGHT', Input, { value: 8 })
  .node('DA_MASK', Input, { value: 240 })
  .node('DA_SHIFT', Input, { value: 4 })
  .node('isIDLE', Comparator)
  .node('isREAD_HEADER', Comparator)
  .node('isWAIT_HEADER', Comparator)
  .node('isROUTE', Comparator)
  .node('isCOPY_PAYLOAD', Comparator)
  .node('isDONE', Comparator)
  .node('idle_to_read', And)
  .node('read_to_wait', And)
  .node('wait_to_route', And)
  .node('byte_is_seven', Comparator)
  .node('copy_complete', And)
  .node('done_to_idle', And)
  .node('next_state_m5', Mux)
  .node('next_state_m4', Mux)
  .node('next_state_m3', Mux)
  .node('next_state_m2', Mux)
  .node('next_state_m1', Mux)
  .node('route_to_copy', And)
  .node('next_state', Mux)
  .node('fsm_state_we', Input, { value: 1 })
  .node('latch_ingress_port', And)
  .node('next_ingress_port_val', Mux)
  .node('ingress_port_reg_we', Input, { value: 1 })
  .node('byte_inc', Adder)
  .node('should_increment', And)
  .node('should_reset', And)
  .node('next_byte_counter_inc', Mux)
  .node('next_byte_counter', Mux)
  .node('byte_counter_we', Input, { value: 1 })
  .node('ingress_is_port0', Comparator)
  .node('selected_read_ptr', Mux)
  .node('ingress_addr_calc', Adder)
  .node('cross_route', Adder)
  .node('neg_ingress', Adder)
  .node('MINUS_ONE', Input, { value: 255 })
  .node('latch_output_port', And)
  .node('next_output_port_val', Mux)
  .node('output_port_reg_we', Input, { value: 1 })
  .node('port_offset', LeftShifter)
  .node('THREE', Input, { value: 3 })
  .node('egress_addr_calc', Adder)
  .node('ingress_re_signal', Or)
  .node('done_we', Input, { value: 1 })
  .node('fsm_state_display', HexDisplay)
  .node('byte_counter_display', HexDisplay)
  .node('output_port_debug', HexDisplay)
  .node('ingress_port_debug', HexDisplay)
  .connect(({ in: inp, out, fsm_state, byte_counter, output_port_reg, ingress_port_reg, done_reg, STATE_IDLE, STATE_READ_HEADER, STATE_WAIT_HEADER, STATE_ROUTE, STATE_COPY_PAYLOAD, STATE_DONE, ZERO, ONE, SEVEN, EIGHT, DA_MASK, DA_SHIFT, isIDLE, isREAD_HEADER, isWAIT_HEADER, isROUTE, isCOPY_PAYLOAD, isDONE, idle_to_read, read_to_wait, wait_to_route, byte_is_seven, copy_complete, done_to_idle, next_state_m5, next_state_m4, next_state_m3, next_state_m2, next_state_m1, route_to_copy, next_state, fsm_state_we, latch_ingress_port, next_ingress_port_val, ingress_port_reg_we, byte_inc, should_increment, should_reset, next_byte_counter_inc, next_byte_counter, byte_counter_we, ingress_is_port0, selected_read_ptr, ingress_addr_calc, cross_route, neg_ingress, MINUS_ONE, latch_output_port, next_output_port_val, output_port_reg_we, port_offset, THREE, egress_addr_calc, ingress_re_signal, done_we, fsm_state_display, byte_counter_display, output_port_debug, ingress_port_debug }) => [
    fsm_state.q.to(isIDLE.a, isREAD_HEADER.a, isWAIT_HEADER.a, isROUTE.a, isCOPY_PAYLOAD.a, isDONE.a, next_state_m5.in0, fsm_state_display.in),
    STATE_IDLE.out.to(isIDLE.b, next_state_m5.in1),
    STATE_READ_HEADER.out.to(isREAD_HEADER.b, next_state_m1.in1),
    STATE_WAIT_HEADER.out.to(isWAIT_HEADER.b, next_state_m2.in1),
    STATE_ROUTE.out.to(isROUTE.b, next_state_m3.in1),
    STATE_COPY_PAYLOAD.out.to(isCOPY_PAYLOAD.b, next_state.in1),
    STATE_DONE.out.to(isDONE.b, next_state_m4.in1),
    isIDLE.eq.to(idle_to_read.a),
    inp.grant_valid.to(idle_to_read.b),
    isREAD_HEADER.eq.to(read_to_wait.a, read_to_wait.b, ingress_re_signal.a),
    isWAIT_HEADER.eq.to(wait_to_route.a, wait_to_route.b),
    byte_counter.q.to(byte_is_seven.a, byte_inc.a, next_byte_counter_inc.in0, ingress_addr_calc.b, egress_addr_calc.b, byte_counter_display.in),
    SEVEN.out.to(byte_is_seven.b),
    isCOPY_PAYLOAD.eq.to(copy_complete.a, should_increment.a, should_increment.b, ingress_re_signal.b, out.egress_we),
    byte_is_seven.eq.to(copy_complete.b),
    isDONE.eq.to(done_to_idle.a, done_to_idle.b, done_reg.data),
    done_to_idle.out.to(next_state_m5.sel),
    next_state_m5.out.to(next_state_m4.in0),
    copy_complete.out.to(next_state_m4.sel),
    next_state_m4.out.to(next_state_m3.in0),
    wait_to_route.out.to(next_state_m3.sel, latch_output_port.a, latch_output_port.b),
    next_state_m3.out.to(next_state_m2.in0),
    read_to_wait.out.to(next_state_m2.sel),
    next_state_m2.out.to(next_state_m1.in0),
    idle_to_read.out.to(next_state_m1.sel, latch_ingress_port.a, latch_ingress_port.b, should_reset.a, should_reset.b),
    isROUTE.eq.to(route_to_copy.a, route_to_copy.b),
    next_state_m1.out.to(next_state.in0),
    route_to_copy.out.to(next_state.sel),
    next_state.out.to(fsm_state.data),
    fsm_state_we.out.to(fsm_state.we),
    ingress_port_reg.q.to(next_ingress_port_val.in0, ingress_is_port0.a, neg_ingress.a, out.ingress_port, ingress_port_debug.in),
    inp.grant_port.to(next_ingress_port_val.in1),
    latch_ingress_port.out.to(next_ingress_port_val.sel),
    next_ingress_port_val.out.to(ingress_port_reg.data),
    ingress_port_reg_we.out.to(ingress_port_reg.we),
    ONE.out.to(byte_inc.b, cross_route.a),
    byte_inc.sum.to(next_byte_counter_inc.in1),
    should_increment.out.to(next_byte_counter_inc.sel),
    next_byte_counter_inc.out.to(next_byte_counter.in0),
    ZERO.out.to(next_byte_counter.in1, ingress_is_port0.b),
    should_reset.out.to(next_byte_counter.sel),
    next_byte_counter.out.to(byte_counter.data),
    byte_counter_we.out.to(byte_counter.we),
    inp.port1_read_ptr.to(selected_read_ptr.in0),
    inp.port0_read_ptr.to(selected_read_ptr.in1),
    ingress_is_port0.eq.to(selected_read_ptr.sel),
    selected_read_ptr.out.to(ingress_addr_calc.a),
    MINUS_ONE.out.to(neg_ingress.b),
    neg_ingress.sum.to(cross_route.b),
    output_port_reg.q.to(next_output_port_val.in0, port_offset.value, out.output_port, output_port_debug.in),
    cross_route.sum.to(next_output_port_val.in1),
    latch_output_port.out.to(next_output_port_val.sel),
    next_output_port_val.out.to(output_port_reg.data),
    output_port_reg_we.out.to(output_port_reg.we),
    THREE.out.to(port_offset.shift),
    port_offset.result.to(egress_addr_calc.a),
    ingress_addr_calc.sum.to(out.ingress_addr),
    egress_addr_calc.sum.to(out.egress_addr),
    ingress_re_signal.out.to(out.ingress_re),
    done_we.out.to(done_reg.we),
    done_reg.q.to(out.done),
  ])
  .build()

const EgressController = component('EgressController')
  .in('pkt_ready', bit)
  .in('trigger', bit)
  .out('egress_addr', bus(8))
  .out('egress_re', bit)
  .out('data_valid', bit)
  .out('sof', bit)
  .out('eof', bit)
  .out('ready', bit)
  .node('fsm_state', Register)
  .node('byte_counter', Register)
  .node('read_ptr', Register)
  .node('STATE_IDLE', Input, { value: 0 })
  .node('STATE_TRANSMIT', Input, { value: 1 })
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('SEVEN', Input, { value: 7 })
  .node('EIGHT', Input, { value: 8 })
  .node('isIDLE', Comparator)
  .node('isTRANSMIT', Comparator)
  .node('can_start', And)
  .node('idle_to_transmit', And)
  .node('byte_is_seven', Comparator)
  .node('transmit_complete', And)
  .node('next_state_m1', Mux)
  .node('next_state', Mux)
  .node('fsm_state_we', Input, { value: 1 })
  .node('byte_inc', Adder)
  .node('should_increment', And)
  .node('should_reset', And)
  .node('next_byte_counter_inc', Mux)
  .node('next_byte_counter', Mux)
  .node('byte_counter_we', Input, { value: 1 })
  .node('ptr_add_eight', Adder)
  .node('should_advance_ptr', And)
  .node('next_read_ptr', Mux)
  .node('read_ptr_we', Input, { value: 1 })
  .node('egress_addr_calc', Adder)
  .node('byte_is_zero', Comparator)
  .node('sof_signal', And)
  .node('eof_signal', And)
  .node('fsm_state_display', HexDisplay)
  .node('byte_counter_display', HexDisplay)
  .node('read_ptr_display', HexDisplay)
  .connect(({ in: inp, out, fsm_state, byte_counter, read_ptr, STATE_IDLE, STATE_TRANSMIT, ZERO, ONE, SEVEN, EIGHT, isIDLE, isTRANSMIT, can_start, idle_to_transmit, byte_is_seven, transmit_complete, next_state_m1, next_state, fsm_state_we, byte_inc, should_increment, should_reset, next_byte_counter_inc, next_byte_counter, byte_counter_we, ptr_add_eight, should_advance_ptr, next_read_ptr, read_ptr_we, egress_addr_calc, byte_is_zero, sof_signal, eof_signal, fsm_state_display, byte_counter_display, read_ptr_display }) => [
    fsm_state.q.to(isIDLE.a, isTRANSMIT.a, next_state_m1.in0, fsm_state_display.in),
    STATE_IDLE.out.to(isIDLE.b, next_state.in1),
    STATE_TRANSMIT.out.to(isTRANSMIT.b, next_state_m1.in1),
    inp.trigger.to(can_start.a),
    inp.pkt_ready.to(can_start.b),
    isIDLE.eq.to(idle_to_transmit.a, out.ready),
    can_start.out.to(idle_to_transmit.b),
    byte_counter.q.to(byte_is_seven.a, byte_inc.a, next_byte_counter_inc.in0, egress_addr_calc.b, byte_is_zero.a, byte_counter_display.in),
    SEVEN.out.to(byte_is_seven.b),
    isTRANSMIT.eq.to(transmit_complete.a, should_increment.a, should_increment.b, out.egress_re, out.data_valid, sof_signal.a, eof_signal.a),
    byte_is_seven.eq.to(transmit_complete.b, eof_signal.b),
    idle_to_transmit.out.to(next_state_m1.sel, should_reset.a, should_reset.b),
    next_state_m1.out.to(next_state.in0),
    transmit_complete.out.to(next_state.sel, should_advance_ptr.a, should_advance_ptr.b),
    next_state.out.to(fsm_state.data),
    fsm_state_we.out.to(fsm_state.we),
    ONE.out.to(byte_inc.b),
    byte_inc.sum.to(next_byte_counter_inc.in1),
    should_increment.out.to(next_byte_counter_inc.sel),
    next_byte_counter_inc.out.to(next_byte_counter.in0),
    ZERO.out.to(next_byte_counter.in1, byte_is_zero.b),
    should_reset.out.to(next_byte_counter.sel),
    next_byte_counter.out.to(byte_counter.data),
    byte_counter_we.out.to(byte_counter.we),
    read_ptr.q.to(ptr_add_eight.a, next_read_ptr.in0, egress_addr_calc.a, read_ptr_display.in),
    EIGHT.out.to(ptr_add_eight.b),
    ptr_add_eight.sum.to(next_read_ptr.in1),
    should_advance_ptr.out.to(next_read_ptr.sel),
    next_read_ptr.out.to(read_ptr.data),
    read_ptr_we.out.to(read_ptr.we),
    egress_addr_calc.sum.to(out.egress_addr),
    byte_is_zero.eq.to(sof_signal.b),
    sof_signal.out.to(out.sof),
    eof_signal.out.to(out.eof),
  ])
  .build()

const MiniSwitch2Port = component('MiniSwitch2Port')
  .node('p0_byte', Input)
  .node('p0_valid', Input)
  .node('p1_byte', Input)
  .node('p1_valid', Input)
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('EIGHT', Input, { value: 8 })
  .node('parser0', MacRxParser)
  .node('parser1', MacRxParser)
  .node('ingress0', IngressController)
  .node('ingress1', IngressController)
  .node('ram_ingress0', DualPortRAM)
  .node('ram_ingress1', DualPortRAM)
  .node('arbiter', SimpleArbiter2Port)
  .node('forwarder', PacketForwarder2Port)
  .node('ram_egress0', DualPortRAM)
  .node('ram_egress1', DualPortRAM)
  .node('egress0', EgressController)
  .node('egress1', EgressController)
  .node('grant_is_port0', Comparator)
  .node('grant_to_port0', And)
  .node('grant_is_port1', Comparator)
  .node('grant_to_port1', And)
  .node('ingress_data_mux', Mux)
  .node('output_is_port0', Comparator)
  .node('egress0_we', And)
  .node('output_is_port1', Comparator)
  .node('egress1_we', And)
  .node('egress0_trigger', And)
  .node('egress1_trigger', And)
  .node('always_ready', Switch)
  .node('p0_out', HexDisplay)
  .node('p0_valid_out', Led)
  .node('p0_sof', Led)
  .node('p0_eof', Led)
  .node('p1_out', HexDisplay)
  .node('p1_valid_out', Led)
  .node('p1_sof', Led)
  .node('p1_eof', Led)
  .node('debug_grant_port', HexDisplay)
  .node('debug_grant_valid', Led)
  .node('debug_forwarder_ingress_port', HexDisplay)
  .node('debug_forwarder_output_port', HexDisplay)
  .node('debug_ingress0_ready', Led)
  .node('debug_ingress1_ready', Led)
  .connect(({ in: inp, out, p0_byte, p0_valid, p1_byte, p1_valid, ZERO, ONE, EIGHT, parser0, parser1, ingress0, ingress1, ram_ingress0, ram_ingress1, arbiter, forwarder, ram_egress0, ram_egress1, egress0, egress1, grant_is_port0, grant_to_port0, grant_is_port1, grant_to_port1, ingress_data_mux, output_is_port0, egress0_we, output_is_port1, egress1_we, egress0_trigger, egress1_trigger, always_ready, p0_out, p0_valid_out, p0_sof, p0_eof, p1_out, p1_valid_out, p1_sof, p1_eof, debug_grant_port, debug_grant_valid, debug_forwarder_ingress_port, debug_forwarder_output_port, debug_ingress0_ready, debug_ingress1_ready }) => [
    p0_byte.out.to(parser0.byte_in),
    p0_valid.out.to(parser0.valid),
    parser0.data_out.to(ingress0.data_in, ram_ingress0.dataA),
    parser0.sof.to(ingress0.sof),
    parser0.eof.to(ingress0.eof),
    parser0.data_valid.to(ingress0.data_valid),
    ingress0.buf_addr.to(ram_ingress0.addrA),
    ingress0.buf_we.to(ram_ingress0.weA),
    p1_byte.out.to(parser1.byte_in),
    p1_valid.out.to(parser1.valid),
    parser1.data_out.to(ingress1.data_in, ram_ingress1.dataA),
    parser1.sof.to(ingress1.sof),
    parser1.eof.to(ingress1.eof),
    parser1.data_valid.to(ingress1.data_valid),
    ingress1.buf_addr.to(ram_ingress1.addrA),
    ingress1.buf_we.to(ram_ingress1.weA),
    ingress0.pkt_ready.to(arbiter.port0_ready, debug_ingress0_ready.in),
    ingress1.pkt_ready.to(arbiter.port1_ready, debug_ingress1_ready.in),
    forwarder.done.to(arbiter.forwarder_done, egress0_trigger.a, egress1_trigger.a),
    arbiter.grant_port.to(forwarder.grant_port, grant_is_port0.a, grant_is_port1.a, debug_grant_port.in),
    arbiter.grant_valid.to(forwarder.grant_valid, grant_to_port0.a, grant_to_port1.a, debug_grant_valid.in),
    ZERO.out.to(grant_is_port0.b, forwarder.port0_read_ptr, forwarder.port1_read_ptr, output_is_port0.b),
    grant_is_port0.eq.to(grant_to_port0.b, ingress_data_mux.sel),
    grant_to_port0.out.to(ingress0.grant),
    ONE.out.to(grant_is_port1.b, output_is_port1.b),
    grant_is_port1.eq.to(grant_to_port1.b),
    grant_to_port1.out.to(ingress1.grant),
    forwarder.ingress_addr.to(ram_ingress0.addrB, ram_ingress1.addrB),
    ram_ingress1.outB.to(ingress_data_mux.in0),
    ram_ingress0.outB.to(ingress_data_mux.in1),
    forwarder.egress_addr.to(ram_egress0.addrA, ram_egress1.addrA),
    ingress_data_mux.out.to(ram_egress0.dataA, ram_egress1.dataA),
    forwarder.output_port.to(output_is_port0.a, output_is_port1.a, debug_forwarder_output_port.in),
    forwarder.egress_we.to(egress0_we.a, egress1_we.a),
    output_is_port0.eq.to(egress0_we.b, egress0_trigger.b),
    egress0_we.out.to(ram_egress0.weA),
    output_is_port1.eq.to(egress1_we.b, egress1_trigger.b),
    egress1_we.out.to(ram_egress1.weA),
    egress0_trigger.out.to(egress0.trigger),
    egress1_trigger.out.to(egress1.trigger),
    always_ready.out.to(egress0.pkt_ready, egress1.pkt_ready),
    egress0.egress_addr.to(ram_egress0.addrB),
    egress1.egress_addr.to(ram_egress1.addrB),
    ram_egress0.outB.to(p0_out.in),
    egress0.data_valid.to(p0_valid_out.in),
    egress0.sof.to(p0_sof.in),
    egress0.eof.to(p0_eof.in),
    ram_egress1.outB.to(p1_out.in),
    egress1.data_valid.to(p1_valid_out.in),
    egress1.sof.to(p1_sof.in),
    egress1.eof.to(p1_eof.in),
    forwarder.ingress_port.to(debug_forwarder_ingress_port.in),
  ])
  .build()
`;
