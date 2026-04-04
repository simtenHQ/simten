// Auto-generated from DSL

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
