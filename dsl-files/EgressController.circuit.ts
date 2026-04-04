// Auto-generated from DSL

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
