// Auto-generated from DSL

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
